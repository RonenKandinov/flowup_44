import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json().catch(() => ({}));
        
        // 1. פרטי הלוואה
        const userId = body?.userId || "ronenk2424@gmail.com";
        const principal = Number(body?.principal || 50000);
        const baseRate = Number(body?.baseRate || 0.09);
        const collateralValue = Number(body?.collateralValue || principal);

        const API_ROOT = "https://api.open-finance.ai";
        const API_V2 = "https://api.open-finance.ai/v2";
        const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
        const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

        if (!API_KEY || !API_SECRET) {
            throw new Error("Missing Open Finance API keys");
        }

        // קבלת Access Token מ-Open Finance
        const tokenRes = await fetch(`${API_ROOT}/oauth/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, clientId: API_KEY, clientSecret: API_SECRET })
        });
        if (!tokenRes.ok) throw new Error("Auth Error");
        const { accessToken } = await tokenRes.json();

        // 2. משיכת נתונים: חשבונות (לנזילות) ועסקאות (להכנסות והוצאות)
        const accountsRes = await fetch(`${API_V2}/data/accounts`, { headers: { Authorization: `Bearer ${accessToken}` } });
        let liquidAssets = 0;
        if (accountsRes.ok) {
            const accData = await accountsRes.json();
            const accounts = accData.data || accData.items || [];
            accounts.forEach(acc => {
                let bal = Number(acc.availableBalance || acc.currentBalance || acc.balance?.amount || 0);
                if (bal > 0) liquidAssets += bal;
            });
        }

        const txRes = await fetch(`${API_V2}/data/transactions`, { headers: { Authorization: `Bearer ${accessToken}` } });
        const txData = await txRes.json();
        const transactions = txData.data || txData.items || [];

        let totalIncome = 0;
        let incomeMonths = new Set();
        const categoryExpenses = {};

        transactions.forEach(tx => {
            let amount = Number(tx.amount?.amount || tx.amount || 0);
            const ind = String(tx.creditDebitIndicator || tx.indicator || "").toUpperCase();
            if (ind === 'DBIT' || ind === 'DEBIT') amount = -Math.abs(amount);
            else if (ind === 'CRDT' || ind === 'CREDIT') amount = Math.abs(amount);
            else if (tx.credit !== undefined || tx.debit !== undefined) amount = (Number(tx.credit) || 0) - (Number(tx.debit) || 0);

            if (amount > 0) {
                 totalIncome += amount;
                 const date = tx.date?.valueDate || tx.creationDate || tx.transactionDate || new Date().toISOString();
                 incomeMonths.add(date.substring(0, 7));
            } else if (amount < 0) {
                const cat = (tx.category?.main || tx.categoryName || tx.category || "general").toLowerCase();
                if (!categoryExpenses[cat]) categoryExpenses[cat] = [];
                categoryExpenses[cat].push(Math.abs(amount));
            }
        });

        const monthsCount = Math.max(1, incomeMonths.size);
        const avgIncome = totalIncome / monthsCount;

        // 3. ניקוי הוצאות חריגות (> 2.5x ממוצע קטגוריה)
        let cleanTotalExpenses = 0;
        let fixedExpenses = 0;
        Object.entries(categoryExpenses).forEach(([cat, amounts]) => {
            const catAvg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
            const threshold = catAvg * 2.5; // חסם עליון לניקוי הוצאות חריגות
            const cleanAmounts = amounts.filter(a => a <= threshold);
            const catCleanTotal = cleanAmounts.reduce((a, b) => a + b, 0);
            cleanTotalExpenses += catCleanTotal;
            
            const fixedKeywords = ["housing", "loan", "insurance", "utilities", "הלוואה", "משכנתא", "ביטוח", "שכירות", "חשמל", "מים", "ארנונה", "תשלום קבוע"];
            if (fixedKeywords.some(k => cat.includes(k))) {
                fixedExpenses += catCleanTotal;
            }
        });
        
        const avgFixedExpenses = fixedExpenses / monthsCount;

        // 4. מטריצת 50 סימולציות (Grid Search)
        const terms = [24, 36, 48, 60, 72, 84];
        const downPaymentSteps = 10;
        const stepSize = liquidAssets / Math.max(1, downPaymentSteps - 1);
        
        let simulations = [];

        for (let t of terms) {
            for (let i = 0; i < downPaymentSteps; i++) {
                const dp = Math.min(liquidAssets, i * stepSize);
                const p = principal - dp;
                if (p <= 0) continue;

                // Risk-Based Pricing & Capacity matrix
                let r = baseRate;
                if (t >= 49 && t <= 72) r += 0.015;
                if (t >= 73) r += 0.025;
                if (dp / principal < 0.1) r += 0.01;

                const r_monthly = r / 12;
                // נוסחת שפיצר לחישוב PMT
                const pmt = (p * r_monthly) / (1 - Math.pow(1 + r_monthly, -t));
                // DTI עם התחייבויות קיימות
                const dti = avgIncome > 0 ? ((avgFixedExpenses + pmt) / avgIncome) * 100 : 100;
                // LTV 
                const ltv = (p / collateralValue) * 100;
                
                // Capacity to pay score
                const freeCashFlow = avgIncome - avgFixedExpenses - pmt;
                const capacityScore = freeCashFlow > 0 ? freeCashFlow / avgIncome : 0;

                simulations.push({ term: t, downPayment: dp, principal: p, pmt, dti, ltv, rate: r, freeCashFlow, capacityScore });
            }
        }

        if (simulations.length === 0) {
             throw new Error("No valid simulations could be generated (perhaps liquid assets > principal)");
        }

        // 5. בחירת 3 האסטרטגיות (Rescue Cards)
        let stratCashFlow = [...simulations].filter(s => s.freeCashFlow > 0).sort((a, b) => b.freeCashFlow - a.freeCashFlow)[0] || simulations[0];
        let stratExposure = [...simulations].sort((a, b) => (a.ltv + a.dti) - (b.ltv + b.dti))[0];
        let stratBehavioral = [...simulations].sort((a, b) => {
             const scoreA = Math.abs(a.dti - 35) + (a.ltv * 0.5) - (a.capacityScore * 100);
             const scoreB = Math.abs(b.dti - 35) + (b.ltv * 0.5) - (b.capacityScore * 100);
             return scoreA - scoreB;
        })[0] || simulations[0];

        const calculateScore = (strat) => {
            let score = 100;
            if (strat.dti > 45) score -= 30;
            if (strat.freeCashFlow < 1000) score -= 20;
            if (strat.ltv > 80) score -= 15;
            return score;
        };

        const scores = {
            cash_flow: calculateScore(stratCashFlow),
            exposure: calculateScore(stratExposure),
            behavioral: calculateScore(stratBehavioral)
        };
        const recommendedStrategyId = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);

        // 6. ניתוח התנהגותי (AI Advocate)
       const prompt = `CRITICAL INSTRUCTION:
You are a senior, decisive credit underwriter for a non-bank financing company making a firm approval recommendation.
You must assess the data and provide EXACTLY 3 sharp, professional bullet points for each strategy, explaining why it mitigates risk and makes the loan safe to approve. Focus on DTI, liquidity, and payment capacity.

Data:
Net Income: ${Math.round(avgIncome)} ILS
Fixed Debts: ${Math.round(avgFixedExpenses)} ILS
Liquid Assets (Buffer): ${Math.round(liquidAssets)} ILS

Strategies:
1. Cash Flow: Term ${stratCashFlow.term}m, DP ${Math.round(stratCashFlow.downPayment)}, PMT ${Math.round(stratCashFlow.pmt)}, DTI ${Math.round(stratCashFlow.dti)}%, LTV ${Math.round(stratCashFlow.ltv)}%
2. Exposure: Term ${stratExposure.term}m, DP ${Math.round(stratExposure.downPayment)}, PMT ${Math.round(stratExposure.pmt)}, DTI ${Math.round(stratExposure.dti)}%, LTV ${Math.round(stratExposure.ltv)}%
3. Behavioral: Term ${stratBehavioral.term}m, DP ${Math.round(stratBehavioral.downPayment)}, PMT ${Math.round(stratBehavioral.pmt)}, DTI ${Math.round(stratBehavioral.dti)}%, LTV ${Math.round(stratBehavioral.ltv)}%

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
            recommendedStrategyId,
            strategies: {
                cash_flow: { metrics: stratCashFlow, logic: llmRes.cash_flow },
                exposure: { metrics: stratExposure, logic: llmRes.exposure },
                behavioral: { metrics: stratBehavioral, logic: llmRes.behavioral }
            }
        });

    } catch (error) {
        console.error("DealRescuerEngine Error:", error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});