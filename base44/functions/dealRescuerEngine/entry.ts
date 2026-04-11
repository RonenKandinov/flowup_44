import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json().catch(() => ({}));
        
        // 1. פרטי הלוואה
        const principal = Number(body?.principal || 50000);
        const baseRate = Number(body?.baseRate || 0.09);
        const collateralValue = Number(body?.collateralValue || principal);

        // שימוש בנתונים ישירות מהבקשה במידה והם קיימים (כדי למנוע קריאות מיותרות ואיטיות ל-API)
        let avgIncome = body?.income;
        let liquidAssets = body?.liquidAssets;
        let avgFixedExpenses = body?.fixedExpenses;

        if (avgIncome === undefined || liquidAssets === undefined || avgFixedExpenses === undefined) {
            const userId = body?.userId || "ronenk2424@gmail.com";
            const API_ROOT = "https://api.open-finance.ai";
            const API_V2 = "https://api.open-finance.ai/v2";
            const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
            const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

            if (!API_KEY || !API_SECRET) {
                throw new Error("Missing Open Finance API keys");
            }

            const tokenRes = await fetch(`${API_ROOT}/oauth/token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, clientId: API_KEY, clientSecret: API_SECRET })
            });
            if (!tokenRes.ok) throw new Error("Auth Error");
            const { accessToken } = await tokenRes.json();

            const accountsRes = await fetch(`${API_V2}/data/accounts`, { headers: { Authorization: `Bearer ${accessToken}` } });
            liquidAssets = 0;
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

                const txDesc = String(tx?.description || tx?.details || "").toLowerCase();
                const category = (tx.category?.main || tx.categoryName || tx.category || "general").toLowerCase();

                const isPersonalIncome = amount > 0 && ["משכורת", "שכר", "salary", "payroll", "קצבה", "ביטוח לאומי", "פנסיה", "ילדים", "מלגה"].some(kw => category.includes(kw) || txDesc.includes(kw));
                const personalExpenseKeywords = ["סופר", "מסעדה", "ביגוד", "בילוי", "supermarket", "restaurant", "clothing", "entertainment", "wolts", "wolt", "תן ביס", "מכולת", "פארם", "קולנוע", "סרט"];
                const isPersonalExpense = amount < 0 && personalExpenseKeywords.some(kw => category.includes(kw) || txDesc.includes(kw));

                if (amount > 0 && !isPersonalIncome) {
                     totalIncome += amount;
                     const date = tx.date?.valueDate || tx.creationDate || tx.transactionDate || new Date().toISOString();
                     incomeMonths.add(date.substring(0, 7));
                } else if (amount < 0 && !isPersonalExpense) {
                    const cat = category + " | " + txDesc; // Group by more specific string to apply keywords better
                    if (!categoryExpenses[cat]) categoryExpenses[cat] = [];
                    categoryExpenses[cat].push(Math.abs(amount));
                }
            });

            const monthsCount = Math.max(1, incomeMonths.size);
            avgIncome = totalIncome / monthsCount;

            let cleanTotalExpenses = 0;
            let fixedExpensesSum = 0;
            Object.entries(categoryExpenses).forEach(([cat, amounts]) => {
                const catAvg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
                const threshold = catAvg * 2.5; 
                const cleanAmounts = amounts.filter(a => a <= threshold);
                const catCleanTotal = cleanAmounts.reduce((a, b) => a + b, 0);
                cleanTotalExpenses += catCleanTotal;
                
                const fixedKeywords = [
                    "housing", "loan", "insurance", "transportation", "utilities", "rent", "fixed", "commitment",
                    "mortgage", "lease", "subscription", "installment", "payment plan",
                    "supplier", "cloud", "software", "saas", "hosting", "office", "payroll", "salary",
                    "הלוואה", "משכנתא", "ביטוח", "שכירות", "דירה", "חיוב", "תשלום קבוע",
                    "מנוי", "ארנונה", "חשמל", "מים", "גז", "ועד בית", "טלפון", "אינטרנט",
                    "החזר", "תשלומים", "מס", "היטל", "אגרה", "מע\"מ", "מעמ", "ביטוח לאומי",
                    "ספק", "ענן", "תוכנה", "משרד", "משכורת", "שכר עבודה", "רואה חשבון", "ייעוץ", "פרסום", "שיווק", "גוגל", "פייסבוק"
                ];
                if (fixedKeywords.some(k => cat.includes(k))) {
                    fixedExpensesSum += catCleanTotal;
                }
            });
            
            avgFixedExpenses = fixedExpensesSum / monthsCount;
        }

        const liquidityMonths = avgFixedExpenses > 0 ? liquidAssets / avgFixedExpenses : 12;

        // 4. מטריצת סימולציות עם מגבלת מקדמה חכמה - לא משתמשים בכל העו"ש
        const terms = [24, 36, 48, 60, 72, 84];
        const downPaymentSteps = 10;
        const reserveMonths = 2;
        const reservedLiquidity = avgFixedExpenses * reserveMonths;
        const maxUsableDownPayment = Math.max(0, Math.min(liquidAssets * 0.6, liquidAssets - reservedLiquidity));
        const stepSize = maxUsableDownPayment / Math.max(1, downPaymentSteps - 1);
        
        let simulations = [];

        for (let t of terms) {
            for (let i = 0; i < downPaymentSteps; i++) {
                const dp = Math.min(maxUsableDownPayment, i * stepSize);
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
                // DSR עם התחייבויות קיימות
                const dsr = avgIncome > 0 ? ((avgFixedExpenses + pmt) / avgIncome) * 100 : 100;
                const dti = dsr; // Using interchangeably for backward compatibility
                // LTV 
                const ltv = (p / collateralValue) * 100;
                
                // Capacity to pay score
                const freeCashFlow = avgIncome - avgFixedExpenses - pmt;
                const capacityScore = freeCashFlow > 0 ? freeCashFlow / avgIncome : 0;

                if (dsr <= 100 && freeCashFlow > 0) {
                    simulations.push({ term: t, downPayment: dp, principal: p, pmt, dti, dsr, ltv, rate: r, freeCashFlow, capacityScore, liquidityMonths });
                }
            }
        }

        const isRejected = simulations.length === 0 || liquidityMonths < 2;

        if (isRejected) {
             return Response.json({
                 success: true,
                 isRejected: true,
                 recommendedStrategyId: null,
                 recommendedScore: 0,
                 strategies: {},
                 context: { avgIncome, avgFixedExpenses, liquidAssets, liquidityMonths }
             });
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
            let score = 100 - (Math.max(0, strat.dti - 30) * 1.5);
            if (strat.freeCashFlow > 2000) score += 5;
            else if (strat.freeCashFlow < 1000) score -= 15;
            if (strat.ltv > 80) score -= (strat.ltv - 80) * 0.5;
            score += (strat.capacityScore || 0) * 10;
            return Math.min(100, Math.max(0, Math.round(score)));
        };

        const scores = {
            cash_flow: calculateScore(stratCashFlow),
            exposure: calculateScore(stratExposure),
            behavioral: calculateScore(stratBehavioral)
        };
        const recommendedStrategyId = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
        const recommendedScore = scores[recommendedStrategyId];

        // 6. חזרה מיידית של המטריקות (נימוקי AI יבוצעו בנפרד)
        return Response.json({
            success: true,
            recommendedStrategyId,
            recommendedScore,
            strategies: {
                cash_flow: { metrics: stratCashFlow, score: scores.cash_flow },
                exposure: { metrics: stratExposure, score: scores.exposure },
                behavioral: { metrics: stratBehavioral, score: scores.behavioral }
            },
            context: {
                avgIncome,
                avgFixedExpenses,
                liquidAssets,
                liquidityMonths
            }
        });

    } catch (error) {
        console.error("DealRescuerEngine Error:", error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});