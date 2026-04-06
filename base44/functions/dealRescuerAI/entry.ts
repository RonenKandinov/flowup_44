import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json();
        
        const { strategies, context } = body;
        
        const prompt = `CRITICAL INSTRUCTION:
You are a senior, decisive credit underwriter for a non-bank financing company making a firm approval recommendation.
You must assess the data and provide EXACTLY 3 sharp, professional bullet points for each strategy, explaining why it mitigates risk and makes the loan safe to approve. Focus on DTI, liquidity, and payment capacity.

Data:
Net Income: ${Math.round(context?.avgIncome || 0)} ILS
Fixed Debts: ${Math.round(context?.avgFixedExpenses || 0)} ILS
Liquid Assets (Buffer): ${Math.round(context?.liquidAssets || 0)} ILS

Strategies:
1. Cash Flow: Term ${strategies?.cash_flow?.metrics?.term || 0}m, DP ${Math.round(strategies?.cash_flow?.metrics?.downPayment || 0)}, PMT ${Math.round(strategies?.cash_flow?.metrics?.pmt || 0)}, DTI ${Math.round(strategies?.cash_flow?.metrics?.dti || 0)}%, LTV ${Math.round(strategies?.cash_flow?.metrics?.ltv || 0)}%
2. Exposure: Term ${strategies?.exposure?.metrics?.term || 0}m, DP ${Math.round(strategies?.exposure?.metrics?.downPayment || 0)}, PMT ${Math.round(strategies?.exposure?.metrics?.pmt || 0)}, DTI ${Math.round(strategies?.exposure?.metrics?.dti || 0)}%, LTV ${Math.round(strategies?.exposure?.metrics?.ltv || 0)}%
3. Behavioral: Term ${strategies?.behavioral?.metrics?.term || 0}m, DP ${Math.round(strategies?.behavioral?.metrics?.downPayment || 0)}, PMT ${Math.round(strategies?.behavioral?.metrics?.pmt || 0)}, DTI ${Math.round(strategies?.behavioral?.metrics?.dti || 0)}%, LTV ${Math.round(strategies?.behavioral?.metrics?.ltv || 0)}%

Output EXACTLY this JSON structure. For each strategy, provide EXACTLY 3 short, sharp bullet points (justifications in Hebrew). Do NOT write paragraphs.
{
  "cash_flow": { "bullets": ["נקודה 1...", "נקודה 2...", "נקודה 3..."] },
  "exposure": { "bullets": ["נקודה 1...", "נקודה 2...", "נקודה 3..."] },
  "behavioral": { "bullets": ["נקודה 1...", "נקודה 2...", "נקודה 3..."] }
}`;

        const llmRes = await base44.integrations.Core.InvokeLLM({
            prompt,
            model: "gpt_5_mini", // Fast model for low latency
            response_json_schema: {
                type: "object",
                properties: {
                    cash_flow: { type: "object", properties: { bullets: { type: "array", items: { type: "string" } } } },
                    exposure: { type: "object", properties: { bullets: { type: "array", items: { type: "string" } } } },
                    behavioral: { type: "object", properties: { bullets: { type: "array", items: { type: "string" } } } }
                },
                required: ["cash_flow", "exposure", "behavioral"]
            }
        });

        return Response.json({
            success: true,
            logic: llmRes
        });

    } catch (e) {
        console.error("DealRescuerAI Error:", e);
        return Response.json({ success: false, error: e.message }, { status: 500 });
    }
});