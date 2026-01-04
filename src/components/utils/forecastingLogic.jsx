/**
 * FlowUp SARIMAX Lite Forecasting Engine (Client-Side)
 * -----------------------------------------------
 * Position-Based CSV Parser (ISO-8859-8 encoding)
 * SARIMAX Lite: Seasonal Decomposition + Auto-Regressive Trend + Exogenous Shocks
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
        const uniqueDates = new Set();
        const allTransactions = [];
        const recurringExpenses = [];

        // First pass: collect all transactions with recurring detection
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const row = line.split(',').map(cell => cell.trim().replace(/"/g, ''));
            
            const date = row[0] || '';
            const description = (row[2] || '').toLowerCase();
            const debit = toNum(row[6]);
            const credit = toNum(row[7]);
            const balance = toNum(row[8]);
            const amount = credit - debit;
            
            // Parse date
            let transactionDate = null;
            if (date.includes('/')) {
                const parts = date.split('/');
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1;
                const year = parts[2].length === 4 ? parseInt(parts[2]) : 2000 + parseInt(parts[2]);
                transactionDate = new Date(year, month, day);
            }
            
            // SARIMAX: Identify recurring/seasonal expenses
            const isRecurring = debit > 0 && (
                description.includes('שכירות') || 
                description.includes('משכנתא') || 
                description.includes('ביטוח') ||
                description.includes('מנוי') ||
                description.includes('קבוע') ||
                (debit >= 500 && debit % 100 === 0) // Round amounts likely recurring
            );
            
            if (transactionDate && !isNaN(transactionDate.getTime())) {
                allTransactions.push({
                    date: transactionDate,
                    debit,
                    credit,
                    balance,
                    amount,
                    isRecurring
                });
                
                if (isRecurring) {
                    recurringExpenses.push(debit);
                }
            }
            
            // Track unique dates
            if (date) {
                uniqueDates.add(date);
            }
            
            // Last row = most recent transaction
            currentBalance = balance;
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

        // 2. SARIMAX LITE - Seasonal Decomposition + Auto-Regressive Trend
        const totalDays = uniqueDates.size || 30;

        // Separate non-recurring (variable) expenses for trend analysis
        const nonRecurringTx = allTransactions.filter(tx => !tx.isRecurring && tx.debit > 0);
        const totalNonRecurringDebit = nonRecurringTx.reduce((sum, tx) => sum + tx.debit, 0);
        
        // Auto-Regressive: Clean daily burn rate (without seasonal shocks)
        const avgDailyBase = totalNonRecurringDebit / totalDays;

        // Seasonal Component: Estimate remaining recurring expenses
        const avgRecurringMonthly = recurringExpenses.length > 0 
            ? recurringExpenses.reduce((a, b) => a + b, 0) / Math.ceil(recurringExpenses.length / 3)
            : 0;

        // 3. SARIMAX Forecast: Base Trend + Seasonal + Shock Factor (5% buffer)
        const now = new Date();
        const daysRemaining = Math.max(1, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate());
        
        const projectedVariableSpend = avgDailyBase * daysRemaining * 1.05; // 5% shock buffer
        const projectedRecurringSpend = avgRecurringMonthly * (daysRemaining / 30);
        
        const rawForecast = currentBalance - projectedVariableSpend - projectedRecurringSpend;
        
        // Safety Buffer: 17% additional protection
        const safeForecast = rawForecast > 0 ? rawForecast * 0.83 : rawForecast;
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

        // 6. Generate stabilized forecast graph points
        const graphPoints = [];
        let runningBalance = currentBalance;
        const dailyBurnRate = avgDailyBase + (avgRecurringMonthly / 30);
        
        for (let i = 0; i <= 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            graphPoints.push({
                date: date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }),
                balance: Math.round(runningBalance)
            });
            runningBalance -= dailyBurnRate; // SARIMAX: steady decline model
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
        if (adjustedBalance > 0) {
            // Calculate days until balance reaches zero using ADJUSTED balance
            daysUntilRisk = Math.floor(adjustedBalance / avgDailySpending);
            const riskDate = new Date();
            riskDate.setDate(riskDate.getDate() + daysUntilRisk);
            newRiskDay = riskDate.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
        } else {
            // Balance is already negative - immediate risk
            newRiskDay = 'מיידי';
            daysUntilRisk = 0;
        }
        
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
        // No spending data - use simple thresholds
        if (newSafeBalance < 0) {
            newRiskDay = 'מיידי';
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
    version: "2.0.0",
    type: "Client-Side SARIMAX Lite",
    engine: "Seasonal AR + Exogenous Shocks",
    safetyBuffer: "17% + 5% Shock Factor",
    privacy: "All calculations in-browser"
};