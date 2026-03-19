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

        // 🔥 BEHAVIORAL SIGNALS (CORE UPGRADE)
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

        const underwritingMetrics = {
            avg_monthly_income: totalIncome,
            avg_monthly_expenses: inputMetrics.totalExpenses || 0,
            structural_fixed_load: fixedExpenses,
            structural_dti: inputMetrics.dti || 0,
            adjusted_dti: totalIncome > 0
                ? Number(((inputMetrics.totalExpenses / totalIncome) * 100).toFixed(1))
                : 0,
            liquidity_buffer_months: liquidityBufferMonths,
            stress_dti_after_10pct_income_drop: totalIncome > 0
                ? Number(((fixedExpenses / (totalIncome * 0.9)) * 100).toFixed(1))
                : 0,
            current_risk_tier,
            trends,
            history,
            behaviorSignals
        };

        const prompt = `
You are a Senior Credit Risk Analyst specializing in behavioral cash-flow analysis.

Your job is to analyze BEHAVIOR OVER TIME — not static financial snapshots.

CRITICAL:
- Focus on trajectory (direction), not just current state
- Behavior OVERRIDES snapshot metrics
- If conflict exists → trust behaviorSignals

You MUST classify:
- IMPROVING
- DETERIORATING
- STABLE

Behavior Signals (authoritative):
${JSON.stringify(behaviorSignals)}

DATA:
${JSON.stringify(underwritingMetrics)}

OUTPUT RULES:
- Hebrew
- Max 3 sentences
- Start with behavior (trajectory)
- No generic text
- No markdown

Return JSON:
{
  "narrative": "...",
  "recommended_loan_structure": "Standard / Balloon / Extended 72",
  "behavior_classification": "IMPROVING / DETERIORATING / STABLE"
}
`;

        let llmRes;

        try {
            llmRes = await base44.integrations.Core.InvokeLLM({
                prompt,
                response_json_schema: {
                    type: "object",
                    properties: {
                        narrative: { type: "string" },
                        recommended_loan_structure: { type: "string" },
                        behavior_classification: { type: "string" }
                    },
                    required: [
                        "narrative",
                        "recommended_loan_structure",
                        "behavior_classification"
                    ]
                }
            });
        } catch (err) {
            console.error("LLM failed", err);
            llmRes = {
                narrative: "התנהגות הלקוח אינה יציבה ולכן הסיכון בפועל גבוה יותר מהנראה.",
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