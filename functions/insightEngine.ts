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
Your goal is to write a Narrative Underwriting Report. Do not just list data; tell the story of the borrower's financial behavior.

THE STORY STRUCTURE:
1. THE CASH FLOW STORY: Is the borrower building wealth or eroding it? Compare the income stability vs. the "Lifestyle Burn". 
2. THE CAPACITY PIVOT: If the DTI is low but the score is Red, explain the "Invisibility of Risk" (e.g., low fixed costs but high discretionary leakage).
3. RESILIENCE FACTOR: How long can they survive a shock? Use the Liquidity Buffer to justify a "Safety Net".
4. THE FINAL VERDICT: A strategic business justification for the loan structure.

DATA CONTEXT:
${JSON.stringify(underwritingMetrics, null, 2)}

OUTPUT RULES:
- Language: Hebrew.
- Style: Executive Narrative. No bullet points within paragraphs.
- Format: 4 Paragraphs. Double line break between them.
- NO MARKDOWN. NO BOLD. NO ASTERISKS. 

EXPECTED TONE:
"הלקוח מציג פרופיל של ניצול הכנסה גבוה אך ללא צבירת הון..." vs "יציבות תזרימית מאפשרת ספיגת החזר חודשי נוסף למרות רמת הוצאות גמישה..."
`;

        let llmRes;
        try {
            llmRes = await base44.integrations.Core.InvokeLLM({
                prompt,
                response_json_schema: {
                    type: "object",
                    properties: {
                        narrative: { type: "string", description: "The 4-paragraph narrative underwriting report in Hebrew." },
                        recommended_loan_structure: { type: "string", description: "Standard / Balloon / Extended 72" },
                        risk_flags: { type: "array", items: { type: "string", description: "Short risk flag in Hebrew" } }
                    },
                    required: [
                        "narrative",
                        "recommended_loan_structure"
                    ]
                }
            });
        } catch (llmError) {
            console.error("LLM failed", llmError);
            return Response.json({ success: false, error: "Failed to generate insights from AI" }, { status: 500 });
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