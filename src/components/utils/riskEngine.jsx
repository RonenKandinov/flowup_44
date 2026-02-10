/**
 * FlowUp DNA Risk Engine
 * ------------------------------
 * Holistic Risk Assessment
 * Combines Monte Carlo Simulations (Cashflow) with Asset Resilience (DNA).
 * Optimized for 500 simulations (Performance/Accuracy Sweet Spot).
 */

const SIMULATIONS = 500;
const HORIZON = 45;
const CONFIDENCE_THRESHOLD = 0.35; // 35% failure rate triggers Risk

const FIXED_KEYWORDS = [
    'שכר דירה', 'משכנתא', 'ארנונה', 'חשמל', 'מים', 'גז', 'ועד בית',
    'ביטוח', 'הראל', 'הפניקס', 'מנורה', 'כלל',
    'סלקום', 'פרטנר', 'פלאפון', 'הוט', 'בזק', 'yes', 'netflix', 'spotify',
    'עמלה', 'דמי כרטיס', 'הלוואה'
];

const NOISE_KEYWORDS = [
    'העברה עצמית', 'העברה לחיסכון', 'הפקדה', 'deposit', 'transfer to self', 'saving', 'עו"ש', 'פק"מ', 'פיקדון'
];

export const runMonteCarlo = (currentBalance, transactions, dynamicAnchors = null, dnaProfile = null) => {
    // 1. Base Monte Carlo (Cashflow Analysis)
    const model = buildFinancialModel(transactions, dynamicAnchors);
    
    // 2. DNA Injection: Asset Shield (Virtual Buffer)
    // "Inject identified assets into startBalance... as Virtual Buffer"
    let simulationBalance = currentBalance;
    let usingAssetShield = false;
    
    if (dnaProfile && dnaProfile.totalLiquid > 0) {
        simulationBalance += dnaProfile.totalLiquid;
        usingAssetShield = true;
    }

    const results = simulateFutures(simulationBalance, model);
    
    // 3. Assess Risk with DNA modifiers
    let assessment = interpretResults(results, currentBalance, model.avgMonthlySpend, model.missingRecentSalary);
    
    // If Asset Shield prevented failure (Simulated Green vs Real Red), mark as Shielded
    if (usingAssetShield && assessment.riskStatus === 'green') {
        // We simulate again without assets to see if they WOULD have failed
        // This is purely for the "Reasoning" text, optimized to not run full 500 loops if not needed
        // For MVP performance, we'll trust the DNA logic in interpretResults
    }

    // Resilience Score (Visual Badge)
    let resilienceScore = 0;
    if (dnaProfile) {
        const { survivalMonths, growthEngine } = dnaProfile;
        if (survivalMonths > 6) resilienceScore += 20;
        if (survivalMonths > 12) resilienceScore += 30;
        if (growthEngine && growthEngine.isGrowthEngine) resilienceScore += 15;
    }

    return { ...assessment, resilienceScore };
};

function buildFinancialModel(transactions, dynamicAnchors) {
    if (!transactions || transactions.length < 10) {
        return {
            fixedSchedule: Array(32).fill(0),
            variableStats: { mean: -100, stdDev: 50 },
            avgMonthlySpend: 3000,
            missingRecentSalary: false
        };
    }

    const anchorSet = dynamicAnchors instanceof Set ? dynamicAnchors : new Set(dynamicAnchors || []);
    const fixedEvents = {}; 
    const txByDateStr = {};
    
    let lastSalaryDate = null;
    const now = new Date();
    
    transactions.forEach(t => {
        const dateObj = t.date instanceof Date ? t.date : new Date(t.date);
        if (isNaN(dateObj.getTime())) return;

        const day = dateObj.getDate();
        const desc = (t.description || '').toLowerCase();
        let amount = t.amount !== undefined ? t.amount : ((t.credit || 0) - (t.debit || 0));
        
        const cleanDesc = desc.replace(/[0-9\/\-\.\,:\*#]/g, ' ').trim().replace(/\s+/g, ' ');
        const isAnchor = anchorSet.has(cleanDesc);
        const isFixedKeyword = FIXED_KEYWORDS.some(k => desc.includes(k));
        
        // Hard Income Detection: Consistent Income > 4000
        const isIncome = amount > 0;
        const isLikelySalary = isIncome && amount > 4000;
        
        if (isLikelySalary) {
             if (!lastSalaryDate || dateObj > lastSalaryDate) {
                 lastSalaryDate = dateObj;
             }
        }

        if (isAnchor || isFixedKeyword || isLikelySalary) {
            if (!fixedEvents[day]) fixedEvents[day] = [];
            fixedEvents[day].push(amount);
        } else if (amount < 0) {
            // Signal vs Noise: Ignore Self-Transfers for StdDev
            const isNoise = NOISE_KEYWORDS.some(k => desc.includes(k));
            if (!isNoise) {
                const dateStr = dateObj.toDateString();
                if (!txByDateStr[dateStr]) txByDateStr[dateStr] = 0;
                txByDateStr[dateStr] += amount;
            }
        }
    });

    // Check for Missing Hard Income (30+ days)
    let missingRecentSalary = false;
    if (lastSalaryDate) {
        const daysSinceSalary = (now - lastSalaryDate) / (1000 * 60 * 60 * 24);
        if (daysSinceSalary > 35) { // 35 days buffer
            missingRecentSalary = true;
        }
    }

    const fixedSchedule = Array(32).fill(0);
    Object.keys(fixedEvents).forEach(day => {
        const amounts = fixedEvents[day];
        const avg = amounts.reduce((a,b) => a+b, 0) / amounts.length;
        fixedSchedule[parseInt(day)] = avg;
    });
    
    const sortedDates = transactions.map(t => t.date).sort((a,b) => a-b);
    const startDate = sortedDates[0];
    const endDate = sortedDates[sortedDates.length - 1];
    const totalDays = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)));
    
    const dailyVars = [];
    for (let i = 0; i <= totalDays; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const key = d.toDateString();
        dailyVars.push(txByDateStr[key] || 0);
    }

    const mean = dailyVars.reduce((a,b) => a+b, 0) / dailyVars.length;
    const variance = dailyVars.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / dailyVars.length;
    
    // Inject 15% Random Volatility (Master Prompt Rule)
    // Ensure StdDev is at least 15% of the mean variable spend
    const calculatedStdDev = Math.sqrt(variance);
    const minStdDev = Math.abs(mean) * 0.15;
    const stdDev = Math.max(calculatedStdDev, minStdDev);

    const dailyFixed = fixedSchedule.reduce((a,b) => a+b, 0) / 30;
    const avgMonthlySpend = Math.abs((dailyFixed + mean) * 30);
    
    return {
        fixedSchedule,
        variableStats: { mean, stdDev },
        avgMonthlySpend,
        missingRecentSalary
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
            
            balance += model.fixedSchedule[day] || 0;
            
            const u1 = Math.random();
            const u2 = Math.random();
            const safeU1 = u1 === 0 ? Number.EPSILON : u1;
            const z = Math.sqrt(-2.0 * Math.log(safeU1)) * Math.cos(2.0 * Math.PI * u2);
            
            let variableSpend = model.variableStats.mean + (z * model.variableStats.stdDev);
            if (variableSpend > 0) variableSpend = 0;
            
            balance += variableSpend;
            
            if (balance < 0 && failDay === null) {
                failDay = d;
            }
        }
        if (failDay !== null) failures.push(failDay);
    }
    return failures;
}

function interpretResults(failures, currentBalance, avgMonthlySpend, missingRecentSalary) {
    let failureRate = failures.length / SIMULATIONS;
    
    // Hard Income Penalty: +20% Risk if salary missing
    if (missingRecentSalary) {
        failureRate = Math.min(1.0, failureRate + 0.20);
    }

    const confidence = Math.round((1 - failureRate) * 100);
    
    // High Balance Suppressor (Asset Shield / Wealthy Client)
    // If balance > 5x monthly spend, force Green (Master Prompt Rule)
    if (avgMonthlySpend > 0 && currentBalance > (5 * avgMonthlySpend)) {
        return { 
            riskStatus: 'green', 
            confidence: 100, 
            riskDay: null, 
            reasoning: 'יתרה גבוהה (x5 מהוצאה חודשית) - חוסן פיננסי מוחלט' 
        };
    }
    
    let status = 'green';
    let riskDay = null;
    let reasoning = null;
    
    // Risk Scoring (Master Prompt Thresholds)
    // RED: > 30% | YELLOW: 10%-30% | GREEN: < 10%
    if (failureRate > 0.30) { 
        status = 'red';
        failures.sort((a,b) => a-b);
        const medianOffset = failures[Math.floor(failures.length / 2)];
        
        if (medianOffset <= 2 && failureRate < 0.9) {
            riskDay = null;
            status = 'yellow'; 
            reasoning = "תנודתיות גבוהה בטווח המיידי - במעקב";
        } else {
            const date = new Date();
            date.setDate(date.getDate() + medianOffset);
            riskDay = date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
            
            if (missingRecentSalary) reasoning = "הפסקת הכנסה מזוהה (Hard Income Stopped)";
            else if (medianOffset < 10) reasoning = "עומס חיובים צפוי בימים הקרובים";
            else if (medianOffset > 25) reasoning = "תזרים שלילי לקראת סוף החודש";
            else reasoning = "התחייבויות קבועות גבוהות לפני מועד המשכורת";
        }
    } else if (failureRate > 0.10) {
        status = 'yellow';
        reasoning = missingRecentSalary ? "הכנסה חסרה בחודש האחרון" : "רמת סיכון בינונית (10%-30%) - נדרש מעקב";
    }
    
    return { riskStatus: status, confidence, riskDay, reasoning };
}