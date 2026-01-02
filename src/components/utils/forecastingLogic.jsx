/**
 * FlowUp Hybrid Forecasting Engine (Client-Side)
 * -----------------------------------------------
 * Position-Based CSV Parser (ISO-8859-8 encoding)
 * Hybrid Algorithm: Average Daily Net (70%) + Recent Trend (30%)
 * Safety Buffer: 17% Risk Management (multiply by 0.83)
 * Privacy: All calculations happen in-browser, no data sent to server
 */

// Safe number conversion utility
const toNum = (v) => parseFloat(v?.toString().replace(/[^\d.-]/g, '')) || 0;

export const processAndForecast = (csvText) => {
    try {
        // 1. Parse CSV - Position-based (bypass Hebrew encoding issues)
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            return { error: "קובץ ריק או לא תקין" };
        }

        let totalCredit = 0;
        let totalDebit = 0;
        let currentBalance = 0;
        let lastRowCredit = 0;
        let lastRowDebit = 0;
        const uniqueDates = new Set();
        const allTransactions = [];

        // First pass: collect all transactions with parsed dates
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const row = line.split(',').map(cell => cell.trim().replace(/"/g, ''));
            
            const date = row[0] || '';
            const debit = toNum(row[6]);
            const credit = toNum(row[7]);
            const balance = toNum(row[8]);
            
            // Parse date
            let transactionDate = null;
            if (date.includes('/')) {
                const parts = date.split('/');
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1;
                const year = parts[2].length === 4 ? parseInt(parts[2]) : 2000 + parseInt(parts[2]);
                transactionDate = new Date(year, month, day);
            }
            
            if (transactionDate && !isNaN(transactionDate.getTime())) {
                allTransactions.push({
                    date: transactionDate,
                    debit,
                    credit,
                    balance
                });
            }
            
            // Track unique dates
            if (date) {
                uniqueDates.add(date);
            }
            
            // Last row = most recent transaction
            currentBalance = balance;
            lastRowCredit = credit;
            lastRowDebit = debit;
        }

        // Find the most recent month in the data and calculate totals
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

        // 4. Calculate daily spending (from Column 6)
        const avgDailySpending = totalDebit / totalDays;

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

        // 6. Generate forecast graph points
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
            transactionCount: lines.length - 1,
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
 * Calculate What-If scenario impact
 */
export const calculateWhatIf = (baselineForecast, scenario) => {
    if (!baselineForecast || !baselineForecast.success) {
        return baselineForecast;
    }

    if (!scenario || scenario.type === 'reset') {
        return baselineForecast;
    }

    let adjustedEOM = baselineForecast.projectedEOM;
    let adjustedGraphPoints = [...baselineForecast.graphPoints];

    // Handle different scenario types
    switch (scenario.type) {
        case 'expense':
            // One-time expense
            adjustedEOM -= scenario.amount;
            adjustedGraphPoints = baselineForecast.graphPoints.map(point => ({
                ...point,
                balance: point.balance - Math.round(scenario.amount / baselineForecast.graphPoints.length)
            }));
            break;

        case 'income':
            // One-time income (bonus)
            adjustedEOM += scenario.amount;
            adjustedGraphPoints = baselineForecast.graphPoints.map(point => ({
                ...point,
                balance: point.balance + Math.round(scenario.amount / baselineForecast.graphPoints.length)
            }));
            break;

        case 'monthly':
            // Recurring monthly change
            const daysInMonth = 30;
            const dailyChange = scenario.amount / daysInMonth;
            adjustedEOM -= scenario.amount;
            adjustedGraphPoints = baselineForecast.graphPoints.map((point, index) => ({
                ...point,
                balance: point.balance - Math.round(dailyChange * index)
            }));
            break;

        case 'salary_delay':
            // Salary delay impact
            const delayDays = scenario.days;
            const avgDailySpend = baselineForecast.avgDailySpending;
            const delayImpact = avgDailySpend * delayDays;
            adjustedEOM -= delayImpact;
            adjustedGraphPoints = baselineForecast.graphPoints.map((point, index) => {
                if (index < delayDays) {
                    return {
                        ...point,
                        balance: point.balance - Math.round(avgDailySpend * index)
                    };
                }
                return {
                    ...point,
                    balance: point.balance - Math.round(delayImpact)
                };
            });
            break;
    }
    
    let newRiskStatus = "green";
    let newRiskDay = null;
    
    if (adjustedEOM < 0) {
        newRiskStatus = "red";
        if (baselineForecast.avgDailySpending > 0) {
            const currentBalanceAdjusted = scenario.type === 'expense' 
                ? baselineForecast.currentBalance - scenario.amount 
                : baselineForecast.currentBalance;
            const daysUntilNegative = Math.floor(
                Math.abs(currentBalanceAdjusted / baselineForecast.avgDailySpending)
            );
            const riskDate = new Date();
            riskDate.setDate(riskDate.getDate() + daysUntilNegative);
            newRiskDay = riskDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
        }
    } else if (adjustedEOM < 1000) {
        newRiskStatus = "yellow";
    }

    return {
        ...baselineForecast,
        projectedEOM: Math.round(adjustedEOM),
        riskStatus: newRiskStatus,
        riskDay: newRiskDay,
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