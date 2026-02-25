import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

// --- CONFIGURATION ---
const SCORING_WEIGHTS = {
    STABILITY: 0.35,
    SERVICEABILITY: 0.25,
    LIQUIDITY: 0.25,
    VOLATILITY: 0.15
};

// --- HELPER FUNCTIONS ---

/**
 * Calculates standard deviation of an array of numbers
 */
function getStandardDeviation(array) {
    if (array.length === 0) return 0;
    const n = array.length;
    const mean = array.reduce((a, b) => a + b, 0) / n;
    const variance = array.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
    return Math.sqrt(variance);
}

/**
 * Generates 12 months of mock transaction history for the pilot demo
 */
function generateMockHistory() {
    const history = [];
    const today = new Date();
    
    // Base figures with some randomization
    const baseIncome = 18500;
    const baseFixed = 6500;
    const baseFlexible = 4500;
    
    for (let i = 0; i < 12; i++) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        // Add some volatility
        const incomeVar = (Math.random() - 0.5) * 2000;
        const expenseVar = (Math.random() - 0.5) * 1500;
        
        const income = baseIncome + incomeVar;
        const fixed = baseFixed; // Fixed stays mostly fixed
        const flexible = baseFlexible + expenseVar;
        const totalExpenses = fixed + flexible;
        
        history.push({
            month: monthKey,
            income: Math.round(income),
            expenses: Math.round(totalExpenses),
            fixedExpenses: Math.round(fixed),
            flexibleExpenses: Math.round(flexible),
            netFlow: Math.round(income - totalExpenses)
        });
    }
    
    return history.sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Processes raw transactions into 12-month history buckets
 */
function calculateMonthlyHistory(transactions) {
    const months = {};
    const today = new Date();
    
    // Initialize last 12 months
    for(let i=0; i<12; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months[key] = { income: 0, expenses: 0, fixedExpenses: 0, netFlow: 0, flexibleExpenses: 0 };
    }

    transactions.forEach(tx => {
        // Handle nested structure from Open Finance
        const amountObj = tx.amount?.chargedAmount || tx.amount || 0;
        const amountVal = typeof amountObj === 'object' ? amountObj.amount : amountObj;
        const amount = Number(amountVal);
        
        const dateStr = tx.date || tx.bookingDate || tx.transactionDate || new Date().toISOString();
        const date = new Date(dateStr);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (months[monthKey]) {
            if (amount > 0) {
                months[monthKey].income += amount;
            } else {
                const absAmount = Math.abs(amount);
                months[monthKey].expenses += absAmount;
                
                // Categorization logic
                const cat = (tx.category?.main || tx.category || "").toLowerCase();
                const desc = (tx.description || "").toLowerCase();
                const isFixed = /rent|mortgage|insurance|loan|tax|subscription|bill|utilities/.test(cat + desc);
                
                if (isFixed) {
                    months[monthKey].fixedExpenses += absAmount;
                } else {
                    months[monthKey].flexibleExpenses += absAmount;
                }
            }
            months[monthKey].netFlow += amount;
        }
    });

    return Object.keys(months).sort().map(key => ({
        month: key,
        ...months[key]
    }));
}

// --- MAIN EDGE FUNCTION ---

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Data Ingestion (Mock or Real)
        // For the pilot, we default to the generated 12-month mock history
        // to ensure the algorithm has sufficient data to demonstrate value.
        // In prod, we would toggle this based on available OpenFinance data.
        
        const shouldUseMock = true; 
        let history = [];
        let liquidAssets = 45000; // Mock assets

        if (shouldUseMock) {
            history = generateMockHistory();
        } else {
            // ... Real OpenFinance fetching logic would go here ...
            // const rawTransactions = await fetchTransactions(...);
            // history = calculateMonthlyHistory(rawTransactions);
        }

        // 2. Feature Engineering
        const totals = history.reduce((acc, m) => ({
            income: acc.income + m.income,
            expenses: acc.expenses + m.expenses,
            fixedExpenses: acc.fixedExpenses + m.fixedExpenses,
            positiveMonths: acc.positiveMonths + (m.netFlow > 0 ? 1 : 0)
        }), { income: 0, expenses: 0, fixedExpenses: 0, positiveMonths: 0 });

        const avgIncome = totals.income / history.length;
        const avgExpenses = totals.expenses / history.length;
        const avgFixedExpenses = totals.fixedExpenses / history.length;

        const incomeVolatility = getStandardDeviation(history.map(m => m.income)) / (avgIncome || 1);
        
        // DTI Calculation
        const DTI = avgIncome > 0 ? avgFixedExpenses / avgIncome : 1;
        
        // Runway Calculation
        const runwayMonths = avgExpenses > 0 ? (liquidAssets / avgExpenses) : 12;

        // 3. Build Financial Resilience Score
        
        // Stability (35%)
        const positiveMonthsRatio = totals.positiveMonths / history.length;
        const scoreStability = positiveMonthsRatio * 100;

        // Serviceability (25%)
        const scoreServiceability = Math.max(0, 100 - (DTI * 100));

        // Liquidity (25%)
        // Cap at 6 months = 100 points
        const scoreLiquidity = Math.min((runwayMonths / 6) * 100, 100);

        // Volatility Adjustment (15%)
        const scoreVolatility = Math.max(0, 100 - (incomeVolatility * 100));

        let finalScore = (
            (SCORING_WEIGHTS.STABILITY * scoreStability) +
            (SCORING_WEIGHTS.SERVICEABILITY * scoreServiceability) +
            (SCORING_WEIGHTS.LIQUIDITY * scoreLiquidity) +
            (SCORING_WEIGHTS.VOLATILITY * scoreVolatility)
        );

        finalScore = Math.min(100, Math.max(0, Math.round(finalScore)));

        // 4. Risk Decision Logic & Hard Rules
        let riskStatus = "ORANGE";
        if (finalScore >= 80) riskStatus = "GREEN";
        else if (finalScore < 55) riskStatus = "RED";

        let forceRedReason = null;
        if (runwayMonths < 1) {
            riskStatus = "RED";
            forceRedReason = "Runway < 1 Month";
        } else if (DTI > 0.75) {
            riskStatus = "RED";
            forceRedReason = "DTI > 75%";
        }

        // 5. Deterministic Stress Test
        const stressResults = {
            scenarioA: (avgIncome * 0.8) - avgExpenses > 0, // Income -20%
            scenarioB: avgIncome - (avgExpenses * 1.15) > 0, // Expenses +15%
            scenarioC: liquidAssets > avgExpenses // Survive 1 month zero income
        };

        const passedScenarios = Object.values(stressResults).filter(r => r).length;
        let confidence = "Standard";
        
        // Pilot Logic: Downgrade on 2+ failures
        if (passedScenarios <= 1) {
            confidence = "Low - Downgrade Applied";
            if (riskStatus === "GREEN") riskStatus = "ORANGE";
            else if (riskStatus === "ORANGE") riskStatus = "RED";
        } else if (passedScenarios === 3) {
            confidence = "High";
        }

        // 6. Recommendation
        const recommendation = riskStatus === "GREEN" ? "Approve" 
            : riskStatus === "ORANGE" ? "Manual Review / Balloon" 
            : "Decline";

        // Construct standardized pilot report
        return Response.json({
            success: true,
            status: riskStatus, // Legacy support for dashboard
            riskDay: null, // Deprecated in new model
            report: {
                score: finalScore,
                status: riskStatus,
                decision: {
                    recommendation,
                    confidence,
                    forceRedReason
                },
                metrics: {
                    dti: Math.round(DTI * 100),
                    runwayMonths: parseFloat(runwayMonths.toFixed(1)),
                    stabilityIndex: Math.round(scoreStability),
                    volatilityIndex: Math.round(incomeVolatility * 100),
                    monthlyAverageIncome: Math.round(avgIncome),
                    monthlyAverageExpenses: Math.round(avgExpenses),
                    liquidAssets: liquidAssets
                },
                stressTest: {
                    passedCount: passedScenarios,
                    details: stressResults
                },
                history: history // Optional: send back history for charts
            },
            // Legacy metric mapping for existing frontend compatibility
            metrics: {
                totalIncome: Math.round(avgIncome),
                totalExpenses: Math.round(avgExpenses),
                fixedExpenses: Math.round(avgFixedExpenses),
                lifestyleExpenses: Math.round(avgExpenses - avgFixedExpenses),
                netCashFlow: Math.round(avgIncome - avgExpenses),
                liquidAssets: liquidAssets,
                score: finalScore,
                dti: Math.round(DTI * 100),
                runway: parseFloat(runwayMonths.toFixed(1))
            }
        });

    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});