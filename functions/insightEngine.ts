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
2. Separate structural obligations from discretionary liquidity.
3. Identify underwriting justification for borderline approvals.
4. Detect structural financial fragility.
5. Suggest optimized loan structure (Standard / Balloon / Extended 72).
6. Produce analyst-ready justification language.

Do not perform financial calculations. Use the provided metrics.
Your tone must be professional, underwriting-focused, and risk-aware.
Never give consumer advice. Do not use consumer-style language like "money leaks" or "lifestyle tips".

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
                        structural_dti_commentary: { type: "string" },
                        behavioral_flexibility_margin: { type: "string" },
                        liquidity_cushion_assessment: { type: "string" },
                        recommended_loan_structure: { type: "string", description: "Standard / Balloon / Extended 72" },
                        approval_rationale: { type: "string" },
                        risk_flags: { type: "array", items: { type: "string" } }
                    },
                    required: [
                        "risk_tier",
                        "structural_dti_commentary",
                        "behavioral_flexibility_margin",
                        "liquidity_cushion_assessment",
                        "recommended_loan_structure",
                        "approval_rationale"
                    ]
                }
            });
        } catch (llmError) {
            console.error("LLM failed, using deterministic fallback", llmError);
            llmRes = {
                risk_tier: current_risk_tier === "High" ? "Red" : (current_risk_tier === "Medium" ? "Orange" : "Green"),
                structural_dti_commentary: `Structural DTI is currently at ${(structural_dti * 100).toFixed(1)}%.`,
                behavioral_flexibility_margin: `Adjusted DTI is ${(adjusted_dti * 100).toFixed(1)}%, indicating ${Math.max(0, 100 - (adjusted_dti * 100)).toFixed(1)}% flexibility.`,
                liquidity_cushion_assessment: `Estimated liquidity buffer is ${liquidity_buffer_months.toFixed(1)} months.`,
                recommended_loan_structure: current_risk_tier === "High" ? "Extended 72" : (current_risk_tier === "Medium" ? "Balloon" : "Standard"),
                approval_rationale: "Deterministic fallback applied due to analysis engine timeout. Metrics indicate standard processing.",
                risk_flags: current_risk_tier === "High" ? ["High Structural Load", "Stress DTI > 40%"] : []
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