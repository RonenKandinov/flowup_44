// fup_underwriting_engine/index.ts

// --- Millennium Protocol Utilities (Shadow Realm) ---
const PRECISION_SCALE = 1000;
const ENTROPY_FACTOR = 1000000;

/**
 * הופך סכום גולמי לוקטור עיוור
 */
function toShadow(amount, key) {
    const normalized = amount / PRECISION_SCALE;
    const theta = (key * ENTROPY_FACTOR) % (2 * Math.PI);
    return { 
        m: normalized * Math.cos(theta), 
        p: normalized * Math.sin(theta) 
    };
}

/**
 * משחזר וקטור לסכום פיננסי גולמי (Recovery Layer)
 */
function fromShadow(m, p, key) {
    const theta = (key * ENTROPY_FACTOR) % (2 * Math.PI);
    const normalized = (m * Math.cos(theta)) + (p * Math.sin(theta));
    const amount = normalized * PRECISION_SCALE;
    return Math.round(amount * 100) / 100;
}

// --- Main Edge Function ---
Deno.serve(async (req) => {
    try {
        const API_ROOT = "https://api.open-finance.ai";
        const API_V2 = "https://api.open-finance.ai/v2";
        const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
        const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

        const body = await req.json();
        const userId = body?.userId || "ronenk2424@gmail.com";

        // 1. קבלת Access Token מ-Open Finance
        const tokenRes = await fetch(`${API_ROOT}/oauth/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, clientId: API_KEY, clientSecret: API_SECRET })
        });
        const { accessToken } = await tokenRes.json();

        // 2. שליפת עסקאות חיות
        const txRes = await fetch(`${API_V2}/data/transactions`, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
        });
        const txData = await txRes.json();
        const rawTransactions = txData?.data || txData?.items || [];
// --- הארכיטקט: שכבת נתונים מדומים (Standard Underwriting Report) ---
const mockTransactions = [
    { amount: { chargedAmount: { amount: 35399 } }, category: { main: "Salary" } },
    { amount: { chargedAmount: { amount: 1200 } }, category: { main: "Investment Dividends" } },
    { amount: { chargedAmount: { amount: 120000 } }, category: { main: "Liquid Assets" } }, // נכסים נזילים
    { amount: { chargedAmount: { amount: -8500 } }, category: { main: "Housing Rent" } },
    { amount: { chargedAmount: { amount: -2400 } }, category: { main: "Car Loan" } },
    { amount: { chargedAmount: { amount: -1500 } }, category: { main: "Utilities" } },
    { amount: { chargedAmount: { amount: -4000 } }, category: { main: "Groceries" } },
    { amount: { chargedAmount: { amount: -3500 } }, category: { main: "Leisure" } }
];

// החלפה לנתוני Mock לצורך כיול הדוח
const finalTransactions = mockTransactions;
        // --- Millennium Zero-Knowledge Integration ---
        const SESSION_KEY = Math.random() * 1000; 

        // 3. התמרה לוקטורים (Shadow Transformation)
        const vectors = rawTransactions.map(tx => {
            const amount = Number(tx?.amount?.chargedAmount?.amount || 0);
            return {
                m: toShadow(amount, SESSION_KEY).m,
                p: toShadow(amount, SESSION_KEY).p,
                type: amount > 0 ? 'income' : 'expense',
                category: (tx.category?.main || "").toLowerCase()
            };
        });

        // 4. ניתוח DNA וסימולציית Monte Carlo
        const dnaProfile = analyzeDNA(vectors, SESSION_KEY);
        const simulation = runMonteCarlo(vectors, dnaProfile, SESSION_KEY);

        // 5. הערכת סיכון סופית (מודל הרמזור)
        const riskAssessment = assessRisk(simulation);

        // 6. שחזור נתונים פיננסיים (Recovery) לתצוגה
        const recoveredMetrics = {
            totalIncome: fromShadow(dnaProfile.sums.incomeM, dnaProfile.sums.incomeP, SESSION_KEY),
            fixedExpenses: fromShadow(dnaProfile.sums.fixedM, dnaProfile.sums.fixedP, SESSION_KEY),
            lifestyleExpenses: fromShadow(dnaProfile.sums.flexM, dnaProfile.sums.flexP, SESSION_KEY),
            netCashFlow: fromShadow(dnaProfile.sums.totalM, dnaProfile.sums.totalP, SESSION_KEY)
        };

        // 7. שחזור עסקאות לתצוגה בדאשבורד (Sanitized)
        const displayTransactions = vectors.map(v => ({
            date: new Date().toISOString(), // Mock date as original dates weren't tracked in vector
            amount: fromShadow(v.m, v.p, SESSION_KEY) * (v.type === 'expense' ? -1 : 1),
            category: v.category,
            description: v.category // Description masked for privacy
        }));

        return Response.json({
            success: true,
            status: riskAssessment.riskStatus,
            survivalRate: Math.round(simulation.survivalRate),
            riskDay: riskAssessment.riskDay,
            metrics: recoveredMetrics,
            transactions: displayTransactions,
            analysis: {
                loanEligibility: riskAssessment.riskStatus === "GREEN",
                resilienceScore: dnaProfile.resilienceScore
            }
        });

    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});

// --- DNA & Risk Logic Functions ---

function analyzeDNA(vectors, key) {
    const sums = { 
        incomeM: 0, incomeP: 0, 
        fixedM: 0, fixedP: 0, 
        flexM: 0, flexP: 0, 
        totalM: 0, totalP: 0 
    };
    const FIXED_KEYWORDS = ["housing", "loan", "insurance", "transportation", "utilities"];

    vectors.forEach(v => {
        sums.totalM += v.m; sums.totalP += v.p;
        if (v.type === 'income') {
            sums.incomeM += v.m; sums.incomeP += v.p;
        } else {
            const isFixed = FIXED_KEYWORDS.some(k => v.category.includes(k));
            if (isFixed) {
                sums.fixedM += v.m; sums.fixedP += v.p;
            } else {
                sums.flexM += v.m; sums.flexP += v.p;
            }
        }
    });

    const amplitudes = vectors.map(v => Math.sqrt(v.m**2 + v.p**2));
    const mean = amplitudes.reduce((a, b) => a + b, 0) / Math.max(1, amplitudes.length);
    const volatility = Math.sqrt(amplitudes.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / Math.max(1, amplitudes.length));

    return { 
        sums, 
        volatility, 
        resilienceScore: Math.min((vectors.filter(v => v.type === 'income').length / 5) * 100, 100) 
    };
}

function runMonteCarlo(history, dna, key) {
    const ITERATIONS = 500;
    const HORIZON = 45;
    let failures = 0;
    let failureDays = {};

    for (let i = 0; i < ITERATIONS; i++) {
        let curM = dna.sums.totalM; 
        let curP = dna.sums.totalP;
        
        for (let d = 1; d <= HORIZON; d++) {
            const shock = (Math.random() - 0.5) * dna.volatility;
            curM += (shock / PRECISION_SCALE) * Math.cos(key);
            curP += (shock / PRECISION_SCALE) * Math.sin(key);

            if (fromShadow(curM, curP, key) < 0) {
                failures++;
                failureDays[d] = (failureDays[d] || 0) + 1;
                break;
            }
        }
    }
    return { 
        survivalRate: ((ITERATIONS - failures) / ITERATIONS) * 100, 
        failureDays 
    };
}

function assessRisk(sim) {
    const survival = sim.survivalRate;
    let status = 'RED';

    if (survival > 95) {
        status = 'GREEN';
    } else if (survival > 75) {
        status = 'ORANGE';
    }

    const failureEntries = Object.entries(sim.failureDays || {});
    const riskDayOffset = failureEntries.length > 0 
        ? failureEntries.sort((a, b) => b[1] - a[1])[0][0] 
        : null;

    return { 
        riskStatus: status, 
        survivalRate: survival, 
        riskDay: riskDayOffset 
    };
}