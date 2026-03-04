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

        const current_risk_tier = inputMetrics.score < 55 ? "High" : (inputMetrics.score < 80 ? "Medium" : "Low");

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

        const prompt = `You are FlowUp AI Analyst.
You are not a budgeting assistant.
You are a senior credit risk analyst working for a B2B vehicle financing company.

Your task is to provide a "Decision Support Summary" for a peer analyst.
The goal is to validate the customer's repayment capacity and flag any risk mitigants.

ANALYTICAL PRIORITIES:
1. DSR (Debt Service Ratio) Validation: Evaluate DSR. If DSR > 40%, identify if the customer has a "Liquidity Buffer" (Runway) to compensate.
2. LTV (Loan to Value) Risk: Evaluate the collateral's coverage (assume standard vehicle LTV if not provided).
3. Transaction Hygiene (The "Red Flag" Scan): Note any high-risk lifestyle spending or lack thereof.
4. Income Quality: Distinguish between stable and irregular income based on volatility.

OUTPUT STRUCTURE FOR EXECUTIVE SUMMARY (Must be in HEBREW, use these exact bullet points):
- **סיכום כושר החזר (DSR)**: [Professional assessment of the ability to pay back]
- **ניתוח בטוחות (LTV)**: [Assessment of the loan-to-value ratio]
- **איכות הנתונים והיגיינה פיננסית**: [Reporting on any red flags or lack thereof]
- **הערת חתם (Mitigants)**: [Explain why the loan should be approved despite minor weaknesses, or why it should be rejected]

Do not perform financial calculations. Use the provided metrics.
Your tone must be professional, underwriting-focused, and risk-aware.
Crucially, all textual explanations, rationales, and summaries MUST be written in HEBREW.

Underwriting Metrics:
${JSON.stringify(underwritingMetrics, null, 2)}
`;

        let llmRes;
        try {
            llmRes = await base44.integrations.Core.InvokeLLM({
                prompt,
                response_json_schema: {
                    type: "object",
                    properties: {
                        risk_tier: { type: "string", description: "Red / Orange / Green" },
                        executive_summary: { type: "string", description: "A concise 2-3 sentence executive summary in Hebrew for the underwriter." },
                        recommended_loan_structure: { type: "string", description: "Standard / Balloon / Extended 72" },
                        risk_flags: { type: "array", items: { type: "string", description: "Short risk flag in Hebrew" } }
                    },
                    required: [
                        "risk_tier",
                        "executive_summary",
                        "recommended_loan_structure"
                    ]
                }
            });
        } catch (llmError) {
            console.error("LLM failed, using deterministic fallback", llmError);
            llmRes = {
                risk_tier: current_risk_tier === "High" ? "Red" : (current_risk_tier === "Medium" ? "Orange" : "Green"),
                executive_summary: `מרווח הגמישות עומד על ${Math.max(0, 100 - underwritingMetrics.adjusted_dti).toFixed(1)}%. כרית הנזילות המוערכת היא ${underwritingMetrics.liquidity_buffer_months} חודשים.`,
                recommended_loan_structure: current_risk_tier === "High" ? "Extended 72" : (current_risk_tier === "Medium" ? "Balloon" : "Standard"),
                risk_flags: current_risk_tier === "High" ? ["עומס מבני גבוה", "DTI בלחץ מעל 40%"] : []
            };
        }

        if (!llmRes.risk_flags) {
            llmRes.risk_flags = [];
        }

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