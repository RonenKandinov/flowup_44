/**
 * FlowUp Advanced Forecasting Engine (Client-Side)
 * ------------------------------------------------
 * Position-Based CSV Parser (ISO-8859-8 encoding)
 * Hybrid Algorithm: Average Daily Net (70%) + Recent Trend (30%)
 * Dynamic Risk Buffer: Calculated from Standard Deviation of daily net flow
 * Recent Trend: EWMA on last 14-21 days (not full history)
 * Privacy: All calculations happen in-browser, no data sent to server
 */

// Safe number conversion utility
const toNum = (v) => parseFloat(v?.toString().replace(/[^\d.-]/g, '')) || 0;

// Calculate standard deviation
const calcStdDev = (values) => {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
};

// Calculate EWMA (Exponentially Weighted Moving Average)
const calcEWMA = (values, alpha = 0.3) => {
    if (values.length === 0) return 0;
    let ewma = values[0];
    for (let i = 1; i < values.length; i++) {
        ewma = alpha * values[i] + (1 - alpha) * ewma;
    }
    return ewma;
};

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
        let uniqueDaysInTargetMonth = new Set();
        const dailyNetFlows = []; // For standard deviation calculation
        const recentDailyNets = []; // Last 14-21 days for trend
        
        if (allTransactions.length > 0) {
            allTransactions.sort((a, b) => b.date - a.date);
            const mostRecentDate = allTransactions[0].date;
            const targetMonth = mostRecentDate.getMonth();
            const targetYear = mostRecentDate.getFullYear();

            // Group transactions by day for net flow calculation
            const dailyGroups = new Map();
            
            for (const tx of allTransactions) {
                const dayKey = `${tx.date.getFullYear()}-${tx.date.getMonth()}-${tx.date.getDate()}`;
                if (!dailyGroups.has(dayKey)) {
                    dailyGroups.set(dayKey, { credit: 0, debit: 0, date: tx.date });
                }
                const group = dailyGroups.get(dayKey);
                group.credit += tx.credit;
                group.debit += tx.debit;
            }
            
            // Calculate daily net flows and collect recent trend data
            const sortedDays = Array.from(dailyGroups.values()).sort((a, b) => b.date - a.date);
            const recentWindowDays = 18; // Use 18 days for recent trend
            
            for (let i = 0; i < sortedDays.length; i++) {
                const day = sortedDays[i];
                const netFlow = day.credit - day.debit;
                dailyNetFlows.push(netFlow);
                
                // Collect last 18 days for recent trend
                if (i < recentWindowDays) {
                    recentDailyNets.push(netFlow);
                }
                
                // Sum totals from target month
                if (day.date.getMonth() === targetMonth && day.date.getFullYear() === targetYear) {
                    totalDebit += day.debit;
                    totalCredit += day.credit;
                    const dayKey = `${day.date.getFullYear()}-${day.date.getMonth()}-${day.date.getDate()}`;
                    uniqueDaysInTargetMonth.add(dayKey);
                }
            }
        }

        if (uniqueDates.size === 0) {
            return { error: "לא נמצאו עסקאות תקינות" };
        }

        // 2. ADVANCED HYBRID ALGORITHM
        const totalDays = uniqueDates.size;

        // Average Daily Net = (TotalCredit - TotalDebit) / TotalDays
        const avgDailyNet = (totalCredit - totalDebit) / totalDays;

        // Recent Trend = EWMA on last 14-21 days (not full history)
        const recentTrend = recentDailyNets.length > 0 ? calcEWMA(recentDailyNets) : avgDailyNet;

        // Hybrid Daily = (AverageDailyNet * 0.7) + (RecentTrend * 0.3)
        const hybridDaily = (avgDailyNet * 0.7) + (recentTrend * 0.3);

        // 3. Dynamic Risk Buffer (k * std)
        const stdDev = calcStdDev(dailyNetFlows);
        const k = 1.5; // Risk sensitivity factor (1.5 σ ≈ 87% confidence)
        const riskBuffer = k * stdDev * Math.sqrt(30); // Scale for 30 days
        
        const rawForecast = currentBalance + (hybridDaily * 30);
        const safeForecast = rawForecast - riskBuffer;
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
            riskBuffer: Math.round(riskBuffer),
            stdDev: Math.round(stdDev),
            hybridDaily: Math.round(hybridDaily),
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
 * Calculate What-If scenario impact with Dynamic Risk Buffer
 * Improved: Event-based injection at specific day
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
    const hybridDaily = baselineForecast.hybridDaily || 0;
    const riskBuffer = baselineForecast.riskBuffer || 0;
    
    // Calculate adjusted balance based on scenario
    let simulatedIncome = 0;
    let simulatedExpense = 0;
    const eventDay = scenario.day || 0; // Default: today (day 0)
    
    switch (scenario.type) {
        case 'expense':
            simulatedExpense = scenario.amount || 0;
            break;
        case 'income':
            simulatedIncome = scenario.amount || 0;
            break;
    }
    
    // Event-based injection: calculate balance at event day, then apply event
    const balanceAtEvent = currentBalance + (hybridDaily * eventDay);
    const adjustedBalance = balanceAtEvent + simulatedIncome - simulatedExpense;
    
    // Calculate new EOM with dynamic risk buffer
    const rawForecast = adjustedBalance + (hybridDaily * (30 - eventDay));
    const newSafeBalance = rawForecast - riskBuffer;
    
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
    
    // Update graph points with event injection at specific day
    const adjustedGraphPoints = baselineForecast.graphPoints.map((point, index) => {
        let newBalance = currentBalance + (hybridDaily * index);
        
        // Apply event impact from event day onwards
        if (index >= eventDay) {
            newBalance += (simulatedIncome - simulatedExpense);
        }
        
        return {
            ...point,
            balance: Math.round(newBalance)
        };
    });

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
    version: "2.0.0",
    type: "Client-Side Advanced",
    engine: "Hybrid Average + EWMA Trend (18-day window)",
    safetyBuffer: "Dynamic Risk Buffer (1.5σ × √30)",
    whatIf: "Event-based injection with timeline impact",
    privacy: "All calculations in-browser"
};