import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';
import { z } from 'npm:zod';

function withValidation(schema, handler) {
    return async (req) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            try {
                const body = await req.clone().json();
                const validation = schema.safeParse(body);
                if (!validation.success) {
                    return Response.json({ 
                        success: false, 
                        error: "Payload validation failed", 
                        details: validation.error.issues 
                    }, { status: 400 });
                }
            } catch (e) {}
        }
        return handler(req);
    };
}

const insightSchema = z.object({
    metrics: z.object({
        totalIncome: z.number().optional(),
        totalExpenses: z.number().optional(),
        liquidAssets: z.number().optional(),
        score: z.number().optional(),
        dti: z.number().optional()
    }).passthrough().optional()
}).passthrough();

Deno.serve(withValidation(insightSchema, async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        let user;
        try {
            user = await base44.auth.me();
        } catch {
            return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        if (!user) {
            return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const inputMetrics = body?.metrics;

        if (!inputMetrics) {
            return Response.json({ success: false, error: "Valid metrics object required" });
        }

        const fixedExpenses = inputMetrics.totalFixedExpenses ?? inputMetrics.fixedExpenses ?? 0;
        const liquidAssets = inputMetrics.liquidAssets ?? 0;
        const totalIncome = inputMetrics.totalIncome || 0;

        const liquidityBufferMonths = totalIncome > 0
            ? Number((liquidAssets / totalIncome).toFixed(1))
            : 0;

        const current_risk_tier =
            inputMetrics.score < 55 ? "Red" :
            inputMetrics.score < 80 ? "Orange" : "Green";

        const history = inputMetrics.history || [];
        const trends = inputMetrics.trends || {};

        // 🔥 BEHAVIOR SIGNALS
        let behaviorClassification = "STABLE";

        if (history.length >= 2) {
            const first = history[0];
            const last = history[history.length - 1];

            const netImprovement = last.netFlow - first.netFlow;

            if (netImprovement > 0 && trends.expenses < 0) {
                behaviorClassification = "IMPROVING";
            } else if (netImprovement < 0 && trends.expenses > 0) {
                behaviorClassification = "DETERIORATING";
            }
        }

        const behaviorSignals = {
            classification: behaviorClassification,
            netFlowTrend: history.length >= 2
                ? (history[history.length - 1].netFlow > history[0].netFlow ? "UP" : "DOWN")
                : "UNKNOWN",
            expenseTrend: trends.expenses > 10
                ? "INCREASING"
                : trends.expenses < -10
                ? "DECREASING"
                : "STABLE",
            incomeTrend: trends.income > 0
                ? "UP"
                : trends.income < 0
                ? "DOWN"
                : "STABLE"
        };

        // ✅ CLEAN DATA (ENGLISH ONLY)
        const underwritingMetrics = {
            avg_monthly_income: totalIncome,
            avg_monthly_expenses: inputMetrics.totalExpenses || 0,
            fixed_expenses: fixedExpenses,
            dti: inputMetrics.dti || 0,
            expense_to_income_ratio: totalIncome > 0
                ? Number(((inputMetrics.totalExpenses / totalIncome) * 100).toFixed(1))
                : 0,
            liquidity_months: liquidityBufferMonths,
            risk_tier: current_risk_tier,
            trends,
            history,
            behaviorSignals
        };

        // ✅ PROMPT (ENGLISH INSTRUCTIONS → HEBREW OUTPUT)
        const prompt = `You are a senior credit risk analyst in a financial institution.

Your goal is to analyze customer behavior over time — not just describe the current state.

LANGUAGE ENFORCEMENT (CRITICAL):
- Write ONLY in Hebrew.
- Do NOT use any words from other languages.
- Do NOT use English abbreviations.
- Use standard financial terminology in Hebrew (e.g., "יחס חוב להכנסה", "נזילות").
- Do not invent new terms.
- If any non-Hebrew word appears, rewrite the entire response in Hebrew.

WRITING STYLE:
- Professional, concise, and analytical.
- Written like a bank credit analyst.
- No repetition, no exaggeration.

CORE ANALYSIS REQUIREMENT:
- Describe behavior over time (NOT a snapshot).
- Explain how the situation evolved.
- Focus on income vs expenses dynamics.
- If income rises but expenses rise faster → deterioration.
- Highlight consistency vs volatility.
- Use phrases like:
  "לאורך התקופה", "במהלך החודשים", "ניכרת מגמה".

QUALITY RULES:
- Compare income vs expenses clearly.
- Explain drivers of change.
- Reflect uncertainty if needed.
- Align with behavior classification.

Behavior Signals:
${JSON.stringify(behaviorSignals)}

DATA:
${JSON.stringify(underwritingMetrics)}

Return JSON ONLY:
{
  "narrative": "3-5 sentences describing behavior over time",
  "key_factors": [
    "factor",
    "factor",
    "factor"
  ],
  "recommended_loan_structure": "Standard / Balloon / Extended 72",
  "behavior_classification": "IMPROVING / DETERIORATING / STABLE"
}`;

        let llmRes;

        try {
            llmRes = await base44.integrations.Core.InvokeLLM({
                prompt,
                response_json_schema: {
                    type: "object",
                    properties: {
                        narrative: { type: "string" },
                        key_factors: { type: "array", items: { type: "string" } },
                        recommended_loan_structure: { type: "string" },
                        behavior_classification: { type: "string" }
                    },
                    required: [
                        "narrative",
                        "key_factors",
                        "recommended_loan_structure",
                        "behavior_classification"
                    ]
                }
            });
        } catch (err) {
            console.error("LLM failed", err);
            llmRes = {
                narrative: "לאורך התקופה ניכרת חוסר יציבות בהתנהגות הפיננסית ועלייה ברמת הסיכון.",
                key_factors: ["חוסר יציבות", "שחיקה בתזרים", "עלייה בסיכון"],
                recommended_loan_structure: "Extended 72",
                behavior_classification: behaviorClassification
            };
        }

        llmRes.risk_tier = current_risk_tier;

        return Response.json({
            success: true,
            insights: {
                ...llmRes,
                behaviorSignals,
                metrics: underwritingMetrics
            }
        });

    } catch (e) {
        console.error("insightEngine Error:", e);
        return Response.json({ success: false, error: e.message }, { status: 500 });
    }
}));