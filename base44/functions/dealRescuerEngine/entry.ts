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
        const terms = [24, 36, 48, 60, 72];
        const downPaymentSteps = 10;
        const stepSize = liquidAssets / Math.max(1, downPaymentSteps - 1);
        
        let simulations = [];

        for (let t of terms) {
            for (let i = 0; i < downPaymentSteps; i++) {
                const dp = Math.min(liquidAssets, i * stepSize);
                const p = principal - dp;
                if (p <= 0) continue;

                // Risk-Based Pricing
                let r = baseRate;
                if (t >= 49 && t <= 72) r += 0.015;
                if (t >= 73) r += 0.025;

                const r_monthly = r / 12;
                // נוסחת שפיצר לחישוב PMT
                const pmt = (p * r_monthly) / (1 - Math.pow(1 + r_monthly, -t));
                // DTI עם התחייבויות קיימות
                const dti = avgIncome > 0 ? ((avgFixedExpenses + pmt) / avgIncome) * 100 : 100;
                // LTV 
                const ltv = (p / collateralValue) * 100;

                simulations.push({ term: t, downPayment: dp, principal: p, pmt, dti, ltv, rate: r });
            }
        }

        if (simulations.length === 0) {
             throw new Error("No valid simulations could be generated (perhaps liquid assets > principal)");
        }

        // 5. בחירת 3 האסטרטגיות (Rescue Cards)
        // התאמת יכולת החזר - DTI מינימלי
        let stratCashFlow = [...simulations].sort((a, b) => a.dti - b.dti)[0];
        
        // הפחתת חשיפה - LTV מינימלי
        let stratExposure = [...simulations].sort((a, b) => a.ltv - b.ltv)[0];
        
        // אישור התנהגותי - הלוואה מאוזנת של 60 חודש שמתקרבת ליעד DTI של 35%
        let stratBehavioral = [...simulations].filter(s => s.term === 60).sort((a, b) => Math.abs(a.dti - 35) - Math.abs(b.dti - 35))[0] || simulations[0];

        // 6. ניתוח התנהגותי (AI Advocate)
       const prompt = `CRITICAL INSTRUCTION:
You are a senior, aggressive credit underwriter. Your job is to justify why the computed loan structure is safe to approve[cite: 3, 13].
DO NOT write generic paragraphs. DO NOT write "פריסה קצרה מקטינה תשלום" if the term is short (short terms INCREASE monthly payments but reduce risk). 

You MUST output the justification for each strategy using EXACTLY 3 bullet points. 
Start each bullet point with the 🟢 emoji, and separate them with a newline character (\\n).
You MUST include the specific DTI, PMT, and Income numbers in the text.

Client Data Context:
Net Income: ${Math.round(avgIncome)} ILS
Fixed Debts: ${Math.round(avgFixedExpenses)} ILS
Liquid Assets (Buffer): ${Math.round(liquidAssets)} ILS

Strategies to justify:
1. cash_flow: Term ${stratCashFlow.term}m, DP ${Math.round(stratCashFlow.downPayment)} ILS, PMT ${Math.round(stratCashFlow.pmt)} ILS, DTI ${Math.round(stratCashFlow.dti)}%
2. exposure: Term ${stratExposure.term}m, DP ${Math.round(stratExposure.downPayment)} ILS, PMT ${Math.round(stratExposure.pmt)} ILS, DTI ${Math.round(stratExposure.dti)}%, LTV ${Math.round(stratExposure.ltv)}%
3. behavioral: Term ${stratBehavioral.term}m, DP ${Math.round(stratBehavioral.downPayment)} ILS, PMT ${Math.round(stratBehavioral.pmt)} ILS, DTI ${Math.round(stratBehavioral.dti)}%

Output EXACTLY this JSON structure. Follow this text pattern for the values:
{
  "cash_flow": " התאמת תזרים: פריסה ל-${stratCashFlow.term} חודשים מעמידה את ההחזר על ${Math.round(stratCashFlow.pmt)} ₪.\\n🟢 יחס החזר (DTI): הלקוח מתייצב על יחס אשראי בטוח של ${Math.round(stratCashFlow.dti)}% מהכנסתו הפנויה.\\n🟢 שורת חתם: העסקה מאושרת. הנטל החודשי תואם את יכולת ההחזר האמיתית.",
  "exposure": " הפחתת LTV: דרישת מקדמה של ${Math.round(stratExposure.downPayment)} ₪ מתוך הנזילות הקיימת מקטינה את קרן ההלוואה.\\n🟢  הקטנת סיכון: יחס החשיפה (LTV) יורד ל-${Math.round(stratExposure.ltv)}%, מה שמגן על החברה מירידת ערך הרכב.\\n🟢 שורת חתם: עסקה מגובה בביטחונות חזקים, מאושר לחיתום.",
  "behavioral": " ניקוי רעשים: הלקוח מציג הכנסה יציבה של ${Math.round(avgIncome)} ₪ בניטרול הוצאות חריגות.\\n איזון תזרימי: תשלום של ${Math.round(stratBehavioral.pmt)} ₪ שומר על DTI של ${Math.round(stratBehavioral.dti)}%.\\n🟢 שורת חתם: התנהלות היסטורית תקינה מאפשרת אישור בתנאים אלו."
}`;
        const llmRes = await base44.integrations.Core.InvokeLLM({
            prompt,
            model: "gpt_5_mini", // Using a faster model for quicker generation
            response_json_schema: {
                type: "object",
                properties: {
                    cash_flow: { type: "string" },
                    exposure: { type: "string" },
                    behavioral: { type: "string" }
                },
                required: ["cash_flow", "exposure", "behavioral"]
            }
        });

        return Response.json({
            success: true,
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