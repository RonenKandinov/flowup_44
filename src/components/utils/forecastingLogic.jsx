/**
 * FlowUp Hybrid Forecasting Engine (Client-Side)
 * -----------------------------------------------
 * Models: SES (30%) + Seasonal Average (70%)
 * Safety Buffer: 17% Risk Management (multiply by 0.83)
 * Privacy: All calculations happen in-browser, no data sent to server
 */

export const processAndForecast = (csvText) => {
    try {
        // 1. Parse CSV
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            return { error: "קובץ ריק או לא תקין" };
        }

        const transactions = [];
        const dailyBalances = new Map();

        // Parse transactions (skip header)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const parts = line.split(',').map(p => p.trim().replace(/"/g, ''));
            
            // Try to find amount column (usually contains numbers with optional minus)
            let amount = null;
            let date = null;
            
            for (const part of parts) {
                // Check if this looks like a date
                if (part.includes('/') || part.includes('-')) {
                    date = part;
                }
                
                // Check if this looks like an amount
                const cleaned = part.replace(/[^\d.-]/g, '');
                const parsed = parseFloat(cleaned);
                if (!isNaN(parsed) && parsed !== 0 && !amount) {
                    amount = parsed;
                }
            }

            if (amount !== null) {
                transactions.push(amount);
                
                if (date) {
                    if (!dailyBalances.has(date)) {
                        dailyBalances.set(date, 0);
                    }
                    dailyBalances.set(date, dailyBalances.get(date) + amount);
                }
            }
        }

        if (transactions.length === 0) {
            return { error: "לא נמצאו עסקאות תקינות" };
        }

        // 2. Simple Exponential Smoothing (SES)
        let sesValue = transactions[0];
        const alpha = 0.3; // Smoothing factor
        
        for (let i = 1; i < transactions.length; i++) {
            sesValue = alpha * transactions[i] + (1 - alpha) * sesValue;
        }

        // 3. Seasonal Average (last 30 days pattern)
        const recentTransactions = transactions.slice(-30);
        const total = recentTransactions.reduce((a, b) => a + b, 0);
        const avg = total / recentTransactions.length;

        // 4. Calculate daily spending rate (expenses only)
        const expenses = transactions.filter(t => t < 0);
        const avgDailySpending = expenses.length > 0 
            ? Math.abs(expenses.reduce((a, b) => a + b, 0) / expenses.length)
            : 0;

        // 5. Hybrid Calculation (70% Seasonal, 30% SES)
        const forecastDays = 30;
        const rawForecast = (avg * forecastDays * 0.7) + (sesValue * forecastDays * 0.3);
        
        // 6. Apply 17% Safety Buffer (Standard Deviation Risk Management)
        const safeForecast = rawForecast * 0.83;

        // 7. Calculate current balance (sum of all transactions)
        const currentBalance = transactions.reduce((a, b) => a + b, 0);
        
        // 8. Project end of month balance
        const projectedEOM = currentBalance + safeForecast;

        // 9. Determine risk status
        let riskStatus = "green";
        let riskDay = null;
        
        if (projectedEOM < 0) {
            riskStatus = "red";
            // Calculate days until negative
            if (avgDailySpending > 0) {
                const daysUntilNegative = Math.floor(Math.abs(currentBalance / avgDailySpending));
                const riskDate = new Date();
                riskDate.setDate(riskDate.getDate() + daysUntilNegative);
                riskDay = riskDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
            }
        } else if (projectedEOM < 1000) {
            riskStatus = "yellow";
        }

        // 10. Generate forecast graph points
        const graphPoints = [];
        let runningBalance = currentBalance;
        const dailyChange = safeForecast / forecastDays;
        
        for (let i = 0; i <= forecastDays; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            graphPoints.push({
                date: date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }),
                balance: Math.round(runningBalance)
            });
            runningBalance += dailyChange;
        }

        return {
            success: true,
            forecastTotal: Math.round(safeForecast),
            projectedEOM: Math.round(projectedEOM),
            currentBalance: Math.round(currentBalance),
            riskStatus,
            riskDay,
            rawScore: Math.round(rawForecast),
            avgDailySpending: Math.round(avgDailySpending),
            graphPoints,
            transactionCount: transactions.length,
            confidence: transactions.length >= 30 ? "high" : transactions.length >= 10 ? "medium" : "low"
        };

    } catch (error) {
        return { 
            error: "שגיאה בעיבוד הנתונים: " + error.message 
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