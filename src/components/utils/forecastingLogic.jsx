/**
 * FlowUp Hybrid Forecasting Engine (Client-Side)
 * -----------------------------------------------
 * Position-Based CSV Parser (ISO-8859-8 encoding)
 * DNA Algorithm: Asset Resilience + Weighted SES (70/30)
 * Safety Buffer: 12% Risk Management
 */

import { detectBankFromHeader, parseCSVRow } from './bankParsers';
import { runMonteCarlo } from './riskEngine';

// Safe number conversion utility
const toNum = (v) => parseFloat(v?.toString().replace(/[^\d.-]/g, '')) || 0;

/**
 * DNA Layer: Growth Engine Detection
 * Identifies recurring transfers to "Future Self" (Savings/Investments)
 */
const detectGrowthEngines = (transactions) => {
    let monthlySavingsVolume = 0;
    const SAVINGS_KEYWORDS = ['חיסכון', 'הפקדה', 'קרן השתלמות', 'קופת גמל', 'ניירות ערך', 'השקעות', 'פיקדון', 'pepper invest', 'savings', 'deposit'];
    
    // Filter for debits that match savings keywords
    const savingsTx = transactions.filter(t => 
        t.debit > 0 && SAVINGS_KEYWORDS.some(kw => (t.description || '').toLowerCase().includes(kw))
    );

    if (savingsTx.length > 0) {
        // Calculate average monthly savings
        const totalSavings = savingsTx.reduce((sum, t) => sum + t.debit, 0);
        // Approximation of months span
        const firstDate = transactions[transactions.length-1].date;
        const lastDate = transactions[0].date;
        const monthsSpan = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24 * 30));
        monthlySavingsVolume = totalSavings / monthsSpan;
    }

    return {
        isGrowthEngine: monthlySavingsVolume > 500, // Threshold for "Growth Engine" status
        monthlyVolume: monthlySavingsVolume
    };
};

/**
 * DNA Layer: Weighted SES (Simple Exponential Smoothing)
 * 70% Annual Trend (Long-term DNA)
 * 30% Recent Volatility (Last 14 Days - Master Prompt)
 */
const calculateWeightedSES = (allTransactions, totalDays) => {
    if (totalDays < 30) return 0;

    let allTimeCredit = 0;
    let allTimeDebit = 0;
    let recentCredit = 0;
    let recentDebit = 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 14); // Last 14 days (Master Prompt)

    allTransactions.forEach(tx => {
        // Annual / All Time
        allTimeCredit += tx.credit;
        allTimeDebit += tx.debit;

        // Recent (Last 14 Days)
        if (tx.date >= cutoffDate) {
            recentCredit += tx.credit;
            recentDebit += tx.debit;
        }
    });

    // Annual Average Daily Net
    const annualDailyNet = (allTimeCredit - allTimeDebit) / totalDays;

    // Recent Average Daily Net (approx 14 days)
    const recentDailyNet = (recentCredit - recentDebit) / 14;

    // Weighted Formula: 70% Annual, 30% Recent
    return (annualDailyNet * 0.7) + (recentDailyNet * 0.3);
};

export const processAndForecast = (inputData, assets = null) => {
    try {
        const allTransactions = [];
        const uniqueDates = new Set();
        let currentBalance = 0;
        
        // SUPPORT JSON INPUT (Array) or CSV (String)
        if (Array.isArray(inputData)) {
            // Open Finance JSON Mode
            inputData.forEach(tx => {
                const date = new Date(tx.date || tx.transaction_date);
                if (!isNaN(date.getTime())) {
                     // Normalize Object Structure
                     const amount = parseFloat(tx.amount || 0);
                     allTransactions.push({
                         date: date,
                         description: tx.description || tx.merchant_name || 'Transaction',
                         details: tx.category_id || '',
                         // Map Open Finance signed amount to Credit/Debit
                         debit: amount < 0 ? Math.abs(amount) : 0,
                         credit: amount > 0 ? amount : 0,
                         balance: parseFloat(tx.balance_after_transaction || tx.balance || 0)
                     });
                     uniqueDates.add(date.toDateString());
                     if (tx.balance_after_transaction !== undefined) currentBalance = parseFloat(tx.balance_after_transaction);
                     else if (tx.balance !== undefined) currentBalance = parseFloat(tx.balance);
                }
            });
             // Sort JSON data
             allTransactions.sort((a, b) => b.date - a.date);
             if (allTransactions.length > 0 && !currentBalance) {
                 // Fallback if no running balance in JSON
                 currentBalance = 0; // Or calculate from history if start balance known
             }
        } else if (typeof inputData === 'string') {
            // Legacy CSV Mode
            const lines = inputData.split('\n').filter(line => line.trim());
            if (lines.length < 2) return { error: "קובץ ריק או לא תקין" };

            // 1. Detect Header Row Dynamically
            let headers = [];
            let bankType = 'unknown';
            let delimiter = ',';
            let startRowIndex = 0;

            for (let i = 0; i < Math.min(lines.length, 20); i++) {
                const line = lines[i];
                const detectedType = detectBankFromHeader(line);
                
                if (detectedType !== 'unknown') {
                    bankType = detectedType;
                    delimiter = line.includes(';') ? ';' : ',';
                    headers = line.split(delimiter).map(h => h.trim().replace(/"/g, ''));
                    startRowIndex = i + 1;
                    break;
                }
            }
            
            if (bankType === 'unknown') {
                const line0 = lines[0];
                delimiter = line0.includes(';') ? ';' : ',';
                headers = line0.split(delimiter).map(h => h.trim().replace(/"/g, ''));
                bankType = 'universal'; 
            }

            let foundFirstDate = false;

            // 2. Parse Data
            for (let i = startRowIndex; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                if ((line.match(new RegExp(delimiter, "g")) || []).length < 3) continue;

                const dateRegex = /^"?(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}|\d{1,2}[-/.]\d{1,2}[-/.]\d{1,4})/;
                const startsWithDate = dateRegex.test(line);

                if (!foundFirstDate) {
                    if (startsWithDate) foundFirstDate = true;
                    else continue;
                }

                const row = line.split(delimiter).map(v => v.trim().replace(/"/g, ''));
                const parsed = parseCSVRow(row, headers, bankType);
                
                if (parsed) {
                    let transactionDate = null;
                    const dateStr = parsed.date;
                    if (dateStr.includes('/')) {
                        const parts = dateStr.split('/');
                        const day = parseInt(parts[0]);
                        const month = parseInt(parts[1]) - 1;
                        const year = parts[2].length === 4 ? parseInt(parts[2]) : 2000 + parseInt(parts[2]);
                        transactionDate = new Date(year, month, day);
                    } else {
                        transactionDate = new Date(dateStr);
                    }

                    if (transactionDate && !isNaN(transactionDate.getTime())) {
                        allTransactions.push({
                            date: transactionDate,
                            description: parsed.description || 'תנועה',
                            details: parsed.details || '',
                            debit: parsed.debit || 0,
                            credit: parsed.credit || 0,
                            balance: parsed.balance
                        });
                        uniqueDates.add(transactionDate.toDateString());
                    }
                    
                    if (parsed.balance) currentBalance = parsed.balance;
                }
            }
            allTransactions.sort((a, b) => b.date - a.date);
            if (allTransactions.length > 0) {
                currentBalance = allTransactions[0].balance;
            }
        } else {
             return { error: "Unsupported data format" };
        }

        allTransactions.sort((a, b) => b.date - a.date);
        
        if (allTransactions.length > 0) {
            currentBalance = allTransactions[0].balance;
        }

        // 3. DNA ANALYSIS
        const totalDays = Math.max(1, uniqueDates.size);
        
        // Growth Engine Detection
        const growthData = detectGrowthEngines(allTransactions);

        // Weighted SES Forecasting
        const hybridDaily = calculateWeightedSES(allTransactions, totalDays);

        // Calculate Totals for Display (Last Month Only)
        let fixedExpenses = 0;
        let flexExpenses = 0;
        
        // Simple Fixed/Flex classification for display
        if (allTransactions.length > 0) {
            const targetMonth = allTransactions[0].date.getMonth();
            const monthTransactions = allTransactions.filter(tx => tx.date.getMonth() === targetMonth);
            const FIXED_KEYWORDS = ['שכר דירה', 'משכנתא', 'ארנונה', 'חשמל', 'מים', 'ביטוח', 'נטפליקס', 'ספוטיפיי', 'אינטרנט'];
            
            monthTransactions.forEach(tx => {
                totalDebit += tx.debit;
                totalCredit += tx.credit;
                if (tx.debit > 0) {
                    const desc = (tx.description || '').toLowerCase();
                    if (FIXED_KEYWORDS.some(k => desc.includes(k))) fixedExpenses += tx.debit;
                    else flexExpenses += tx.debit;
                }
            });
        }

        // 4. Safe Forecast
        const rawForecast = currentBalance + (hybridDaily * 30);
        const safeForecast = rawForecast * 0.88; // 12% Buffer
        const projectedEOM = safeForecast;

        // 5. Avg Daily Spending (Burn Rate)
        let allTimeDebit = 0;
        allTransactions.forEach(t => allTimeDebit += t.debit);
        const avgDailySpending = allTimeDebit / totalDays;
        const monthlyBurnRate = avgDailySpending * 30;

        // 6. Break-Even / Survival Analysis
        let survivalMonths = 0;
        let totalLiquid = 0;
        if (assets) {
            totalLiquid = (assets.cash || 0) + (assets.etf || 0) + (assets.trainingFund || 0);
            // Assuming a standard new loan payment or 0 if not provided
            const newLoanPayment = 2000; 
            survivalMonths = totalLiquid / (monthlyBurnRate + newLoanPayment);
        }

        // 7. Determine Risk (Monte Carlo + Asset Resilience)
        const riskAssessment = runMonteCarlo(
            currentBalance, 
            allTransactions, 
            null, // Dynamic Anchors
            { survivalMonths, growthEngine: growthData, totalLiquid } // Pass DNA data (with Liquid Assets) to Risk Engine
        );
        
        // 8. Generate Forecast Graph
        const graphPoints = [];
        let runningBalance = currentBalance;
        for (let i = 0; i <= 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            graphPoints.push({
                date: date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }),
                balance: Math.round(runningBalance)
            });
            runningBalance += hybridDaily;
        }

        return {
            success: true,
            forecastTotal: Math.round(safeForecast - currentBalance),
            projectedEOM: Math.round(projectedEOM),
            currentBalance: Math.round(currentBalance),
            totalIncome: Math.round(totalCredit),
            totalExpenses: Math.round(totalDebit),
            riskStatus: riskAssessment.riskStatus,
            riskDay: riskAssessment.riskDay,
            rawScore: Math.round(rawForecast),
            avgDailySpending: Math.round(avgDailySpending),
            graphPoints,
            smartInsights: [], // Insights are now generated server-side for modularity
            expenseAnalysis: { 
                fixed: Math.round(fixedExpenses), 
                flex: Math.round(flexExpenses),
                taxPotential: 0
            },
            transactionCount: allTransactions.length,
            confidence: riskAssessment.confidence,
            riskReasoning: riskAssessment.reasoning,
            allTransactions: allTransactions,
            
            // DNA Metrics
            dna: {
                survivalMonths: Math.round(survivalMonths * 10) / 10,
                growthEngine: growthData.isGrowthEngine,
                monthlySavings: Math.round(growthData.monthlyVolume),
                resilienceScore: riskAssessment.resilienceScore
            }
        };

    } catch (error) {
        console.error('Forecasting error:', error);
        return { error: "שגיאה בעיבוד: " + error.message, success: false };
    }
};

export const calculateWhatIf = (baselineForecast, scenario) => {
    // Basic What-If implementation preserving baseline
    if (!baselineForecast || !baselineForecast.success) return baselineForecast;
    if (!scenario || scenario.type === 'reset') return { ...baselineForecast, whatIfApplied: false };

    const currentBalance = baselineForecast.currentBalance || 0;
    let simulatedIncome = 0;
    let simulatedExpense = 0;

    switch (scenario.type) {
        case 'expense': simulatedExpense = scenario.amount || 0; break;
        case 'income': simulatedIncome = scenario.amount || 0; break;
    }

    const adjustedBalance = currentBalance + simulatedIncome - simulatedExpense;
    const adjustedEOM = baselineForecast.projectedEOM + simulatedIncome - simulatedExpense;

    const adjustedGraphPoints = baselineForecast.graphPoints.map(p => ({
        ...p,
        balance: Math.round(p.balance + simulatedIncome - simulatedExpense)
    }));

    return {
        ...baselineForecast,
        currentBalance: Math.round(adjustedBalance),
        projectedEOM: Math.round(adjustedEOM),
        graphPoints: adjustedGraphPoints,
        whatIfApplied: true
    };
};

export const SystemInfo = {
    version: "2.0.0",
    type: "DNA Engine",
    engine: "Asset Resilience + Weighted SES",
    safetyBuffer: "12% Standard Deviation",
    privacy: "All calculations in-browser"
};