import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';
import { z } from 'npm:zod';

/**
 * ✅ Validation Middleware
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

            } catch {
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
         * ✅ SAFE DATA
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
        const history = Array.isArray(inputMetrics.history)
            ? inputMetrics.history.filter(h => typeof h.netFlow === "number")
            : [];

        /**
         * ✅ DERIVED
         */
        const liquidityMonths =
            totalIncome > 0 ? Number((liquidAssets / totalIncome).toFixed(1)) : 0;

        const expenseToIncome =
            totalIncome > 0
                ? Number(((totalExpenses / totalIncome) * 100).toFixed(1))
                : 0;

        let riskTier =
            score < 55 ? "Red" :
            score < 80 ? "Orange" : "Green";

        /**
         * 🔥 BEHAVIOR
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
                trends.income > 0 ? "UP" :
                trends.income < 0 ? "DOWN" : "STABLE"
        };

        /**
         * 🔥 RISK INTELLIGENCE
         */
        const isNegativeCashflow = expenseToIncome > 100;
        const isLowLiquidity = liquidityMonths < 1;
        const isHighDTI = dti > 45;
        const isDeteriorating = behaviorClassification === "DETERIORATING";

        let adjustedRisk = riskTier;

        if (
            (isNegativeCashflow && isDeteriorating) ||
            (isLowLiquidity && isDeteriorating)
        ) {
            adjustedRisk = "Red";
        }

        /**
         * 🧠 DECISION (Recommendation only!)
         */
        let recommendedDecision = "APPROVE";
        let confidence = "HIGH";

        if (adjustedRisk === "Red") {
            recommendedDecision = "DECLINE";
        } else if (
            isNegativeCashflow ||
            isLowLiquidity ||
            isHighDTI ||
            isDeteriorating
        ) {
            recommendedDecision = "REVIEW";
            confidence = "MEDIUM";
        }

        /**
         * 💰 OPTIONS (אנליסט בוחר!)
         */
        const options = [
            {
                decision: "APPROVE",
                max_loan_amount: Math.round(totalIncome * 10),
                suggested_interest: 6
            },
            {
                decision: "REVIEW",
                max_loan_amount: Math.round(totalIncome * 5),
                suggested_interest: 10
            },
            {
                decision: "DECLINE",
                max_loan_amount: 0,
                suggested_interest: null
            }
        ];

        /**
         * ⚠️ EXPLAINABILITY
         */
        const keyRisks = [];

        if (isNegativeCashflow) keyRisks.push("תזרים שלילי");
        if (isLowLiquidity) keyRisks.push("נזילות נמוכה");
        if (isHighDTI) keyRisks.push("יחס חוב להכנסה גבוה");
        if (isDeteriorating) keyRisks.push("מגמת הידרדרות");

        const mitigations = [];

        if (isNegativeCashflow) mitigations.push("הקטנת סכום ההלוואה");
        if (isLowLiquidity) mitigations.push("דרישת בטחונות");
        if (isDeteriorating) mitigations.push("פריסת תשלומים ארוכה יותר");

        /**
         * 🧠 LLM
         */
        const prompt = `
אתה אנליסט אשראי.

כתוב בעברית בלבד.

נתונים:
${JSON.stringify({ totalIncome, totalExpenses, trends, behaviorSignals })}

המלצת מערכת:
${recommendedDecision}

הסבר קצר (3 משפטים).
`;

        let llmRes;

        try {
            const llmPromise = base44.integrations.Core.InvokeLLM({
                prompt,
                response_json_schema: {
                    type: "object",
                    properties: {
                        narrative: { type: "string" }
                    },
                    required: ["narrative"]
                }
            });

            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("timeout")), 5000)
            );

            llmRes = await Promise.race([llmPromise, timeout]);

        } catch {
            llmRes = {
                narrative: "ניכרת מגמת הידרדרות בתזרים ועלייה בהוצאות לאורך התקופה."
            };
        }

        /**
         * ✅ RESPONSE
         */
        return Response.json({
            success: true,
            insights: {
                narrative: llmRes.narrative,
                behaviorSignals,
                risk_tier: adjustedRisk,
                metrics: {
                    totalIncome,
                    totalExpenses,
                    liquidAssets,
                    dti,
                    expense_to_income_ratio: expenseToIncome,
                    liquidity_months: liquidityMonths
                },
                analyst_recommendation: {
                    recommendation: {
                        decision: recommendedDecision,
                        confidence
                    },
                    options,
                    key_risks: keyRisks,
                    mitigations
                }
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