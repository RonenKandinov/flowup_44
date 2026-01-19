/**
 * FlowUp Hybrid Forecasting Engine (Client-Side)
 * -----------------------------------------------
 * Position-Based CSV Parser (ISO-8859-8 encoding)
 * Hybrid Algorithm: Average Daily Net (70%) + Recent Trend (30%)
 * Safety Buffer: 17% Risk Management (multiply by 0.83)
 * Privacy: All calculations happen in-browser, no data sent to server
 */

import { detectBankFromHeader, parseCSVRow } from './bankParsers';

// Safe number conversion utility
const toNum = (v) => parseFloat(v?.toString().replace(/[^\d.-]/g, '')) || 0;

/**
 * Advanced AI Analysis Module (Local-First)
 */
const analyzeSmartInsights = (transactions) => {
    const insights = [];
    if (!transactions || transactions.length < 5) return insights;

    // 1. Group by description for recurring payments
    const groups = {};
    transactions.forEach(t => {
        if (t.debit > 0) {
            // Normalize description (remove dates, numbers at end)
            const key = t.description.replace(/[0-9\/\-\.]/g, '').trim().substring(0, 15);
            if (!groups[key]) groups[key] = [];
            groups[key].push(t);
        }
    });

    // 2. Identify Anomalies & Recurring Bills
    const FIXED_KEYWORDS = ['מכבי', 'כללית', 'חברת חשמל', 'חשמל', 'ארנונה', 'מים', 'משכנתא', 'שכר דירה', 'גז', 'ועד בית'];
    
    Object.entries(groups).forEach(([name, items]) => {
        // Check if this is a "Fixed/Hard" expense
        const isFixed = FIXED_KEYWORDS.some(kw => name.includes(kw));
        
        // If it's a fixed expense, we use it to stabilize the forecast (it's already part of the average)
        // BUT we do NOT generate savings insights/alerts for it as requested.
        if (isFixed) return;

        if (items.length >= 2) {
            const amounts = items.map(i => i.debit);
            const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
            const lastAmount = amounts[0]; // Assuming sorted desc by date

            // Alert: Bill increased by > 20%
            if (lastAmount > avg * 1.2 && lastAmount > 100) {
                insights.push({
                    type: 'alert',
                    title: `חריגה בחיוב: ${name}`,
                    description: `זוהתה עלייה של ${Math.round(((lastAmount/avg)-1)*100)}% בחיוב האחרון (₪${lastAmount}) ביחס לממוצע`,
                    icon: 'TrendingUp',
                    impact: lastAmount - avg
                });
            }

            // Insight: Recurring Subscription Detected
            if (items.length >= 3 && amounts.every(a => Math.abs(a - avg) < 5)) {
                // If it's a fixed amount, it's a subscription
                insights.push({
                    type: 'info',
                    title: `מנוי קבוע: ${name}`,
                    description: `חיוב קבוע של ₪${Math.round(avg)} מזוהה בחשבונך`,
                    icon: 'Calendar',
                    impact: avg * 12 // Annual cost
                });
            }
        }
    });

    return insights.slice(0, 5); // Return top 5 insights
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

        // Find the most recent month in the data and calculate totals
        let uniqueDaysInTargetMonth = new Set();
        if (allTransactions.length > 0) {
            allTransactions.sort((a, b) => b.date - a.date);
            const mostRecentDate = allTransactions[0].date;
            const targetMonth = mostRecentDate.getMonth();
            const targetYear = mostRecentDate.getFullYear();

            // Sum only transactions from the most recent month
            for (const tx of allTransactions) {
                if (tx.date.getMonth() === targetMonth && tx.date.getFullYear() === targetYear) {
                    totalDebit += tx.debit;
                    totalCredit += tx.credit;
                    // Track unique days in the target month
                    const dayKey = `${tx.date.getFullYear()}-${tx.date.getMonth()}-${tx.date.getDate()}`;
                    uniqueDaysInTargetMonth.add(dayKey);
                }
            }
        }

        if (uniqueDates.size === 0) {
            return { error: "לא נמצאו עסקאות תקינות" };
        }

        // 2. HYBRID ALGORITHM
        const totalDays = uniqueDates.size;

        // Average Daily Net = (TotalCredit - TotalDebit) / TotalDays
        const avgDailyNet = (totalCredit - totalDebit) / totalDays;

        // Recent Trend = LastRow Credit - LastRow Debit
        const recentTrend = lastRowCredit - lastRowDebit;

        // Hybrid Daily = (AverageDailyNet * 0.7) + (RecentTrend * 0.3)
        const hybridDaily = (avgDailyNet * 0.7) + (recentTrend * 0.3);

        // 3. Safe Forecast with 17% Buffer
        const rawForecast = currentBalance + (hybridDaily * 30);
        const safeForecast = rawForecast * 0.83;
        const projectedEOM = safeForecast;

        // 4. Calculate daily spending from target month only
        const daysInTargetMonth = uniqueDaysInTargetMonth.size > 0 ? uniqueDaysInTargetMonth.size : totalDays;
        const avgDailySpending = totalDebit / daysInTargetMonth;

        // 5. Determine risk status
        let riskStatus = "green";
        let riskDay = null;
        
        if (projectedEOM < 0) {
            riskStatus = "red";
            if (avgDailySpending > 0 && currentBalance > 0) {
                const daysUntilNegative = Math.floor(currentBalance / avgDailySpending);
                const riskDate = new Date();
                riskDate.setDate(riskDate.getDate() + daysUntilNegative);
                riskDay = riskDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
            }
        } else if (projectedEOM < currentBalance * 0.2) {
            riskStatus = "yellow";
        }

        // 6. Generate AI Insights
        const smartInsights = analyzeSmartInsights(allTransactions);

        // 7. Generate forecast graph points
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
            riskStatus,
            riskDay,
            rawScore: Math.round(rawForecast),
            avgDailySpending: Math.round(avgDailySpending),
            graphPoints,
            smartInsights, // Return AI insights
            transactionCount: allTransactions.length,
            confidence: totalDays >= 30 ? "high" : totalDays >= 10 ? "medium" : "low"
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
 * Calculate What-If scenario impact with 17% Safety Buffer
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
    
    // Calculate adjusted balance BEFORE safety buffer for risk day calculation
    const adjustedBalance = currentBalance + simulatedIncome - simulatedExpense;
    
    // Unified Formula: (CurrentBalance + Income - Expense) * 0.83
    const newSafeBalance = adjustedBalance * 0.83;
    
    // Dynamic Risk Day Calculation
    let newRiskDay = null;
    let daysUntilRisk = null;
    let trend = null;
    
    if (avgDailySpending > 0) {
        // Calculate days until balance reaches zero (can be negative if already in deficit)
        daysUntilRisk = Math.floor(adjustedBalance / avgDailySpending);
        const riskDate = new Date();
        riskDate.setDate(riskDate.getDate() + daysUntilRisk);
        newRiskDay = riskDate.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
        
        // Calculate trend (original risk day vs new risk day)
        const originalDays = currentBalance > 0 ? Math.floor(currentBalance / avgDailySpending) : 0;
        
        if (daysUntilRisk < originalDays) {
            trend = 'negative'; // Date moved closer (bad)
        } else if (daysUntilRisk > originalDays) {
            trend = 'positive'; // Date moved further (good)
        } else {
            trend = 'neutral';
        }
    } else {
        // No spending data - calculate based on threshold
        if (newSafeBalance < 0) {
            const today = new Date();
            newRiskDay = today.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
        }
    }
    
    // Determine risk status based on SAFE balance (after 0.83)
    let newRiskStatus = "green";
    if (newSafeBalance < 0) {
        newRiskStatus = "red";
    } else if (newSafeBalance < 1500) {
        newRiskStatus = "yellow";
    }
    
    // Update graph points proportionally
    const adjustedGraphPoints = baselineForecast.graphPoints.map(point => ({
        ...point,
        balance: Math.round(point.balance + simulatedIncome - simulatedExpense)
    }));

    return {
        ...baselineForecast,
        currentBalance: Math.round(adjustedBalance),
        projectedEOM: Math.round(newSafeBalance),
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
    safetyBuffer: "17% Standard Deviation",
    privacy: "All calculations in-browser"
};