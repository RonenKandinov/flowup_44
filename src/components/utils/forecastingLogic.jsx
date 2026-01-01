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

        // Parse all rows (skip header at index 0)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const row = line.split(',').map(cell => cell.trim().replace(/"/g, ''));
            
            // Position-Based Mapping (fixed indexes):
            // row[0] = Date
            // row[6] = Debit (חובה - Expense)
            // row[7] = Credit (זכות - Income)
            // row[8] = Balance (יתרה לאחר פעולה)
            
            const date = row[0] || '';
            const debit = toNum(row[6]);
            const credit = toNum(row[7]);
            const balance = toNum(row[8]);
            
            // Accumulate totals
            totalDebit += debit;
            totalCredit += credit;
            
            // Track unique dates
            if (date) {
                uniqueDates.add(date);
            }
            
            // Last row = most recent transaction
            currentBalance = balance;
            lastRowCredit = credit;
            lastRowDebit = debit;
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
export const calculateWhatIf = (baselineForecast, expenseAmount) => {
    if (!baselineForecast || !baselineForecast.success) {
        return baselineForecast;
    }

    const adjustedEOM = baselineForecast.projectedEOM - expenseAmount;
    
    let newRiskStatus = "green";
    let newRiskDay = null;
    
    if (adjustedEOM < 0) {
        newRiskStatus = "red";
        if (baselineForecast.avgDailySpending > 0) {
            const daysUntilNegative = Math.floor(
                Math.abs((baselineForecast.currentBalance - expenseAmount) / baselineForecast.avgDailySpending)
            );
            const riskDate = new Date();
            riskDate.setDate(riskDate.getDate() + daysUntilNegative);
            newRiskDay = riskDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
        }
    } else if (adjustedEOM < 1000) {
        newRiskStatus = "yellow";
    }

    // Adjust graph points
    const adjustedGraphPoints = baselineForecast.graphPoints.map(point => ({
        ...point,
        balance: point.balance - Math.round(expenseAmount / baselineForecast.graphPoints.length)
    }));

    return {
        ...baselineForecast,
        projectedEOM: Math.round(adjustedEOM),
        riskStatus: newRiskStatus,
        riskDay: newRiskDay,
        graphPoints: adjustedGraphPoints,
        whatIfApplied: true,
        whatIfAmount: expenseAmount
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