/**
 * FlowUp Monte Carlo Risk Engine
 * ------------------------------
 * "Risk Agent" Logic
 * Executes 100 independent future scenarios to determine probabilistic risk.
 */

const SIMULATIONS = 100;
const HORIZON = 45;
const CONFIDENCE_THRESHOLD = 0.35; // 35% failure rate triggers Risk

// Keywords to identify fixed expenses (Shared knowledge)
const FIXED_KEYWORDS = [
    'שכר דירה', 'משכנתא', 'ארנונה', 'חשמל', 'מים', 'גז', 'ועד בית',
    'ביטוח', 'הראל', 'הפניקס', 'מנורה', 'כלל',
    'סלקום', 'פרטנר', 'פלאפון', 'הוט', 'בזק', 'yes', 'netflix', 'spotify',
    'עמלה', 'דמי כרטיס', 'הלוואה'
];

export const runMonteCarlo = (currentBalance, transactions, dynamicAnchors) => {
    // 1. Analyze History to build the model
    const model = buildFinancialModel(transactions, dynamicAnchors);
    
    // 2. Run Simulations
    const results = simulateFutures(currentBalance, model);
    
    // 3. Assess Risk
    return interpretResults(results, currentBalance, model.avgMonthlySpend);
};

function buildFinancialModel(transactions, dynamicAnchors) {
    if (!transactions || transactions.length < 10) {
        // Fallback for insufficient data
        return {
            fixedSchedule: Array(32).fill(0),
            variableStats: { mean: -100, stdDev: 50 },
            avgMonthlySpend: 3000
        };
    }

    const fixedEvents = {}; // Day -> [amounts]
    const txByDateStr = {};
    
    // 1. Classify Transactions & Populate Fixed/Variable Buckets
    transactions.forEach(t => {
        const day = t.date.getDate();
        const desc = t.description.toLowerCase();
        // Check Credit/Debit directly (DB format) or calculated amount
        const isIncome = (t.amount > 0) || (t.credit > 0);
        const amount = t.amount !== undefined ? t.amount : (t.credit - t.debit);
        
        // Identify Fixed (Income OR Expense)
        const cleanDesc = desc.replace(/[0-9\/\-\.\,:\*#]/g, ' ').trim().replace(/\s+/g, ' ');
        const isAnchor = dynamicAnchors && dynamicAnchors.has(cleanDesc);
        const isFixedKeyword = FIXED_KEYWORDS.some(k => desc.includes(k));
        
        // Fixed logic: Must be an anchor OR a known fixed keyword. 
        // Also consider salary (large income) as fixed? Usually yes.
        // For now, let's stick to the anchor/keyword logic + Income > 5000 is likely salary
        const isLikelySalary = isIncome && amount > 4000;
        
        if (isAnchor || isFixedKeyword || isLikelySalary) {
            if (!fixedEvents[day]) fixedEvents[day] = [];
            fixedEvents[day].push(amount);
        } else if (amount < 0) {
            // Variable Expense (Only consider negatives for variable volatility)
            const dateStr = t.date.toDateString();
            if (!txByDateStr[dateStr]) txByDateStr[dateStr] = 0;
            txByDateStr[dateStr] += amount; // accumulating negative values
        }
    });

    // 2. Calculate Fixed Schedule (Average per Day of Month)
    const fixedSchedule = Array(32).fill(0);
    Object.keys(fixedEvents).forEach(day => {
        const amounts = fixedEvents[day];
        // Filter outliers in fixed? Maybe not needed for MVP.
        const avg = amounts.reduce((a,b) => a+b, 0) / amounts.length;
        fixedSchedule[parseInt(day)] = avg;
    });
    
    // 3. Calculate Variable Stats (Daily Mean & StdDev)
    // We must fill gaps with 0 for days without variable spending
    const sortedDates = transactions.map(t => t.date).sort((a,b) => a-b);
    const startDate = sortedDates[0];
    const endDate = sortedDates[sortedDates.length - 1];
    const totalDays = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)));
    
    const dailyVars = [];
    // Iterate every day in range
    for (let i = 0; i <= totalDays; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const key = d.toDateString();
        dailyVars.push(txByDateStr[key] || 0);
    }

    const mean = dailyVars.reduce((a,b) => a+b, 0) / dailyVars.length;
    const variance = dailyVars.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / dailyVars.length;
    const stdDev = Math.sqrt(variance);
    
    // Avg Monthly Spend (Total Fixed + Total Variable)
    // This is approximate for the "High Balance" check
    const dailyFixed = fixedSchedule.reduce((a,b) => a+b, 0) / 30; // avg daily fixed impact
    // Avg Monthly Outflow = (DailyFixed + DailyVariableMean) * 30
    // Note: mean is negative for expenses.
    const avgMonthlySpend = Math.abs((dailyFixed + mean) * 30);
    
    return {
        fixedSchedule,
        variableStats: { mean, stdDev },
        avgMonthlySpend
    };
}

function simulateFutures(startBalance, model) {
    const failures = [];
    const today = new Date();
    
    for (let i = 0; i < SIMULATIONS; i++) {
        let balance = startBalance;
        let failDay = null;
        
        for (let d = 1; d <= HORIZON; d++) {
            const date = new Date(today);
            date.setDate(today.getDate() + d);
            const day = date.getDate();
            
            // 1. Apply Fixed Items for this day
            balance += model.fixedSchedule[day] || 0;
            
            // 2. Apply Variable Spending (Stochastic)
            // Box-Muller transform for normal distribution
            const u1 = Math.random();
            const u2 = Math.random();
            // Ensure u1 is non-zero to avoid log(0)
            const safeU1 = u1 === 0 ? Number.EPSILON : u1;
            const z = Math.sqrt(-2.0 * Math.log(safeU1)) * Math.cos(2.0 * Math.PI * u2);
            
            let variableSpend = model.variableStats.mean + (z * model.variableStats.stdDev);
            
            // Clamp positive variable spend (we don't want to simulate random income here, only volatility in spending)
            if (variableSpend > 0) variableSpend = 0;
            
            balance += variableSpend;
            
            // 3. Check Failure
            if (balance < 0 && failDay === null) {
                failDay = d;
            }
        }
        
        if (failDay !== null) failures.push(failDay);
    }
    
    return failures;
}

function interpretResults(failures, currentBalance, avgMonthlySpend) {
    const failureRate = failures.length / SIMULATIONS;
    const confidence = Math.round((1 - failureRate) * 100);
    
    // False Positive Check: High Balance
    // If balance > 3x monthly spend, suppress risk unless it's a catastrophic probability
    if (avgMonthlySpend > 0 && currentBalance > (3 * avgMonthlySpend) && failureRate < 0.65) {
        return { 
            riskStatus: 'green', 
            confidence: 100, 
            riskDay: null, 
            reasoning: 'יתרה גבוהה - סיכון נמוך' 
        };
    }
    
    // Default Safe
    let status = 'green';
    let riskDay = null;
    let reasoning = null;
    
    // Risk Criteria
    if (failureRate > CONFIDENCE_THRESHOLD) { // > 35%
        status = 'red';
        
        // Calculate Median Risk Day
        failures.sort((a,b) => a-b);
        const medianOffset = failures[Math.floor(failures.length / 2)];
        
        const date = new Date();
        date.setDate(date.getDate() + medianOffset);
        riskDay = date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
        
        reasoning = `זוהה סיכון ב-${Math.round(failureRate * 100)}% מהתרחישים (יום ${medianOffset})`;
    } else if (failureRate > 0.1) {
        status = 'yellow'; // Monitor
        reasoning = `סיכון נמוך (${Math.round(failureRate * 100)}%)`;
    }
    
    return { riskStatus: status, confidence, riskDay, reasoning };
}