import { createClientFromRequest } from 'npm:@base44/sdk@0.8.11';
import * as _ from 'npm:lodash@4.17.21';

// --- Configuration ---
const FIXED_CATEGORIES = ['housing', 'loans', 'mortgage', 'rent', 'utilities', 'insurance', 'transportation', 'tax'];
const SIMULATION_ITERATIONS = 500;
const SIMULATION_HORIZON_DAYS = 45;

export default Deno.serve(async (req) => {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    try {
        const base44 = createClientFromRequest(req);
        const { userId } = await req.json();

        if (!userId) {
            return Response.json({ error: "userId is required" }, { status: 400 });
        }

        // 1. Data Ingestion: Fetch Access Token
        const tokens = await base44.entities.OpenFinanceToken.filter({ user_id: userId }, '-created_date', 1);
        if (!tokens.length) {
             return Response.json({ error: "No Open Finance token found for user" }, { status: 404 });
        }
        const accessToken = tokens[0].access_token;

        // 2. Data Ingestion: Fetch Live Transactions
        const txRes = await fetch("https://api.open-finance.ai/v2/data/transactions", {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
        });
        
        if (!txRes.ok) {
             return Response.json({ error: "Failed to fetch transactions from Open Finance" }, { status: 502 });
        }
        
        const txData = await txRes.json();
        const rawTransactions = txData.data || txData.items || [];

        // 3. Financial Mapping & Metrics Calculation
        const { metrics, history, currentBalance } = processTransactions(rawTransactions);

        // 4. DNA Risk Engine (Monte Carlo + Weighted SES)
        const simulation = runMonteCarlo(currentBalance, history);

        // 5. Risk Assessment Logic
        const riskAnalysis = assessRisk(simulation);

        // 6. Response
        return Response.json({
            success: true,
            status: riskAnalysis.riskStatus,
            survivalRate: riskAnalysis.survivalRate,
            riskDay: riskAnalysis.riskDay,
            metrics: {
                totalIncome: metrics.totalIncome,
                fixedExpenses: metrics.fixedExpenses,
                lifestyleExpenses: metrics.lifestyleExpenses,
                dti: metrics.dti
            },
            analysis: {
                loanEligibility: riskAnalysis.riskStatus === 'GREEN',
                resilienceScore: riskAnalysis.survivalRate // Simple mapping for resilience
            }
        });

    } catch (error) {
        console.error("Underwriting Core Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

// --- Core Logic Helpers ---

function processTransactions(rawTransactions) {
    let totalIncome = 0;
    let fixedExpenses = 0;
    let lifestyleExpenses = 0;
    
    // Group by Day for History (DNA)
    const dailyNetFlow = {};
    const today = new Date();
    
    // We also need to estimate current balance if not provided, 
    // but typically we'd fetch balance endpoint. 
    // For this exercise, we assume a starting balance or sum of history?
    // The prompt implies "Fetch live transaction history...". 
    // Usually Open Finance has a /balances endpoint. 
    // Without it, we might simulate 'Current Balance' from the sum of all transactions? 
    // Or maybe the simulation starts from 0 relative change? 
    // Let's assume we sum all history to get a "Net Position" or use 0 as relative start.
    // However, "avoid a negative balance" implies we need an absolute balance.
    // I'll calculate a 'Running Balance' assuming the first transaction started at 0 
    // OR just use the sum of all transactions as the "Current Balance" proxy.
    let currentBalance = 0;

    rawTransactions.forEach(tx => {
        const amount = Number(tx.amount?.chargedAmount?.amount || 0);
        const dateStr = tx.date ? tx.date.split('T')[0] : null;
        const category = (tx.category?.main || "").toLowerCase();
        
        currentBalance += amount;

        // Metrics Aggregation
        if (amount > 0) {
            totalIncome += amount;
        } else {
            const absAmount = Math.abs(amount);
            if (FIXED_CATEGORIES.some(c => category.includes(c))) {
                fixedExpenses += absAmount;
            } else {
                lifestyleExpenses += absAmount;
            }
        }

        // Daily Aggregation for DNA
        if (dateStr) {
            dailyNetFlow[dateStr] = (dailyNetFlow[dateStr] || 0) + amount;
        }
    });

    const dti = totalIncome > 0 ? (fixedExpenses / totalIncome) * 100 : 0;

    // Convert daily flows to array for stats
    const history = Object.entries(dailyNetFlow)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    return {
        metrics: {
            totalIncome: Math.round(totalIncome),
            fixedExpenses: Math.round(fixedExpenses),
            lifestyleExpenses: Math.round(lifestyleExpenses),
            dti: parseFloat(dti.toFixed(2))
        },
        history,
        currentBalance
    };
}

function runMonteCarlo(startBalance, history) {
    if (history.length < 2) {
        // Not enough data for stats, return safe default
        return { survivalRate: 0, failureCounts: {} };
    }

    // --- Weighted SES Logic ---
    // 70% Annual Trend (Long Term Avg)
    // 30% Recent 14-Day Volatility (actually, logic usually combines Trend + Volatility for shock)
    
    // 1. Calculate Long Term Daily Average (Trend)
    const longTermAvg = _.meanBy(history, 'amount');

    // 2. Calculate Recent 14-Day Volatility (Std Dev)
    const recentHistory = history.slice(-14);
    const recentAvg = _.meanBy(recentHistory, 'amount');
    const recentVariance = _.meanBy(recentHistory, (d) => Math.pow(d.amount - recentAvg, 2));
    const recentVolatility = Math.sqrt(recentVariance);

    // Prompt: "Weighted SES... 70% annual trend, 30% recent... to generate... shocks"
    // Interpretation: The Drift component is weighted, the Noise is the volatility.
    // Let's use: Drift = (0.7 * LongTermAvg) + (0.3 * RecentAvg)
    // Note: This mixes the "Trend" signal.
    const weightedDrift = (0.7 * longTermAvg) + (0.3 * recentAvg);

    let failures = 0;
    const failureCounts = {}; // Key: Day index (1-45), Value: Count

    for (let i = 0; i < SIMULATION_ITERATIONS; i++) {
        let simBalance = startBalance;
        let failed = false;

        for (let day = 1; day <= SIMULATION_HORIZON_DAYS; day++) {
            // Generate Shock: Gaussian Random * Volatility
            const u1 = Math.random();
            const u2 = Math.random();
            const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2); // Box-Muller
            const shock = z * recentVolatility;

            // Step
            simBalance += weightedDrift + shock;

            if (simBalance < 0 && !failed) {
                failures++;
                failureCounts[day] = (failureCounts[day] || 0) + 1;
                failed = true;
                // We count the failure but continue or break? 
                // "how many paths avoid a negative balance" -> Once negative, the path fails.
                break; 
            }
        }
    }

    return {
        survivalRate: ((SIMULATION_ITERATIONS - failures) / SIMULATION_ITERATIONS) * 100,
        failureCounts
    };
}

function assessRisk(simulation) {
    const survival = simulation.survivalRate;
    let status = 'RED';

    if (survival > 95) status = 'GREEN';
    else if (survival > 75) status = 'ORANGE';
    else status = 'RED';

    // Risk Day: Mode of failure counts
    let riskDay = null;
    if (Object.keys(simulation.failureCounts).length > 0) {
        const sortedDays = Object.entries(simulation.failureCounts)
            .sort((a, b) => b[1] - a[1]); // Sort by count desc
        
        // Return the day number (1-45)
        riskDay = parseInt(sortedDays[0][0]);
    }

    return {
        riskStatus: status,
        survivalRate: survival,
        riskDay
    };
}