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

        const prompt = `You are FlowUp AI, a Senior Credit Underwriter. 
Write an EXTREMELY SHORT, direct, and "tachles" (bottom-line) underwriting summary.

DATA CONTEXT:
${JSON.stringify(underwritingMetrics, null, 2)}

OUTPUT RULES:
- Language: Hebrew.
- Tone: Direct, sharp, executive (no fluff, no long explanations).
- Format: EXACTLY ONE SHORT PARAGRAPH. Maximum 3 to 4 sentences total (around 40-50 words max).
- Content: Quickly state the cash flow trend (income vs expenses), the real risk (DTI + discretionary spending), the resilience (liquidity buffer), and the final loan structure recommendation.
- NO MARKDOWN. NO BOLD. NO ASTERISKS.
- Ensure the recommended loan structure logically matches the narrative you write.
`;

        let llmRes;
        try {
            llmRes = await base44.integrations.Core.InvokeLLM({
                prompt,
                response_json_schema: {
                    type: "object",
                    properties: {
                        narrative: { type: "string", description: "A single, concise paragraph narrative underwriting report in Hebrew." },
                        recommended_loan_structure: { type: "string", description: "Standard / Balloon / Extended 72" }
                    },
                    required: [
                        "narrative",
                        "recommended_loan_structure"
                    ]
                }
            });
        } catch (llmError) {
            console.error("LLM failed, using deterministic fallback", llmError);
            llmRes = {
                narrative: `הלקוח מציג יחס החזר (DTI) של ${underwritingMetrics.adjusted_dti}%, עם כרית נזילות המספיקה ל-${underwritingMetrics.liquidity_buffer_months} חודשים. לאור רמת הסיכון (${current_risk_tier}), המלצת המערכת היא למבנה הלוואה ${current_risk_tier === "Red" ? "Extended 72" : (current_risk_tier === "Orange" ? "Balloon" : "Standard")}.`,
                recommended_loan_structure: current_risk_tier === "Red" ? "Extended 72" : (current_risk_tier === "Orange" ? "Balloon" : "Standard")
            };
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