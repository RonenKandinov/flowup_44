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
        const incomeByMonth = {};

        transactions.forEach(tx => {
            let amount = Number(tx.amount?.amount || tx.amount || 0);
            const ind = String(tx.creditDebitIndicator || tx.indicator || "").toUpperCase();
            if (ind === 'DBIT' || ind === 'DEBIT') amount = -Math.abs(amount);
            else if (ind === 'CRDT' || ind === 'CREDIT') amount = Math.abs(amount);
            else if (tx.credit !== undefined || tx.debit !== undefined) amount = (Number(tx.credit) || 0) - (Number(tx.debit) || 0);

            if (amount > 0) {
                 totalIncome += amount;
                 const date = tx.date?.valueDate || tx.creationDate || tx.transactionDate || new Date().toISOString();
                 const monthStr = date.substring(0, 7);
                 incomeMonths.add(monthStr);
                 incomeByMonth[monthStr] = (incomeByMonth[monthStr] || 0) + amount;
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

        // --- Hybrid Decision Engine: Data Fusion & Conflict Resolution ---
        // 1. Mocked Credit Bureau Data & Penalty System
        const creditBureauData = {
            score: body?.bureauScore || 620,
            delinquencies: 1,
            creditUtilization: 0.75,
            recentNegativeEvents: 0
        };
        
        let bureauPenalty = 0;
        if (creditBureauData.score < 600) bureauPenalty += 40;
        if (creditBureauData.delinquencies > 0) bureauPenalty += 20;
        if (creditBureauData.creditUtilization > 0.8) bureauPenalty += 15;

        // 2. Open Banking Data metrics & Trend Analysis
        const avgMonthlyExpenses = cleanTotalExpenses / monthsCount;
        
        // Income trend analysis (last 3 vs prev 3)
        const sortedMonths = Object.keys(incomeByMonth).sort();
        let incomeTrend = "stable";
        if (sortedMonths.length >= 6) {
            const last3 = sortedMonths.slice(-3).reduce((sum, m) => sum + incomeByMonth[m], 0);
            const prev3 = sortedMonths.slice(-6, -3).reduce((sum, m) => sum + incomeByMonth[m], 0);
            if (last3 > prev3 * 1.1) incomeTrend = "up";
            else if (last3 < prev3 * 0.9) incomeTrend = "down";
        } else if (sortedMonths.length >= 2) {
            const last = incomeByMonth[sortedMonths[sortedMonths.length - 1]];
            const prev = incomeByMonth[sortedMonths[0]];
            if (last > prev * 1.1) incomeTrend = "up";
            else if (last < prev * 0.9) incomeTrend = "down";
        }

        const liquidityBufferDays = (liquidAssets > 0 && avgMonthlyExpenses > 0) ? (liquidAssets / (avgMonthlyExpenses / 30)) : 0;
        let liquidityClassification = "low";
        if (liquidityBufferDays > 60) liquidityClassification = "high";
        else if (liquidityBufferDays >= 30) liquidityClassification = "medium";

        const cashflowStress = avgIncome > 0 ? (avgMonthlyExpenses / avgIncome) : 1;

        // 3. Data Fusion Layer
        const bureauRiskLevel = creditBureauData.score >= 700 ? 'low' : (creditBureauData.score >= 600 ? 'medium' : 'high');
        const obStrength = (incomeTrend === "up" && cashflowStress < 0.8 && liquidityClassification !== "low") ? "strong" :
                           ((incomeTrend === "down" || cashflowStress > 0.9 || liquidityClassification === "low") ? "weak" : "medium");

        const data_sources = {
            bureau: creditBureauData.score >= 700 ? 'strong' : (creditBureauData.score >= 600 ? 'medium' : 'weak'),
            open_banking: obStrength,
            dominant_signal: (creditBureauData.score < 600 && obStrength === 'strong') ? 'open_banking' : 'bureau'
        };

        // 4. Conflict Resolution Logic
        let engineDecision = 'reject';
        let engineReasoning = [];
        let engineConfidence = 100;

        // Adjust confidence
        if (bureauRiskLevel === 'high' || bureauRiskLevel === 'medium') engineConfidence -= 15;
        if (cashflowStress > 0.8) engineConfidence -= 10;
        if (liquidityClassification === 'low') engineConfidence -= 10;

        if (bureauRiskLevel === 'high' && incomeTrend === 'up' && liquidityClassification !== 'low') {
            engineDecision = 'conditional';
            engineReasoning.push(`Bureau is weak (${creditBureauData.score}), but income is trending UP. Conditional approval allowed.`);
            engineReasoning.push(`Liquidity is ${liquidityClassification} (${Math.round(liquidityBufferDays)} days buffer).`);
            engineReasoning.push(`Cashflow stress is at ${(cashflowStress*100).toFixed(1)}%.`);
        } else if (bureauRiskLevel === 'low' && (incomeTrend === 'down' || cashflowStress > 0.9)) {
            engineDecision = 'conditional';
            engineReasoning.push(`Bureau is strong (${creditBureauData.score}), but cashflow is unstable (Stress: ${(cashflowStress*100).toFixed(1)}%, Trend: ${incomeTrend}). Reducing exposure.`);
            engineReasoning.push(`Liquidity is ${liquidityClassification}. Required to limit LTV/DTI.`);
        } else if (bureauRiskLevel === 'low' && obStrength === 'strong') {
            engineDecision = 'approve';
            engineReasoning.push(`Both Bureau and Open Banking signals are strong. Optimal business configurations enabled.`);
            engineReasoning.push(`Strong income trend and low cashflow stress (${(cashflowStress*100).toFixed(1)}%).`);
            engineReasoning.push(`Excellent liquidity buffer of ${Math.round(liquidityBufferDays)} days.`);
            engineConfidence = Math.min(100, engineConfidence + 10);
        } else if (bureauRiskLevel === 'high' && obStrength === 'weak') {
            engineDecision = 'reject';
            engineReasoning.push(`Both Bureau (${creditBureauData.score}) and Open Banking (Trend: ${incomeTrend}, Stress: ${(cashflowStress*100).toFixed(1)}%) are weak.`);
            engineReasoning.push(`Liquidity is ${liquidityClassification} (${Math.round(liquidityBufferDays)} days). Cannot mitigate risk.`);
        } else {
             engineDecision = 'conditional';
             engineReasoning.push(`Mixed signals: Bureau is ${data_sources.bureau}, Open Banking is ${data_sources.open_banking}.`);
             engineReasoning.push(`Cashflow stress: ${(cashflowStress*100).toFixed(1)}%, Trend: ${incomeTrend}.`);
             engineReasoning.push(`Proceeding with conditional approval prioritizing lower DTI/LTV.`);
        }
        
        let engineRiskLevel = engineDecision === 'approve' ? 'low' : (engineDecision === 'reject' ? 'high' : 'medium');

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

        // Apply Decision Engine Filter
        if (engineDecision === 'reject') {
            const strictSims = simulations.filter(s => s.dti <= 35 && s.ltv <= 60);
            if (strictSims.length > 0) simulations = strictSims;
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
            // Base penalties
            if (strat.dti > 45) score -= 30;
            if (strat.freeCashFlow < 1000) score -= 20;
            if (strat.ltv > 80) score -= 15;
            
            // Apply Bureau Penalty
            score -= bureauPenalty;
            
            // Apply Capacity & Liquidity
            score += (strat.capacityScore * 50); // rewarding better free cash flow
            if (liquidityClassification === 'high') score += 15;
            else if (liquidityClassification === 'low') score -= 15;
            
            // Integrate Hybrid Decision Engine logic into ranking
            if (engineDecision === 'conditional') {
                if (strat.ltv < 70) score += 15;
                if (strat.dti < 35) score += 15;
                if (strat.freeCashFlow > 1500) score += 10;
            } else if (engineDecision === 'approve') {
                if (strat.term >= 60) score += 20; // Allow longer term/profitability
            }

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

        const strategiesObj = {
            cash_flow: { metrics: stratCashFlow, logic: llmRes.cash_flow },
            exposure: { metrics: stratExposure, logic: llmRes.exposure },
            behavioral: { metrics: stratBehavioral, logic: llmRes.behavioral }
        };

        const recommendedStrat = strategiesObj[recommendedStrategyId].metrics;

        const decisionObject = {
            decision: engineDecision,
            recommended_terms: {
                term: recommendedStrat.term,
                down_payment: recommendedStrat.downPayment
            },
            confidence: engineConfidence,
            risk_level: engineRiskLevel,
            reasoning: engineReasoning,
            data_sources: data_sources,
            explanation: {
                why_approved: engineDecision !== 'reject' ? engineReasoning[0] : null,
                what_changed: engineDecision === 'conditional' && bureauRiskLevel === 'high' ? "Overrode weak bureau score due to strong open banking signals." : null
            }
        };

        return Response.json({
            success: true,
            recommendedStrategyId,
            decision_engine: decisionObject,
            strategies: strategiesObj
        });

    } catch (error) {
        console.error("DealRescuerEngine Error:", error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});