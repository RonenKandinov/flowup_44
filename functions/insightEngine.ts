import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const inputMetrics = body?.metrics;

        if (!inputMetrics) {
            return Response.json({ success: false, error: "Valid metrics object required from Risk Core" });
        }

        // Translate the Risk Snapshot (from loanLogicV2) into the Underwriting Metrics structure
        const current_risk_tier = inputMetrics.score < 55 ? "High" : (inputMetrics.score < 80 ? "Medium" : "Low");
        
        const underwritingMetrics = {
            avg_monthly_income: inputMetrics.totalIncome || 0,
            avg_monthly_expenses: inputMetrics.totalExpenses || 0,
            structural_fixed_load: inputMetrics.fixedExpenses || 0,
            structural_dti: inputMetrics.dti || 0,
            adjusted_dti: inputMetrics.totalIncome > 0 ? Number(((inputMetrics.totalExpenses / inputMetrics.totalIncome) * 100).toFixed(1)) : 0,
            liquidity_buffer_months: inputMetrics.runway || 0,
            income_volatility: 0.15, // Currently fixed in legacy logic, could be derived if needed
            stress_dti_after_10pct_income_drop: inputMetrics.totalIncome > 0 ? Number(((inputMetrics.fixedExpenses / (inputMetrics.totalIncome * 0.9)) * 100).toFixed(1)) : 0,
            current_risk_tier
        };

        const prompt = `You are FlowUp AI Analyst.
You are not a budgeting assistant.
You are a senior credit risk analyst working for a B2B vehicle financing company.

Your job is to:
1. Evaluate real repayment capacity using the provided metrics.
2. Provide a VERY CONCISE executive summary in HEBREW for underwriting analysts (2-3 sentences max).
3. Identify underwriting justification for borderline approvals.
4. Detect structural financial fragility.
5. Suggest optimized loan structure (Standard / Balloon / Extended 72).

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

        // Ensure risk_flags exists
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