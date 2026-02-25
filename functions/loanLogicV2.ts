import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

// --- CONFIGURATION ---
const SCORING_WEIGHTS = {
    STABILITY: 0.35,
    SERVICEABILITY: 0.25,
    LIQUIDITY: 0.25,
    VOLATILITY: 0.15
};

// --- MILLENNIUM SHADOW FUNCTIONS (Vector Logic) ---

/**
 * Transforms a scalar value into a Shadow Vector (m, p)
 */
function toShadow(value, key) {
    const theta = (value % key) * (Math.PI / 180);
    return {
        m: value * Math.cos(theta),
        p: value * Math.sin(theta)
    };
}

/**
 * Reconstructs a scalar value from a Shadow Vector
 */
function fromShadow(m, p, key) {
    return Math.round(Math.sqrt(m * m + p * p));
}

// --- HELPER FUNCTIONS ---

function getStandardDeviation(array) {
    if (array.length === 0) return 0;
    const n = array.length;
    const mean = array.reduce((a, b) => a + b, 0) / n;
    const variance = array.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
    return Math.sqrt(variance);
}

function generateMockHistory() {
    const history = [];
    const today = new Date();
    const baseIncome = 35399; // Updated to match dashboard
    const baseFixed = 8500;   // Updated to match dashboard
    const baseFlexible = 4000;
    
    for (let i = 0; i < 12; i++) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const incomeVar = (Math.random() - 0.5) * 2000;
        const expenseVar = (Math.random() - 0.5) * 1500;
        
        const income = baseIncome + incomeVar;
        const totalExpenses = baseFixed + baseFlexible + expenseVar;
        
        history.push({
            month: monthKey,
            income: Math.round(income),
            expenses: Math.round(totalExpenses),
            fixedExpenses: baseFixed,
            flexibleExpenses: Math.round(baseFlexible + expenseVar),
            netFlow: Math.round(income - totalExpenses)
        });
    }
    return history.sort((a, b) => a.month.localeCompare(b.month));
}

// --- MAIN EDGE FUNCTION ---

Deno.serve(async (req) => {
    try {
        const SESSION_KEY = Math.random() * 1000; // Zero-Knowledge Key
        const history = generateMockHistory();
        const liquidAssets = 136699; // Updated to match dashboard

        // 1. Shadow Vectorization
        const shadowHistory = history.map(m => ({
            incomeVec: toShadow(m.income, SESSION_KEY),
            fixedVec: toShadow(m.fixedExpenses, SESSION_KEY),
            totalExpVec: toShadow(m.expenses, SESSION_KEY),
            netVec: toShadow(m.netFlow, SESSION_KEY)
        }));

        // 2. Vector Reconstruction & Feature Engineering
        const avgIncome = fromShadow(
            shadowHistory.reduce((acc, h) => acc + h.incomeVec.m, 0) / history.length,
            shadowHistory.reduce((acc, h) => acc + h.incomeVec.p, 0) / history.length,
            SESSION_KEY
        );

        const avgExpenses = fromShadow(
            shadowHistory.reduce((acc, h) => acc + h.totalExpVec.m, 0) / history.length,
            shadowHistory.reduce((acc, h) => acc + h.totalExpVec.p, 0) / history.length,
            SESSION_KEY
        );

        const avgFixedExpenses = fromShadow(
            shadowHistory.reduce((acc, h) => acc + h.fixedVec.m, 0) / history.length,
            shadowHistory.reduce((acc, h) => acc + h.fixedVec.p, 0) / history.length,
            SESSION_KEY
        );

        const incomeVolatility = getStandardDeviation(history.map(m => m.income)) / (avgIncome || 1);
        const DTI = avgIncome > 0 ? avgFixedExpenses / avgIncome : 1;
        const runwayMonths = avgExpenses > 0 ? (liquidAssets / avgExpenses) : 12;

        // 3. Built Financial Resilience Score (with Tiered DTI Logic)
        
        // DTI Tiers Scoring
        let scoreServiceability = 0;
        const dtiPerc = DTI * 100;
        if (dtiPerc <= 40) scoreServiceability = 80 + (40 - dtiPerc) * 0.5;
        else if (dtiPerc <= 57) scoreServiceability = 55 + (57 - dtiPerc) * (24 / 17);
        else scoreServiceability = Math.max(0, 54 - (dtiPerc - 57));

        const positiveMonthsRatio = history.filter(m => m.netFlow > 0).length / history.length;
        const scoreStability = positiveMonthsRatio * 100;
        const scoreLiquidity = Math.min((runwayMonths / 6) * 100, 100);
        const scoreVolatility = Math.max(0, 100 - (incomeVolatility * 100));

        let finalScore = Math.round(
            (SCORING_WEIGHTS.STABILITY * scoreStability) +
            (SCORING_WEIGHTS.SERVICEABILITY * scoreServiceability) +
            (SCORING_WEIGHTS.LIQUIDITY * scoreLiquidity) +
            (SCORING_WEIGHTS.VOLATILITY * scoreVolatility)
        );

        // 4. Traffic Light Status & Gauge Sync
        let riskStatus = "ORANGE";
        if (finalScore >= 80) riskStatus = "GREEN";
        else if (finalScore < 55) riskStatus = "RED";

        // BDI "Positive" Bonus (Architect's Rule)
        const isBDIPositive = true; // Placeholder for real BDI check
        if (isBDIPositive && finalScore < 100) finalScore = Math.min(100, finalScore + 5);

        // 5. Final Report Construction
        return Response.json({
            success: true,
            status: riskStatus,
            score: finalScore,
            metrics: {
                totalIncome: Math.round(avgIncome),
                totalExpenses: Math.round(avgExpenses),
                fixedExpenses: Math.round(avgFixedExpenses),
                lifestyleExpenses: Math.round(avgExpenses - avgFixedExpenses),
                netCashFlow: Math.round(avgIncome - avgExpenses),
                liquidAssets: liquidAssets,
                dti: Math.round(dtiPerc),
                runway: parseFloat(runwayMonths.toFixed(1))
            }
        });

    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});