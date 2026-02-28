import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const transactions = body?.transactions || [];

        if (!Array.isArray(transactions) || transactions.length === 0) {
            return Response.json({ success: false, error: "Valid transactions array required" });
        }

        const processedTransactions = transactions.slice(0, 150).map(t => {
            const amount = t.debit !== undefined ? -t.debit : (t.credit !== undefined ? t.credit : t.amount);
            return {
                date: t.date ? new Date(t.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                amount: amount,
                desc: String(t.description || ""),
            };
        });

        const prompt = `You are FlowUp AI Analyst.
You are not a budgeting assistant.
You are a senior credit risk analyst working for a vehicle financing company.

Your job is to:
1. Evaluate real repayment capacity (not cosmetic savings).
2. Separate structural obligations from discretionary liquidity.
3. Identify underwriting justification for borderline approvals.
4. Detect structural financial fragility.
5. Suggest optimized loan structure (standard / balloon / 72 months).
6. Estimate Adjusted DTI after behavioral optimization (max 30% lifestyle shift).
7. Quantify downside risk if income drops by 10%.
8. Produce analyst-ready justification language.

Your tone must be professional, underwriting-focused, and risk-aware.
Never give consumer advice.
Always speak in credit language:
- Debt Service Ratio (DSR)
- Liquidity Cushion
- Cash Flow Stability
- Volatility Index
- Structural Fixed Load
- Behavioral Flexibility Margin
- Risk Tier Migration (Red -> Orange -> Green)

Transactions:
${JSON.stringify(processedTransactions)}
`;

        const llmRes = await base44.integrations.Core.InvokeLLM({
            prompt,
            response_json_schema: {
                type: "object",
                properties: {
                    risk_assessment: { type: "string" },
                    structural_dti: { type: "number" },
                    adjusted_dti: { type: "number" },
                    behavioral_capacity: { type: "number" },
                    liquidity_buffer_months: { type: "number" },
                    volatility_score: { type: "number" },
                    recommended_structure: { type: "string" },
                    approval_rationale: { type: "string" },
                    risk_flags: { type: "array", items: { type: "string" } }
                },
                required: [
                    "risk_assessment",
                    "structural_dti",
                    "adjusted_dti",
                    "behavioral_capacity",
                    "liquidity_buffer_months",
                    "volatility_score",
                    "recommended_structure",
                    "approval_rationale",
                    "risk_flags"
                ]
            }
        });

        return Response.json({
            success: true,
            insights: llmRes
        });
    } catch (e) {
        console.error("insightEngine Error:", e);
        return Response.json({ success: false, error: e.message }, { status: 500 });
    }
});