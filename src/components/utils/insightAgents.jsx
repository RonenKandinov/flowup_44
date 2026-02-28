import { runStrategicBrainAgent } from './strategicBrainAgent';

/**
 * FlowUp Insight Agents System
 * The "Brain" that interprets financial data and generates actionable insights
 * Separated from the mathematical forecasting engine for cleaner architecture.
 */

/**
 * 1. Fiscal Agent: Identifies Tax Refunds & Compliance Benefits
 * "The Money Finder"
 */
export const runFiscalAgent = (transactions) => {
    const insights = [];
    let insuranceTotal = 0;
    let hasAcademic = false;

    transactions.forEach(tx => {
        if (tx.debit <= 0) return;

        const desc = tx.description.toLowerCase();
        const detail = (tx.details || "").toLowerCase();
        const amount = tx.debit;

        // A. Donations (Section 46) - 35% Refund
        // Checks strict keywords to identify valid donations
        if (desc.includes('עמותת') || detail.includes('תרומה') || desc.includes('סעיף 46') || detail.includes('סעיף 46')) {
            const refund = amount * 0.35;
            
            insights.push({
                type: 'tax_refund',
                title: 'איתור "הון חבוי": החזרי מס צפויים',
                description: `פוטנציאל להגדלת הנטו הפנוי: זיכוי מס של כ-${Math.round(refund)} ₪ בגין תרומות לפי סעיף 46 ל${tx.description}. מומלץ להנחות את הלקוח להגיש בקשה.`,
                monthlySavings: refund / 12, // For consistent UI sorting
                annualImpact: refund,
                icon: 'Heart'
            });
        }

        // B. Insurance (Section 45) - 25% Credit (Accumulated)
        if ((desc.includes('הראל') || desc.includes('כלל') || desc.includes('מגדל') || desc.includes('מנורה') || desc.includes('איילון') || desc.includes('הפניקס')) && 
            (desc.includes('בטוח') || desc.includes('פרמיה') || detail.includes('בטוח') || detail.includes('פרמיה'))) {
            insuranceTotal += amount;
        }

        // C. Academic Studies
        if (desc.includes('אוניברסיטה') || desc.includes('מכללה') || desc.includes('טכניון') || desc.includes('שכר לימוד')) {
            hasAcademic = true;
        }
    });

    // Add Aggregated Insurance Insight
    if (insuranceTotal > 0) {
        const annualCredit = (insuranceTotal * 12) * 0.25;
        insights.push({
            type: 'tax_refund',
            title: 'איתור "הון חבוי": זיכוי ביטוחים',
            description: `תשלומי ביטוח מזכים בהחזר מס ופוטנציאל לכפילויות. ניתן להגדיל את ההון הפנוי בשווי שנתי מוערך של כ-${Math.round(annualCredit)} ₪.`,
            monthlySavings: annualCredit / 12,
            annualImpact: annualCredit,
            icon: 'Shield'
        });
    }

    // Add Academic Insight
    if (hasAcademic) {
        const creditPointValueYear = 2904;
        insights.push({
            type: 'tax_refund',
            title: 'נקודות זיכוי לאקדמאים',
            description: 'סטודנטים ובוגרים זכאים לנקודות זיכוי במס בשווי אלפי שקלים בשנה.',
            monthlySavings: creditPointValueYear / 12,
            annualImpact: creditPointValueYear,
            icon: 'GraduationCap'
        });
    }

    return insights;
};

/**
 * 2. Liquidity Agent: Detects Money Leaks (Duplicates, Double Charges)
 * "The Plumber"
 */
export const runLiquidityAgent = (transactions) => {
    const insights = [];
    const recentTransactions = transactions.slice(0, 100); // Optimize for recent context

    // A. Duplicate Services
    const serviceCategories = {
        'streaming_music': {
            label: 'שירותי מוזיקה',
            keywords: ['spotify', 'apple music', 'youtube music', 'deezer', 'tidal']
        },
        'streaming_video': {
            label: 'שירותי סטרימינג',
            keywords: ['netflix', 'disney', 'amazon prime', 'amazon video', 'hbo', 'apple tv', 'partner tv', 'yes+', 'cellcom tv']
        },
        'cloud_storage': {
            label: 'שירותי ענן',
            keywords: ['google storage', 'icloud', 'dropbox', 'onedrive']
        }
    };

    Object.entries(serviceCategories).forEach(([key, category]) => {
        const foundServices = new Map();
        
        recentTransactions.forEach(t => {
            if (t.debit > 0) {
                const desc = t.description.toLowerCase();
                const matched = category.keywords.find(k => desc.includes(k));
                if (matched) {
                    if (!foundServices.has(matched)) {
                        foundServices.set(matched, { total: 0, name: matched });
                    }
                    foundServices.get(matched).total += t.debit;
                }
            }
        });

        if (foundServices.size > 1) {
            const services = Array.from(foundServices.values());
            const servicesNames = services.map(s => s.name).join(' + ');
            const totalMonthly = services.reduce((sum, s) => sum + s.total, 0);
            const potentialSavings = Math.round(totalMonthly * 0.5);

            insights.push({
                type: 'money_leak',
                title: `איתור "הון חבוי": כפילות ב${category.label}`,
                description: `זיהוי מנויים שאינם מנוצלים / כפולים (${servicesNames}). ניתן להגדיל את כושר ההחזר על ידי ביטול.`,
                monthlySavings: potentialSavings,
                annualImpact: potentialSavings * 12,
                safeToSpendImpact: Math.round(potentialSavings / 30),
                icon: 'Copy'
            });
        }
    });

    // B. Double Charges (Same Amount, Same Business, Same Month)
    const doubleChargeCandidates = {};
    
    recentTransactions.forEach(t => {
        if (t.debit > 0) {
            const firstWord = t.description.trim().split(' ')[0];
            const key = `${firstWord}_${t.debit}`;
            if (!doubleChargeCandidates[key]) doubleChargeCandidates[key] = [];
            doubleChargeCandidates[key].push(t);
        }
    });

    Object.values(doubleChargeCandidates).forEach(group => {
        if (group.length > 1) {
            const byMonth = {};
            group.forEach(t => {
                const monthKey = `${t.date.getMonth()}-${t.date.getFullYear()}`;
                if (!byMonth[monthKey]) byMonth[monthKey] = [];
                byMonth[monthKey].push(t);
            });

            Object.entries(byMonth).forEach(([mKey, monthGroup]) => {
                if (monthGroup.length > 1) {
                    const desc1 = monthGroup[0].description;
                    const amount = monthGroup[0].debit;
                    // Simple heuristic: if same amount appears multiple times in same month for similar desc
                    insights.push({
                        type: 'money_leak',
                        title: '⚠️ חיוב כפול חשוד',
                        description: `חיוב של ₪${amount} הופיע ${monthGroup.length} פעמים החודש ב-'${desc1}'.`,
                        monthlySavings: amount * (monthGroup.length - 1),
                        annualImpact: amount * (monthGroup.length - 1) * 12,
                        safeToSpendImpact: Math.round((amount * (monthGroup.length - 1)) / 30),
                        icon: 'AlertOctagon'
                    });
                }
            });
        }
    });

    return insights;
};

/**
 * 3. Subscription Agent: Analyzes Recurring Bills
 * "The Optimizer"
 */
export const runSubscriptionAgent = (transactions) => {
    const insights = [];
    const groups = {};
    const recentTransactions = transactions.filter(t => {
        const diffDays = (new Date() - t.date) / (1000 * 60 * 60 * 24);
        return diffDays <= 45;
    });

    recentTransactions.forEach(t => {
        if (t.debit > 0) {
            const key = t.description.replace(/[0-9\/\-\.]/g, '').trim().substring(0, 25);
            if (!groups[key]) groups[key] = [];
            groups[key].push(t);
        }
    });

    const FIXED_KEYWORDS = ['מכבי', 'כללית', 'חברת חשמל', 'חשמל', 'ארנונה', 'מים', 'משכנתא', 'שכר דירה', 'גז', 'ועד בית'];

    Object.entries(groups).forEach(([name, items]) => {
        if (FIXED_KEYWORDS.some(kw => name.includes(kw))) return;

        if (items.length >= 2) {
            const amounts = items.map(i => i.debit);
            const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
            const lastAmount = amounts[0];

            // Anomaly Check
            if (lastAmount > avg * 1.2 && lastAmount > 100) {
                const percent = Math.round(((lastAmount/avg)-1)*100);
                const diff = lastAmount - avg;
                insights.push({
                    type: 'alert',
                    title: `📈 קפיצה בחיוב: ${name}`,
                    description: `חריגה של ${percent}% בחיוב האחרון (₪${lastAmount}).`,
                    monthlySavings: diff,
                    annualImpact: diff * 12,
                    safeToSpendImpact: Math.round(diff / 30),
                    icon: 'TrendingUp'
                });
            }

            // Subscription Check
            if (items.length >= 1 && amounts.every(a => Math.abs(a - avg) < 5)) {
                let isSubscription = false;
                let actionDesc = '';
                let iconType = 'CreditCard';

                // Categorize
                const telecom = ['פרטנר', 'סלקום', 'פלאפון', 'הוט', 'בזק', 'גולן', '019', 'we4g'];
                const insurance = ['הראל', 'מגדל', 'מנורה', 'הפניקס', 'כלל', 'איידי', 'ביטוח ישיר', 'AIG'];
                const media = ['נטפליקס', 'ספוטיפיי', 'יוטיוב', 'דיסני', 'אפל', 'APPLE', 'NETFLIX', 'SPOTIFY', 'DISNEY', 'YOUTUBE'];
                const gym = ['הולמס', 'ספייס', 'פרופיט', 'גו אקטיב', 'חדר כושר', 'סטודיו'];

                if (telecom.some(t => name.includes(t))) {
                    isSubscription = true;
                    actionDesc = 'לקוחות משלמים בממוצע 30% פחות. שווה להתקשר למיקוח.';
                    iconType = 'Phone';
                } else if (insurance.some(i => name.includes(i))) {
                    isSubscription = true;
                    actionDesc = 'מומלץ לבדוק כפל ביטוחים באתר "הר הביטוח".';
                    iconType = 'Shield';
                } else if (media.some(m => name.toUpperCase().includes(m))) {
                    isSubscription = true;
                    actionDesc = 'האם המנוי בשימוש? שקול חבילה משפחתית או ביטול.';
                    iconType = 'Tv';
                } else if (gym.some(g => name.includes(g))) {
                    isSubscription = true;
                    actionDesc = 'האם אתם מתמידים? אם לא, חבל על התשלום הקבוע.';
                    iconType = 'Dumbbell';
                }

                if (isSubscription) {
                    insights.push({
                        type: 'money_leak',
                        title: `🔔 מנוי חודשי: ${name}`,
                        description: actionDesc,
                        monthlySavings: avg,
                        annualImpact: avg * 12,
                        safeToSpendImpact: Math.round(avg / 30),
                        icon: iconType
                    });
                }
            }
        }
    });

    return insights;
};

/**
 * Main Runner
 */
/**
 * 4. Trend Agent: Identifies Spending Spikes & Large Expenses
 * "The Analyst"
 */
export const runTrendAgent = (transactions) => {
    const insights = [];
    if (!transactions || transactions.length < 10) return [];

    // Filter expenses only
    const expenses = transactions.filter(t => t.debit > 0);
    
    // 1. Large Expense Detector (> 2000 NIS) that is not Rent/Mortgage
    const IGNORE_LARGE = ['שכר דירה', 'משכנתא', 'העברה', 'כרטיס אשראי', 'הלוואה'];
    
    expenses.slice(0, 10).forEach(t => { // Look at 10 most recent
        if (t.debit > 2000) {
            const isIgnored = IGNORE_LARGE.some(kw => t.description.includes(kw));
            if (!isIgnored) {
                insights.push({
                    type: 'alert',
                    title: 'הוצאה חריגה זוהתה',
                    description: `הוצאה של ₪${t.debit.toLocaleString()} ב-${t.description}. האם זה היה מתוכנן?`,
                    impact: t.debit, // One-time impact
                    monthlySavings: 0,
                    icon: 'AlertTriangle'
                });
            }
        }
    });

    // 2. Weekend Spender (Spending on Fri/Sat)
    const recentExpenses = expenses.slice(0, 30);
    let weekendSpending = 0;
    recentExpenses.forEach(t => {
        const day = t.date.getDay(); // 5 = Fri, 6 = Sat
        if (day === 5 || day === 6) {
            weekendSpending += t.debit;
        }
    });

    if (weekendSpending > 1500) {
         insights.push({
            type: 'info',
            title: 'דפוס סופ"ש',
            description: `הוצאת ₪${weekendSpending.toLocaleString()} בסופי שבוע האחרונים.`,
            impact: weekendSpending,
            monthlySavings: weekendSpending * 0.2, // Suggest 20% cut
            icon: 'Coffee'
        });
    }

    return insights;
};

/**
 * Main Runner
 */
export const runAgents = (transactions) => {
    if (!transactions || transactions.length < 5) return [];

    const now = new Date();
    
    // תיקון 1: המרה בטוחה לתאריכים (מונע את ה-NaN)
    const processedTransactions = transactions.map(t => ({
        ...t,
        date: t.date instanceof Date ? t.date : new Date(t.date)
    }));

    // תיקון 2: הסוכן הפיסקלי מקבל את כל ההיסטוריה (כי מס זה שנתי!)
    const fiscalInsights = runFiscalAgent(processedTransactions);

    // שאר הסוכנים (כפילויות וכו') ימשיכו להסתכל רק על 45 יום
    const recentTransactions = processedTransactions.filter(t => 
        (now - t.date) / (1000 * 60 * 60 * 24) <= 45
    );

    const liquidityInsights = runLiquidityAgent(recentTransactions);
    const subInsights = runSubscriptionAgent(processedTransactions);
    const trendInsights = runTrendAgent(processedTransactions); // Run on full history/processed

    // Run Lifestyle Agent (Dining/Restaurants)
    const lifestyleInsights = runLifestyleAgent(processedTransactions);

    const allInsights = [...fiscalInsights, ...liquidityInsights, ...subInsights, ...trendInsights, ...lifestyleInsights];

    // 6. Run Strategic Brain (CEO) on the results
    const brainInsight = runStrategicBrainAgent(allInsights);
    
    // Combine: Brain First, then the rest sorted by priority
    const sortedInsights = allInsights.sort((a, b) => getPriorityScore(b) - getPriorityScore(a));
    
    if (brainInsight) {
        return [brainInsight, ...sortedInsights].slice(0, 7); // Allow 7 to include brain + 6 others
    }

    return sortedInsights.slice(0, 6);
};

/**
 * 5. Lifestyle Agent: Analyzes Discretionary Spending (Dining, etc.)
 */
export const runLifestyleAgent = (transactions) => {
    const insights = [];
    if (!transactions || transactions.length < 5) return [];

    // Filter last 30 days
    const now = new Date();
    const recentTxns = transactions.filter(t => 
        (now - t.date) / (1000 * 60 * 60 * 24) <= 30 && t.debit > 0
    );

    // Dining & Restaurants
    const diningKeywords = ['wolt', 'תן ביס', '10bis', 'סיבוס', 'cibus', 'משלוחה', 'mishloha', 'גולדה', 'rebar', 'ארומה', 'קפה', 'מסעדה', 'פיצה', 'בורגר', 'סושי', 'מקדונלד', 'דומינו', 'arcaffe', 'landwer', 'לנדוור', 'aroma', 'cafe', 'restaurant', 'bar', 'pub'];
    
    let diningTotal = 0;
    let diningCount = 0;

    recentTxns.forEach(t => {
        const desc = t.description.toLowerCase();
        if (diningKeywords.some(kw => desc.includes(kw))) {
            diningTotal += t.debit;
            diningCount++;
        }
    });

    if (diningTotal > 800) {
        // Calculate potential savings (cutting back by 30%)
        const potentialSavings = Math.round(diningTotal * 0.3);
        
        insights.push({
            type: 'lifestyle',
            title: '🍔 הוצאות מסעדות ובילויים',
            description: `הוצאת ₪${diningTotal.toLocaleString()} על אוכל בחוץ החודש (${diningCount} עסקאות). בישול בבית פעמיים בשבוע יחסוך לך כ-₪${potentialSavings}.`,
            monthlySavings: potentialSavings,
            annualImpact: potentialSavings * 12,
            icon: 'Utensils'
        });
    }

    return insights;
};

const getPriorityScore = (insight) => {
    if (insight.type === 'tax_refund') return 100;
    if (insight.type === 'money_leak') return 80;
    if (insight.type === 'alert') return 60;
    return 10;
};