import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';
import { z } from 'npm:zod';

/**
 * ✅ Validation Middleware (NO double req.json bug)
 */
function withValidation(schema, handler) {
    return async (req) => {
        let parsedBody = null;

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

                parsedBody = body;

            } catch (e) {
                return Response.json({
                    success: false,
                    error: "Invalid JSON"
                }, { status: 400 });
            }
        }

        return handler(req, parsedBody);
    };
}

/**
 * ✅ Schema
 */
const insightSchema = z.object({
    metrics: z.object({
        totalIncome: z.number().optional(),
        totalExpenses: z.number().optional(),
        liquidAssets: z.number().optional(),
        score: z.number().optional(),
        dti: z.number().optional(),
        totalFixedExpenses: z.number().optional(),
        fixedExpenses: z.number().optional(),
        trends: z.object({
            income: z.number().optional(),
            expenses: z.number().optional()
        }).optional(),
        history: z.array(
            z.object({
                netFlow: z.number().optional()
            })
        ).optional()
    }).optional()
}).passthrough();

/**
 * 🚀 Main Handler
 */
Deno.serve(withValidation(insightSchema, async (req, parsedBody) => {
    try {
        const base44 = createClientFromRequest(req);

        // 🔐 Auth
        let user;
        try {
            user = await base44.auth.me();
        } catch {
            return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        if (!user) {
            return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const inputMetrics = parsedBody?.metrics;

        if (!inputMetrics) {
            return Response.json({
                success: false,
                error: "Valid metrics object required"
            });
        }

        /**
         * ✅ SAFE DATA EXTRACTION
         */
        const totalIncome = inputMetrics.totalIncome ?? 0;
        const totalExpenses = inputMetrics.totalExpenses ?? 0;
        const liquidAssets = inputMetrics.liquidAssets ?? 0;
        const fixedExpenses =
            inputMetrics.totalFixedExpenses ??
            inputMetrics.fixedExpenses ??
            0;

        const score = inputMetrics.score ?? 0;
        const dti = inputMetrics.dti ?? 0;

        const trends = inputMetrics.trends || { income: 0, expenses: 0 };
        const historyRaw = inputMetrics.history || [];

        const history = Array.isArray(historyRaw)
            ? historyRaw.filter(h => typeof h.netFlow === "number")
            : [];

        /**
         * ✅ DERIVED METRICS
         */
        const liquidityBufferMonths =
            totalIncome > 0
                ? Number((liquidAssets / totalIncome).toFixed(1))
                : 0;

        const expenseToIncome =
            totalIncome > 0
                ? Number(((totalExpenses / totalIncome) * 100).toFixed(1))
                : 0;

        const current_risk_tier =
            score < 55 ? "Red" :
            score < 80 ? "Orange" : "Green";

        /**
         * 🔥 BEHAVIOR ANALYSIS
         */
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
            netFlowTrend:
                history.length >= 2
                    ? (history[history.length - 1].netFlow > history[0].netFlow ? "UP" : "DOWN")
                    : "UNKNOWN",
            expenseTrend:
                trends.expenses > 10
                    ? "INCREASING"
                    : trends.expenses < -10
                        ? "DECREASING"
                        : "STABLE",
            incomeTrend:
                trends.income > 0
                    ? "UP"
                    : trends.income < 0
                        ? "DOWN"
                        : "STABLE"
        };

        /**
         * ✅ CLEAN METRICS
         */
        const underwritingMetrics = {
            avg_monthly_income: totalIncome,
            avg_monthly_expenses: totalExpenses,
            fixed_expenses: fixedExpenses,
            dti,
            expense_to_income_ratio: expenseToIncome,
            liquidity_months: liquidityBufferMonths,
            risk_tier: current_risk_tier,
            trends,
            history,
            behaviorSignals
        };

        /**
         * 🧠 PROMPT
         */
        const prompt = `
אתה אנליסט סיכוני אשראי בכיר במוסד פיננסי.

כתוב בעברית בלבד.

נתונים:
${JSON.stringify(underwritingMetrics)}

אותות התנהגות:
${JSON.stringify(behaviorSignals)}

הוראות:
- תאר התנהגות לאורך זמן (לא צילום מצב)
- השווה הכנסות מול הוצאות
- הדגש מגמות
- היה מקצועי ותמציתי

החזר JSON בלבד:
{
  "narrative": "",
  "key_factors": [],
  "recommended_loan_structure": "",
  "behavior_classification": ""
}
`;

        /**
         * ⏱️ LLM עם timeout
         */
        let llmRes;

        try {
            const llmPromise = base44.integrations.Core.InvokeLLM({
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

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("LLM timeout")), 8000)
            );

            llmRes = await Promise.race([llmPromise, timeoutPromise]);

        } catch (err) {
            console.error("LLM failed:", err);

            llmRes = {
                narrative: "לאורך התקופה ניכרת אי יציבות בתזרים והחמרה הדרגתית במצב הפיננסי.",
                key_factors: [
                    "שחיקה בתזרים",
                    "עלייה בהוצאות",
                    "רמת סיכון עולה"
                ],
                recommended_loan_structure: "Extended 72",
                behavior_classification: behaviorClassification
            };
        }

        llmRes.risk_tier = current_risk_tier;

        /**
         * ✅ RESPONSE
         */
        return Response.json({
            success: true,
            insights: {
                ...llmRes,
                behaviorSignals,
                metrics: underwritingMetrics
            }
        });

    } catch (e) {
        console.error("Insight Engine Error:", e);

        return Response.json({
            success: false,
            error: e.message
        }, { status: 500 });
    }
}));