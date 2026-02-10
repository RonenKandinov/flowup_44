/**
 * FlowUp DNA Risk Engine
 * ------------------------------
 * Holistic Risk Assessment
 * Combines Monte Carlo Simulations (Cashflow) with Asset Resilience (DNA).
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

export const runMonteCarlo = (currentBalance, transactions, dynamicAnchors = null, dnaProfile = null) => {
    // 1. Base Monte Carlo (Cashflow Analysis)
    const model = buildFinancialModel(transactions, dynamicAnchors);
    const results = simulateFutures(currentBalance, model);
    let assessment = interpretResults(results, currentBalance, model.avgMonthlySpend);
    
    // 2. DNA Layer: Asset Resilience Override
    // If the client has strong assets ("The Fortified Orange"), we upgrade their status.
    let resilienceScore = 0;
    if (dnaProfile) {
        const { survivalMonths, growthEngine } = dnaProfile;
        
        // Score Calculation
        if (survivalMonths > 6) resilienceScore += 20;
        if (survivalMonths > 12) resilienceScore += 30; // Strong Shield
        if (growthEngine && growthEngine.isGrowthEngine) resilienceScore += 15;

        // Apply Logic
        if (assessment.riskStatus === 'red' || assessment.riskStatus === 'yellow') {
            if (survivalMonths >= 12) {
                assessment.riskStatus = 'yellow'; // Upgrade Red -> Yellow (or Yellow -> Yellow+)
                assessment.reasoning += " | *מוגן ע״י כרית נזילות*";
                assessment.confidence = Math.min(95, assessment.confidence + 20);
            }
            if (survivalMonths >= 24) {
                assessment.riskStatus = 'green'; // Upgrade to Green (The Fortified Orange)
                assessment.reasoning = "סיכון תזרימי מנוטרל ע״י נכסים נזילים (24+ חודשים)";
                assessment.confidence = 99;
            }
        }
    }

    return { ...assessment, resilienceScore };
};

function buildFinancialModel(transactions, dynamicAnchors) {
    if (!transactions || transactions.length < 10) {
        return {
            fixedSchedule: Array(32).fill(0),
            variableStats: { mean: -100, stdDev: 50 },
            avgMonthlySpend: 3000
        };
    }

    const anchorSet = dynamicAnchors instanceof Set ? dynamicAnchors : new Set(dynamicAnchors || []);
    const fixedEvents = {}; 
    const txByDateStr = {};
    
    transactions.forEach(t => {
        const dateObj = t.date instanceof Date ? t.date : new Date(t.date);
        if (isNaN(dateObj.getTime())) return;

        const day = dateObj.getDate();
        const desc = (t.description || '').toLowerCase();
        let amount = t.amount !== undefined ? t.amount : ((t.credit || 0) - (t.debit || 0));
        
        const cleanDesc = desc.replace(/[0-9\/\-\.\,:\*#]/g, ' ').trim().replace(/\s+/g, ' ');
        const isAnchor = anchorSet.has(cleanDesc);
        const isFixedKeyword = FIXED_KEYWORDS.some(k => desc.includes(k));
        const isLikelySalary = (t.credit > 4000) || (amount > 4000);
        
        if (isAnchor || isFixedKeyword || isLikelySalary) {
            if (!fixedEvents[day]) fixedEvents[day] = [];
            fixedEvents[day].push(amount);
        } else if (amount < 0) {
            const dateStr = dateObj.toDateString();
            if (!txByDateStr[dateStr]) txByDateStr[dateStr] = 0;
            txByDateStr[dateStr] += amount;
        }
    });

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
    
    const dailyFixed = fixedSchedule.reduce((a,b) => a+b, 0) / 30;
    const avgMonthlySpend = Math.abs((dailyFixed + mean) * 30);
    
    return {
        fixedSchedule,
        variableStats: { mean, stdDev: Math.sqrt(variance) },
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

function interpretResults(failures, currentBalance, avgMonthlySpend) {
    const failureRate = failures.length / SIMULATIONS;
    const confidence = Math.round((1 - failureRate) * 100);
    
    if (avgMonthlySpend > 0 && currentBalance > (3 * avgMonthlySpend) && failureRate < 0.65) {
        return { 
            riskStatus: 'green', 
            confidence: 100, 
            riskDay: null, 
            reasoning: 'יתרה גבוהה - סיכון נמוך' 
        };
    }
    
    let status = 'green';
    let riskDay = null;
    let reasoning = null;
    
    if (failureRate > CONFIDENCE_THRESHOLD) { 
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
            
            if (medianOffset < 10) reasoning = "עומס חיובים צפוי בימים הקרובים";
            else if (medianOffset > 25) reasoning = "תזרים שלילי לקראת סוף החודש";
            else reasoning = "התחייבויות קבועות גבוהות לפני מועד המשכורת";
        }
    } else if (failureRate > 0.1) {
        status = 'yellow';
        reasoning = "רמת הוצאות גבולית - נדרש מעקב";
    }
    
    return { riskStatus: status, confidence, riskDay, reasoning };
}