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

        // Calculate underwriting metrics
        let totalIncome = 0;
        let totalExpenses = 0;
        let fixedExpenses = 0;
        
        const FIXED_KEYWORDS = ['שכר דירה', 'משכנתא', 'ארנונה', 'חשמל', 'מים', 'גז', 'ביטוח', 'הלוואה'];
        
        processedTransactions.forEach(t => {
            if (t.amount > 0) {
                totalIncome += t.amount;
            } else {
                const expense = Math.abs(t.amount);
                totalExpenses += expense;
                if (FIXED_KEYWORDS.some(k => t.desc.includes(k))) {
                    fixedExpenses += expense;
                }
            }
        });

        const dates = processedTransactions.map(t => new Date(t.date).getTime()).filter(d => !isNaN(d));
        let monthsSpan = 1;
        if (dates.length > 0) {
            const minDate = Math.min(...dates);
            const maxDate = Math.max(...dates);
            monthsSpan = Math.max(1, (maxDate - minDate) / (1000 * 60 * 60 * 24 * 30));
        }

        const avg_monthly_income = totalIncome / monthsSpan;
        const avg_monthly_expenses = totalExpenses / monthsSpan;
        const structural_fixed_load = fixedExpenses / monthsSpan;
        
        const structural_dti = avg_monthly_income > 0 ? (structural_fixed_load / avg_monthly_income) : 0;
        const adjusted_dti = avg_monthly_income > 0 ? (avg_monthly_expenses / avg_monthly_income) : 0;
        const liquidity_buffer_months = avg_monthly_expenses > 0 ? ((totalIncome - totalExpenses) / avg_monthly_expenses) : 0;
        const stress_dti_after_10pct_income_drop = (avg_monthly_income * 0.9) > 0 ? (structural_fixed_load / (avg_monthly_income * 0.9)) : 0;
        const current_risk_tier = structural_dti > 0.4 ? "High" : (structural_dti > 0.25 ? "Medium" : "Low");

        const underwritingMetrics = {
            avg_monthly_income: Math.round(avg_monthly_income),
            avg_monthly_expenses: Math.round(avg_monthly_expenses),
            structural_fixed_load: Math.round(structural_fixed_load),
            structural_dti: Number((structural_dti * 100).toFixed(1)),
            adjusted_dti: Number((adjusted_dti * 100).toFixed(1)),
            liquidity_buffer_months: Number(liquidity_buffer_months.toFixed(1)),
            income_volatility: 0.15,
            stress_dti_after_10pct_income_drop: Number((stress_dti_after_10pct_income_drop * 100).toFixed(1)),
            current_risk_tier
        };

        const prompt = `You are FlowUp AI Analyst.
You are not a budgeting assistant.
You are a senior credit risk analyst working for a vehicle financing company.

Your job is to:
1. Evaluate real repayment capacity using the provided metrics.
2. Separate structural obligations from discretionary liquidity.
3. Identify underwriting justification for borderline approvals.
4. Detect structural financial fragility.
5. Suggest optimized loan structure (standard / balloon / 72 months).
6. Produce analyst-ready justification language.

Do not perform financial calculations. Use the provided metrics.
Your tone must be professional, underwriting-focused, and risk-aware.
Never give consumer advice. Do not use consumer-style language like "money leaks" or "lifestyle tips".

Underwriting Metrics:
${JSON.stringify(underwritingMetrics, null, 2)}
`;

        const llmRes = await base44.integrations.Core.InvokeLLM({
            prompt,
            response_json_schema: {
                type: "object",
                properties: {
                    risk_assessment: { type: "string" },
                    capacity_interpretation: { type: "string" },
                    stability_assessment: { type: "string" },
                    liquidity_analysis: { type: "string" },
                    recommended_structure: { type: "string" },
                    approval_rationale: { type: "string" },
                    risk_flags: { type: "array", items: { type: "string" } }
                },
                required: [
                    "risk_assessment",
                    "capacity_interpretation",
                    "stability_assessment",
                    "liquidity_analysis",
                    "recommended_structure",
                    "approval_rationale",
                    "risk_flags"
                ]
            }
        });

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