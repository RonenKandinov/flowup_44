/**
 * FlowUp Hybrid Forecasting Engine (Client-Side)
 * -----------------------------------------------
 * Position-Based CSV Parser (ISO-8859-8 encoding)
 * Hybrid Algorithm: Average Daily Net (70%) + Recent Trend (30%)
 * Safety Buffer: 12% Risk Management (multiply by 0.88)
 * Privacy: All calculations happen in-browser, no data sent to server
 */

import { detectBankFromHeader, parseCSVRow } from './bankParsers';
import { runAgents } from './insightAgents';
import { runMonteCarlo } from './riskEngine';

// Safe number conversion utility
const toNum = (v) => parseFloat(v?.toString().replace(/[^\d.-]/g, '')) || 0;

/**
 * Machine Learning Layer: Dynamic Anchor Detection
 * Identifies recurring "Fixed" expenses based on strict pattern recognition:
 * 1. Frequency: At least 3 occurrences
 * 2. Date Consistency: Same day of month (+/- 2 days)
 * 3. Amount Consistency: Exact same amount (+/- 1%)
 */
const detectDynamicAnchors = (transactions) => {
    const dynamicAnchors = new Set();
    if (!transactions || transactions.length < 3) return dynamicAnchors;

    const groups = {};
    
    // 1. Group by normalized description
    transactions.forEach(t => {
        if (t.debit <= 0) return;
        // Clean: remove dates, numbers, special chars to isolate the Merchant/Service Name
        const cleanName = t.description.toLowerCase().replace(/[0-9\/\-\.\,:\*#]/g, ' ').trim().replace(/\s+/g, ' ');
        if (cleanName.length < 2) return;

        if (!groups[cleanName]) groups[cleanName] = [];
        groups[cleanName].push(t);
    });

    // 2. Strict Classification Rules
    Object.entries(groups).forEach(([name, txs]) => {
        // Rule 1: Frequency >= 3
        if (txs.length < 3) return;

        // Rule 2: Amount Consistency (+/- 1%)
        const amounts = txs.map(t => t.debit);
        const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const isAmountConsistent = amounts.every(a => Math.abs(a - avgAmount) <= (avgAmount * 0.01));

        if (!isAmountConsistent) return;

        // Rule 3: Date Consistency (+/- 2 days)
        const days = txs.map(t => t.date.getDate());
        const avgDay = days.reduce((a, b) => a + b, 0) / days.length;
        
        // Check deviation from average (handled as linear distance for simplicity)
        const isDateConsistent = days.every(d => Math.abs(d - avgDay) <= 2);
        
        if (isDateConsistent) {
            dynamicAnchors.add(name);
        }
    });

    return dynamicAnchors;
};



export const processAndForecast = (csvText) => {
    try {
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            return { error: "קובץ ריק או לא תקין" };
        }

        // Improved Parsing using dedicated Bank Parsers
        const headerLine = lines[0];
        const bankType = detectBankFromHeader(headerLine);
        const delimiter = headerLine.includes(';') ? ';' : ',';
        const headers = headerLine.split(delimiter).map(h => h.trim().replace(/"/g, ''));

        let totalCredit = 0;
        let totalDebit = 0;
        let currentBalance = 0;
        let lastRowCredit = 0;
        let lastRowDebit = 0;
        const uniqueDates = new Set();
        const allTransactions = [];

        // Parse using robust parser
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const row = line.split(delimiter).map(v => v.trim().replace(/"/g, ''));
            const parsed = parseCSVRow(row, headers, bankType);
            
            if (parsed) {
                // Parse date
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
                        details: parsed.details || '', // Capture details from parser
                        debit: parsed.debit || 0,
                        credit: parsed.credit || 0,
                        balance: parsed.balance
                    });
                    uniqueDates.add(transactionDate.toDateString());
                }
                
                // Track latest balance (assuming file is sorted, but safe to update)
                if (parsed.balance) currentBalance = parsed.balance;
            }
        }

        // Sort transactions by date (descending)
        allTransactions.sort((a, b) => b.date - a.date);
        
        // Update currentBalance from most recent transaction if available
        if (allTransactions.length > 0) {
            currentBalance = allTransactions[0].balance;
            lastRowCredit = allTransactions[0].credit;
            lastRowDebit = allTransactions[0].debit;
        }

        // 1. Calculate All-Time Totals (for Forecasting)
        let allTimeCredit = 0;
        let allTimeDebit = 0;
        allTransactions.forEach(tx => {
            allTimeCredit += tx.credit;
            allTimeDebit += tx.debit;
        });

        // 2. Calculate Last Month Totals (for Dashboard Display)
        let uniqueDaysInTargetMonth = new Set();
        // Reset totals for the "Display" variables to ensure they only contain the target month
        totalCredit = 0; 
        totalDebit = 0;
        let fixedExpenses = 0;
        let flexExpenses = 0;

        // [ML] Run Dynamic Anchor Detection on full history
        const dynamicAnchors = detectDynamicAnchors(allTransactions);

        if (allTransactions.length > 0) {
            const mostRecentDate = allTransactions[0].date;
            const targetMonth = mostRecentDate.getMonth();
            const targetYear = mostRecentDate.getFullYear();

            // Filter for strictly the last month
            const monthTransactions = allTransactions.filter(tx => 
                tx.date.getMonth() === targetMonth && 
                tx.date.getFullYear() === targetYear
            );

            // Expanded list of Fixed Expenses (Anchors)
            const FIXED_KEYWORDS_LIST = [
                // Housing/Utilities
                'שכר דירה', 'משכנתא', 'ארנונה', 'חשמל', 'מים', 'גז', 'ועד בית',
                // Government/Fixed Bills
                'ביטוח לאומי', 'מס הכנסה', 'דו"ח', 'כביש 6',
                // Subscriptions
                'נפליקס', 'netflix', 'ספוטיפיי', 'spotify', 'אינטרנט', 'סלולר', 'הוט', 'yes',
                // Insurance/Finance
                'ביטוח', 'הראל', 'הפניקס', 'מנורה', 'כלל', 'עמלת'
            ];

            for (const tx of monthTransactions) {
                totalDebit += tx.debit;
                totalCredit += tx.credit;
                const dayKey = `${tx.date.getFullYear()}-${tx.date.getMonth()}-${tx.date.getDate()}`;
                uniqueDaysInTargetMonth.add(dayKey);

                // Calculate Fixed (Anchors) vs Flex (Variable)
                if (tx.debit > 0) {
                    const desc = (tx.description || '').toLowerCase();

                    // Normalize description for ML lookup
                    const cleanDesc = desc.replace(/[0-9\/\-\.\,:\*#]/g, ' ').trim().replace(/\s+/g, ' ');

                    // Hybrid Check: Hardcoded Dictionary OR Dynamic ML Pattern
                    const isFixed = FIXED_KEYWORDS_LIST.some(kw => desc.includes(kw.toLowerCase())) || dynamicAnchors.has(cleanDesc);

                    if (isFixed) {
                        fixedExpenses += tx.debit;
                    } else {
                        flexExpenses += tx.debit;
                    }
                }
            }
        }

        if (uniqueDates.size === 0) {
            return { error: "לא נמצאו עסקאות תקינות" };
        }

        // 2. HYBRID ALGORITHM
        const totalDays = uniqueDates.size;

        // Average Daily Net = (AllTimeCredit - AllTimeDebit) / TotalDays
        // We use All-Time data for the forecast trend to be more accurate and stable
        const avgDailyNet = (allTimeCredit - allTimeDebit) / totalDays;

        // Recent Trend = LastRow Credit - LastRow Debit
        const recentTrend = lastRowCredit - lastRowDebit;

        // Hybrid Daily = (AverageDailyNet * 0.7) + (RecentTrend * 0.3)
        const hybridDaily = (avgDailyNet * 0.7) + (recentTrend * 0.3);

        // 3. Safe Forecast with 12% Buffer
        const rawForecast = currentBalance + (hybridDaily * 30);
        const safeForecast = rawForecast * 0.88;
        const projectedEOM = safeForecast;

        // 4. Calculate daily spending (Avg Daily Spending based on Whole CSV)
        // We use All-Time Debit for the risk calculation to align with the "Whole CSV" requirement
        const avgDailySpending = allTimeDebit / totalDays;

        // 5. Determine risk status via Monte Carlo (Risk Agent)
        const riskAssessment = runMonteCarlo(currentBalance, allTransactions, dynamicAnchors);
        let { riskStatus, riskDay, confidence, reasoning } = riskAssessment;

        // 6. 10th of Month Checkpoint Logic (FlowUp Specific)
        const TARGET_DAY = 10;
        const CONSERVATISM = 0.88;

        // Helper: Get next occurrence of the 10th
        const getNextCheckpoint = () => {
            const d = new Date();
            if (d.getDate() >= TARGET_DAY) {
                d.setMonth(d.getMonth() + 1);
            }
            d.setDate(TARGET_DAY);
            return d;
        };

        // 1. Expected Salary (Income days 1-10)
        // Filter credits between day 1 and 10
        const incomeTxns = allTransactions.filter(t => t.credit > 0 && t.date.getDate() <= 10);
        const incomeByMonth = {};
        incomeTxns.forEach(t => {
            const key = `${t.date.getFullYear()}-${t.date.getMonth()}`;
            incomeByMonth[key] = (incomeByMonth[key] || 0) + t.credit;
        });
        const incomeValues = Object.values(incomeByMonth);
        const avgSalary = incomeValues.length > 0 
            ? incomeValues.reduce((a,b) => a+b, 0) / incomeValues.length 
            : 0;

        // 2. Expected Credit Charges (Debits on the 10th, +/- 1 day buffer)
        const creditChargeTxns = allTransactions.filter(t => t.debit > 0 && t.date.getDate() >= 9 && t.date.getDate() <= 11);
        const chargesByMonth = {};
        creditChargeTxns.forEach(t => {
             const key = `${t.date.getFullYear()}-${t.date.getMonth()}`;
             chargesByMonth[key] = (chargesByMonth[key] || 0) + t.debit;
        });
        const chargeValues = Object.values(chargesByMonth);
        const avgCreditCharge = chargeValues.length > 0
            ? chargeValues.reduce((a,b) => a+b, 0) / chargeValues.length
            : 0;

        // 3. Monthly Profit & Conservatism
        const monthlyProfit = avgSalary - avgCreditCharge;
        const conservativeProfit = monthlyProfit * CONSERVATISM;

        // 4. Projection: Current Balance + Conservative Profit
        const projection = currentBalance + conservativeProfit;

        const milestoneData = {
            projection: Math.round(projection),
            text: "יתרה צפויה לאחר מועד החיוב הקרוב (ה-10 לחודש)"
        };

        // 7. Generate AI Insights
        const smartInsights = runAgents(allTransactions);

        // 8. Generate forecast graph points & Smart Risk Day Detection
        const graphPoints = [];
        let runningBalance = currentBalance;
        let detectedRiskDate = null;

        for (let i = 0; i <= 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            const roundedBalance = Math.round(runningBalance);

            if (roundedBalance < 0 && !detectedRiskDate) {
                detectedRiskDate = date;
            }

            graphPoints.push({
                date: date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }),
                balance: roundedBalance
            });
            runningBalance += hybridDaily;
        }

        // Set Smart Risk Day (only if within 30 days)
        if (detectedRiskDate) {
           // We keep the Monte Carlo riskDay as the primary source of truth for the UI badges,
           // but if the deterministic forecast hits 0, we ensure status is at least yellow/red.
           // However, Monte Carlo is the "Risk Agent" authority now.
           // Let's defer to Monte Carlo, but maybe use this as a sanity check or "Immediate Threat".
        }

        return {
            success: true,
            forecastTotal: Math.round(safeForecast - currentBalance),
            projectedEOM: Math.round(projectedEOM),
            currentBalance: Math.round(currentBalance),
            totalIncome: Math.round(totalCredit),
            totalExpenses: Math.round(totalDebit),
            riskStatus,
            riskDay,
            rawScore: Math.round(rawForecast),
            avgDailySpending: Math.round(avgDailySpending),
            graphPoints,
            smartInsights, // Return AI insights
            milestoneData, // Return Milestone-Only forecast
            expenseAnalysis: { 
                fixed: Math.round(fixedExpenses), 
                flex: Math.round(flexExpenses),
                taxPotential: Math.round(smartInsights.filter(i => i.type === 'tax_refund').reduce((sum, i) => sum + (i.monthlySavings || 0), 0))
            }, // Future Cake Data
            transactionCount: allTransactions.length,
            confidence: confidence || (totalDays >= 30 ? "high" : totalDays >= 10 ? "medium" : "low"),
            riskReasoning: reasoning,
            allTransactions: allTransactions, // For What-If Simulator
            dynamicAnchors: Array.from(dynamicAnchors) // Convert Set to Array for Storage
            };

    } catch (error) {
        console.error('Forecasting error:', error);
        return { 
            error: "שגיאה בעיבוד: " + error.message,
            success: false
        };
    }
};

/**
 * Calculate What-If scenario impact with 12% Safety Buffer
 */
export const calculateWhatIf = (baselineForecast, scenario) => {
    if (!baselineForecast || !baselineForecast.success) {
        return baselineForecast;
    }

    if (!scenario || scenario.type === 'reset') {
        return {
            ...baselineForecast,
            whatIfApplied: false,
            riskTrend: null
        };
    }

    const currentBalance = baselineForecast.currentBalance || 0;
    const avgDailySpending = baselineForecast.avgDailySpending || 0;
    
    // Calculate adjusted balance based on scenario
    let simulatedIncome = 0;
    let simulatedExpense = 0;

    switch (scenario.type) {
        case 'expense':
            simulatedExpense = scenario.amount || 0;
            break;
        case 'income':
            simulatedIncome = scenario.amount || 0;
            break;
    }

    // 1. Calculate adjusted CURRENT balance (Immediate Liquidity)
    const adjustedCurrentBalance = currentBalance + simulatedIncome - simulatedExpense;

    // 2. Calculate adjusted PROJECTED balance (End of Month Forecast)
    // We start from the raw forecast (Current + Trend) to ensure we don't lose the predictive trend
    const originalRawForecast = baselineForecast.rawScore || (baselineForecast.projectedEOM / 0.88);
    const adjustedRawForecast = originalRawForecast + simulatedIncome - simulatedExpense;

    // Apply Safety Buffer (0.88) to the new total
    const newSafeBalance = adjustedRawForecast * 0.88;

    // Update graph points proportionally & Detect Smart Risk Day
    let detectedRiskDate = null;
    const adjustedGraphPoints = baselineForecast.graphPoints.map((point, index) => {
        const newBalance = Math.round(point.balance + simulatedIncome - simulatedExpense);

        // Check for first day dipping below zero
        if (newBalance < 0 && !detectedRiskDate) {
            // Reconstruct date from index (since we don't have the Date object directly in points, only string)
            const date = new Date();
            date.setDate(date.getDate() + index);
            detectedRiskDate = date;
        }

        return {
            ...point,
            balance: newBalance
        };
    });

    // Recalculate Risk using Monte Carlo (The Authority)
    let newRiskStatus = "green";
    let newRiskDay = null;
    let newConfidence = baselineForecast.confidence;
    let newReasoning = baselineForecast.riskReasoning;

    // Use Monte Carlo if data is available (Robust Check)
    if (baselineForecast.allTransactions) {
        const riskAssessment = runMonteCarlo(
            adjustedCurrentBalance, 
            baselineForecast.allTransactions, 
            baselineForecast.dynamicAnchors
        );
        newRiskStatus = riskAssessment.riskStatus;
        newRiskDay = riskAssessment.riskDay;
        newConfidence = riskAssessment.confidence;
        newReasoning = riskAssessment.reasoning;
    } else {
        // Fallback: Graph-based detection (Legacy/Safe Mode)
        if (newSafeBalance < 0 || detectedRiskDate) {
            newRiskStatus = "red";
            if (detectedRiskDate) {
                 newRiskDay = detectedRiskDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
            }
        } else if (newSafeBalance < 1500) {
            newRiskStatus = "yellow";
        }
    }

    let trend = null; // Deprecated trend logic

    // Adjust Milestone Data if exists (ensure consistency with display)
    let newMilestoneData = null;
    if (baselineForecast.milestoneData) {
        newMilestoneData = {
            ...baselineForecast.milestoneData,
            projection: Math.round(baselineForecast.milestoneData.projection + simulatedIncome - simulatedExpense)
        };
    }

    return {
        ...baselineForecast,
        currentBalance: Math.round(adjustedCurrentBalance),
        projectedEOM: Math.round(newSafeBalance),
        milestoneData: newMilestoneData || baselineForecast.milestoneData,
        riskStatus: newRiskStatus,
        riskDay: newRiskDay,
        riskDaysCount: daysUntilRisk,
        riskTrend: trend,
        graphPoints: adjustedGraphPoints,
        whatIfApplied: true,
        whatIfScenario: scenario
    };
};

/**
 * System Information
 */
export const SystemInfo = {
    version: "1.0.0",
    type: "Client-Side MVP",
    engine: "Hybrid SES + Seasonal Average",
    safetyBuffer: "12% Standard Deviation",
    privacy: "All calculations in-browser"
};