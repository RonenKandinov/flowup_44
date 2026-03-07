import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // auth.me() throws (not returns null) when unauthenticated in Deno context.
        // Catch it explicitly so auth errors return 401, not 500.
        let user;
        try {
            user = await base44.auth.me();
        } catch (_authErr) {
            return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        if (!user) {
            return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const inputMetrics = body?.metrics;

        if (!inputMetrics) {
            return Response.json({ success: false, error: "Valid metrics object required from Risk Core" });
        }

        // Translate the Risk Snapshot (from loanLogicV2) into the Underwriting Metrics structure.
        // Field name fix: frontend sends totalFixedExpenses (not fixedExpenses) and liquidAssets (not runway).
        const fixedExpenses = inputMetrics.totalFixedExpenses ?? inputMetrics.fixedExpenses ?? 0;
        const liquidAssets = inputMetrics.liquidAssets ?? 0;
        const totalIncome = inputMetrics.totalIncome || 0;
        const liquidityBufferMonths = totalIncome > 0 ? Number((liquidAssets / totalIncome).toFixed(1)) : 0;

        const current_risk_tier = inputMetrics.score < 55 ? "Red" : (inputMetrics.score < 80 ? "Orange" : "Green");

        const underwritingMetrics = {
            avg_monthly_income: totalIncome,
            avg_monthly_expenses: inputMetrics.totalExpenses || 0,
            structural_fixed_load: fixedExpenses,
            structural_dti: inputMetrics.dti || 0,
            adjusted_dti: totalIncome > 0 ? Number(((inputMetrics.totalExpenses / totalIncome) * 100).toFixed(1)) : 0,
            liquidity_buffer_months: liquidityBufferMonths,
            income_volatility: 0.15,
            stress_dti_after_10pct_income_drop: totalIncome > 0 ? Number(((fixedExpenses / (totalIncome * 0.9)) * 100).toFixed(1)) : 0,
            current_risk_tier
        };

        const prompt = `You are FlowUp AI, a Senior Underwriting Expert.
Your mission is to provide a "Decision Support Summary" for a credit analyst.

ANALYTICAL PRIORITIES:
1. SERVICEABILITY: Focus on income vs total expenses gap.
2. RESILIENCE: Highlight the Liquidity Buffer in months.
3. THE PIVOT: State exactly how much "Lifestyle" budget can be cut to fund the loan.

OUTPUT RULES:
- Language: Hebrew.
- Format: 4 distinct paragraphs with a blank line between them.
- NO asterisks (*), NO bolding (**), NO special characters. Plain text only.
- Round all numbers to the nearest whole number.
- Use a professional, decisive tone.

DATA CONTEXT:
${JSON.stringify(underwritingMetrics, null, 2)}

FORMAT FOR OUTPUT:
כושר החזר ואופטימיזציה: [ניתוח ברור של היכולת לעמוד בתשלום]

חסינות פיננסית: [ניתוח הנזילות והיציבות]

פרופיל סיכון: [דגשים על התנהלות חיובית או שלילית]

המלצת חתם (Bottom Line): [שורה תחתונה ברורה למקבלי החלטות]
`;

        let llmRes;
        try {
            llmRes = await base44.integrations.Core.InvokeLLM({
                prompt,
                response_json_schema: {
                    type: "object",
                    properties: {
                        executive_summary: { type: "string", description: "Extremely concise bullet-point summary in Hebrew." },
                        recommended_loan_structure: { type: "string", description: "Standard / Balloon / Extended 72" },
                        risk_flags: { type: "array", items: { type: "string", description: "Short risk flag in Hebrew" } }
                    },
                    required: [
                        "executive_summary",
                        "recommended_loan_structure"
                    ]
                }
            });
        } catch (llmError) {
            console.error("LLM failed, using deterministic fallback", llmError);
            llmRes = {
                executive_summary: `מרווח הגמישות עומד על ${Math.max(0, 100 - underwritingMetrics.adjusted_dti).toFixed(1)}%. כרית הנזילות המוערכת היא ${underwritingMetrics.liquidity_buffer_months} חודשים.`,
                recommended_loan_structure: current_risk_tier === "Red" ? "Extended 72" : (current_risk_tier === "Orange" ? "Balloon" : "Standard"),
                risk_flags: current_risk_tier === "Red" ? ["עומס מבני גבוה", "DTI בלחץ מעל 40%"] : []
            };
        }

        if (!llmRes.risk_flags) {
            llmRes.risk_flags = [];
        }
        
        // Force the risk tier to match the calculated score logic
        llmRes.risk_tier = current_risk_tier;

        return Response.json({
            success: true,
            insights: {
                ...llmRes,
                metrics: underwritingMetrics
            }
        });
    } catch (e) {
        console.error("insightEngine Error:", e);
        return Response.json({ success: false, error: e.message }, { status: 500 });
    }
});