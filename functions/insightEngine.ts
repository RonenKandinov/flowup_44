import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

const runFiscalAgent = (transactions) => {
    const insights = [];
    let insuranceTotal = 0;
    let hasAcademic = false;

    transactions.forEach(tx => {
        if (tx.debit <= 0) return;

        const desc = tx.description.toLowerCase();
        const detail = (tx.details || "").toLowerCase();
        const amount = tx.debit;

        // A. Donations (Section 46) - 35% Refund
        if (desc.includes('עמותת') || detail.includes('תרומה') || desc.includes('סעיף 46') || detail.includes('סעיף 46')) {
            const refund = amount * 0.35;
            
            insights.push({
                type: 'tax_refund',
                title: 'פוטנציאל שיפור קיבולת החזר: זיכוי מס תרומות',
                description: `זוהה פוטנציאל לשיפור תזרים המזומנים בסך של כ-${Math.round(refund)} ₪ בגין סעיף 46. יש לדרוש מהלקוח מימוש זכאות להקטנת סיכון האשראי.`,
                monthlySavings: refund / 12,
                annualImpact: refund,
                icon: 'Heart'
            });
        }

        // B. Insurance (Section 45) - 25% Credit
        if ((desc.includes('הראל') || desc.includes('כלל') || desc.includes('מגדל') || desc.includes('מנורה') || desc.includes('איילון') || desc.includes('הפניקס')) && 
            (desc.includes('בטוח') || desc.includes('פרמיה') || detail.includes('בטוח') || detail.includes('פרמיה'))) {
            insuranceTotal += amount;
        }

        // C. Academic Studies
        if (desc.includes('אוניברסיטה') || desc.includes('מכללה') || desc.includes('טכניון') || desc.includes('שכר לימוד')) {
            hasAcademic = true;
        }
    });

    if (insuranceTotal > 0) {
        const annualCredit = (insuranceTotal * 12) * 0.25;
        insights.push({
            type: 'tax_refund',
            title: 'פוטנציאל שיפור קיבולת החזר: זיכוי ביטוחים',
            description: `זוהתה כרית ביטחון פוטנציאלית בסך שנתי מוערך של כ-${Math.round(annualCredit)} ₪ בגין החזרי מס על תשלומי ביטוח. נתון זה מהווה חיזוק ליציבות הפיננסית בטווח הארוך.`,
            monthlySavings: annualCredit / 12,
            annualImpact: annualCredit,
            icon: 'Shield'
        });
    }

    if (hasAcademic) {
        const creditPointValueYear = 2904;
        insights.push({
            type: 'tax_refund',
            title: 'פוטנציאל שיפור קיבולת החזר: תואר אקדמי',
            description: 'קיים פוטנציאל משמעותי להגדלת ההכנסה הפנויה באמצעות מימוש נקודות זיכוי במס לאקדמאים. מהווה גורם מפחית סיכון.',
            monthlySavings: creditPointValueYear / 12,
            annualImpact: creditPointValueYear,
            icon: 'GraduationCap'
        });
    }

    return insights;
};

const runLiquidityAgent = (transactions) => {
    const insights = [];
    const recentTransactions = transactions.slice(0, 100);

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
                title: `פוטנציאל שיפור קיבולת החזר: ${category.label}`,
                description: `זוהו התחייבויות חופפות (${servicesNames}). ייעול מבנה ההוצאות עשוי לשפר את מדד ה-DTI ולהגדיל את כושר ההחזר ב-₪${potentialSavings} לחודש.`,
                monthlySavings: potentialSavings,
                annualImpact: potentialSavings * 12,
                safeToSpendImpact: Math.round(potentialSavings / 30),
                icon: 'Copy'
            });
        }
    });

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
                    insights.push({
                        type: 'money_leak',
                        title: 'התראת סיכון: פגם תזרימי',
                        description: `זוהתה שחיקת נזילות מיותרת: חיוב של ₪${amount} הופיע ${monthGroup.length} פעמים החודש ב-'${desc1}'. פגיעה ישירה בקיבולת ההחזר הפנויה.`,
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

const runSubscriptionAgent = (transactions) => {
    const insights = [];
    const groups = {};
    const now = new Date();
    const recentTransactions = transactions.filter(t => {
        const diffDays = (now - t.date) / (1000 * 60 * 60 * 24);
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

            if (lastAmount > avg * 1.2 && lastAmount > 100) {
                const percent = Math.round(((lastAmount/avg)-1)*100);
                const diff = lastAmount - avg;
                insights.push({
                    type: 'alert',
                    title: `תנודתיות בהתחייבויות: ${name}`,
                    description: `חריגה של ${percent}% בהוצאה קבועה (₪${lastAmount}). התנודתיות מהווה משקולת סיכון על תזרים המזומנים החזוי.`,
                    monthlySavings: diff,
                    annualImpact: diff * 12,
                    safeToSpendImpact: Math.round(diff / 30),
                    icon: 'TrendingUp'
                });
            }

            if (items.length >= 1 && amounts.every(a => Math.abs(a - avg) < 5)) {
                let isSubscription = false;
                let actionDesc = '';
                let iconType = 'CreditCard';

                const telecom = ['פרטנר', 'סלקום', 'פלאפון', 'הוט', 'בזק', 'גולן', '019', 'we4g'];
                const insurance = ['הראל', 'מגדל', 'מנורה', 'הפניקס', 'כלל', 'איידי', 'ביטוח ישיר', 'AIG'];
                const media = ['נטפליקס', 'ספוטיפיי', 'יוטיוב', 'דיסני', 'אפל', 'APPLE', 'NETFLIX', 'SPOTIFY', 'DISNEY', 'YOUTUBE'];
                const gym = ['הולמס', 'ספייס', 'פרופיט', 'גו אקטיב', 'חדר כושר', 'סטודיו'];

                if (telecom.some(t => name.includes(t))) {
                    isSubscription = true;
                    actionDesc = 'התייעלות בהוצאות תקשורת עשויה להפחית עומס תזרימי שוטף.';
                    iconType = 'Phone';
                } else if (insurance.some(i => name.includes(i))) {
                    isSubscription = true;
                    actionDesc = 'בחינת כפילויות ביטוח עשויה לחשוף הון נזיל פנוי להחזר.';
                    iconType = 'Shield';
                } else if (media.some(m => name.toUpperCase().includes(m))) {
                    isSubscription = true;
                    actionDesc = 'ביטול מנויי מדיה לא נחוצים צפוי לשפר את מקדם השירות לחוב.';
                    iconType = 'Tv';
                } else if (gym.some(g => name.includes(g))) {
                    isSubscription = true;
                    actionDesc = 'צמצום התחייבויות לשירותי כושר מהווה רזרבה תזרימית לשעת דחק.';
                    iconType = 'Dumbbell';
                }

                if (isSubscription) {
                    insights.push({
                        type: 'money_leak',
                        title: `פוטנציאל שיפור קיבולת החזר: הוצאה קבועה (${name})`,
                        description: `זוהתה נזילות חבויה בסך ₪${avg} לחודש. ${actionDesc}`,
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

const runTrendAgent = (transactions) => {
    const insights = [];
    if (!transactions || transactions.length < 10) return [];

    const expenses = transactions.filter(t => t.debit > 0);
    const IGNORE_LARGE = ['שכר דירה', 'משכנתא', 'העברה', 'כרטיס אשראי', 'הלוואה'];
    
    expenses.slice(0, 10).forEach(t => {
        if (t.debit > 2000) {
            const isIgnored = IGNORE_LARGE.some(kw => t.description.includes(kw));
            if (!isIgnored) {
                insights.push({
                    type: 'alert',
                    title: 'התראת סיכון: תנודתיות חריגה בתזרים',
                    description: `הוצאה לא שגרתית בסך ₪${t.debit.toLocaleString()} ב-${t.description}. אירועים מסוג זה מגבילים את יכולת חיזוי ה-DTI.`,
                    impact: t.debit,
                    monthlySavings: 0,
                    icon: 'AlertTriangle'
                });
            }
        }
    });

    const recentExpenses = expenses.slice(0, 30);
    let weekendSpending = 0;
    recentExpenses.forEach(t => {
        const day = t.date.getDay();
        if (day === 5 || day === 6) {
            weekendSpending += t.debit;
        }
    });

    if (weekendSpending > 1500) {
         insights.push({
            type: 'info',
            title: 'דפוס הוצאות מחזורי (סופ"ש)',
            description: `זוהתה ריכוזיות הוצאות בסך ₪${weekendSpending.toLocaleString()} בסופי שבוע. מצביע על תנודתיות קצרת-טווח בנזילות.`,
            impact: weekendSpending,
            monthlySavings: weekendSpending * 0.2,
            icon: 'Coffee'
        });
    }

    const avgExpense = expenses.reduce((sum, t) => sum + t.debit, 0) / (expenses.length || 1);
    const stdDev = Math.sqrt(expenses.reduce((sum, t) => sum + Math.pow(t.debit - avgExpense, 2), 0) / (expenses.length || 1));
    const stabilityRatio = stdDev / (avgExpense || 1);
    
    const stabilityDesc = stabilityRatio < 1.0 
        ? "פרופיל סיכון נמוך: תנודתיות הוצאות נמוכה מעידה על יציבות תזרימית. הסתברות כשל (PD) נמוכה. מומלץ לאשר מתווה הלוואה ארוך טווח במינוף סטנדרטי."
        : "פרופיל סיכון גבוה: שונות הוצאות גבוהה מצביעה על שבירות פיננסית. יש להקשיח תנאי חיתום. מומלץ לדרוש בטוחות נוספות או להגביל לתקופת מימון קצרה / מסלול בלון.";

    insights.push({
        type: 'info',
        title: 'הערכת יציבות עתידית',
        description: stabilityDesc,
        impact: 0,
        monthlySavings: 0,
        icon: 'TrendingUp'
    });

    return insights;
};

const runLifestyleAgent = (transactions) => {
    const insights = [];
    if (!transactions || transactions.length < 5) return [];

    const now = new Date();
    const recentTxns = transactions.filter(t => 
        (now - t.date) / (1000 * 60 * 60 * 24) <= 30 && t.debit > 0
    );

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
        const potentialSavings = Math.round(diningTotal * 0.3);
        
        insights.push({
            type: 'lifestyle',
            title: 'הערכת כושר החזר משוערכת',
            description: `ניתוח הוצאות גמישות מצביע על יכולת ספיגה של החזר בסך ₪${potentialSavings} לחודש. מומלץ מתווה מימון מדורג (בלון / 72 חודשים) תוך שעבוד הרכב כבטוחה, לאור הוצאה קיימת בסך ₪${diningTotal.toLocaleString()} בתחומי צריכה משתנה.`,
            monthlySavings: potentialSavings,
            annualImpact: potentialSavings * 12,
            icon: 'Utensils'
        });
    }

    return insights;
};

const runStrategicBrainAgent = (insights) => {
    if (!insights || insights.length === 0) return null;

    const moneyLeaks = insights.filter(i => i.type === 'money_leak');
    const taxRefunds = insights.filter(i => i.type === 'tax_refund');
    const lifestyle = insights.filter(i => i.type === 'lifestyle' || i.type === 'info');
    
    const totalPotentialSavings = insights.reduce((sum, i) => sum + (i.annualImpact || 0), 0);
    const quickWins = moneyLeaks.reduce((sum, i) => sum + (i.monthlySavings || 0), 0);
    
    const getTopLeakName = () => {
        if (moneyLeaks.length === 0) return '';
        const top = moneyLeaks.sort((a,b) => b.monthlySavings - a.monthlySavings)[0];
        if (top.title.includes(':')) return top.title.split(':')[1].trim();
        if (top.description.includes('ל-')) {
             const match = top.description.match(/ל-([^.]+)/);
             return match ? match[1].trim() : '';
        }
        return '';
    };

    const topLeakName = getTopLeakName();

    let title = "הערכת אנליסט אשראי";
    let summary = "";
    let actionItem = "";
    let mood = "neutral"; 

    if (totalPotentialSavings > 2000) {
        title = "הערכת אנליסט אשראי: פוטנציאל שיפור קיבולת";
        mood = "happy";
        
        const refundTotal = taxRefunds.reduce((sum, i) => sum + (i.annualImpact || 0), 0);
        const insuranceRefund = taxRefunds.find(i => i.icon === 'Shield');
        const donationRefund = taxRefunds.find(i => i.icon === 'Heart');
        
        let refundSource = "";
        if (insuranceRefund && donationRefund) refundSource = "ביטוחים ותרומות";
        else if (insuranceRefund) refundSource = "כפל ביטוחים";
        else if (donationRefund) refundSource = "תרומות (סעיף 46)";
        else refundSource = "החזרי מס";

        summary = `זוהה מרווח ביטחון תזרימי פוטנציאלי בסך ₪${Math.round(totalPotentialSavings).toLocaleString()} שנתית. מקורות: ${refundSource} (₪${Math.round(refundTotal)}) וייעול התחייבויות${topLeakName ? ` (${topLeakName})` : ''} (₪${Math.round(quickWins)}/חודש). הקצאת אשראי זו נתמכת בכושר ספיגה עודף.`;
        actionItem = "מומלץ להחתים את הלקוח על התחייבות לייעול הוצאות כתנאי לאישור/שיפור תנאי הריבית.";
    } 
    else if (moneyLeaks.length >= 1) {
        title = "הערכת אנליסט אשראי: דליפת נזילות";
        mood = "urgent";
        const leakCountText = moneyLeaks.length > 1 ? `${moneyLeaks.length} מקורות` : "מקור אחד";
        summary = `זוהתה שחיקת הון חוזר כתוצאה מ-${leakCountText}${topLeakName ? ` (בעיקר ${topLeakName})` : ''}. ההשפעה השנתית נאמדת ב-₪${Math.round(quickWins * 12)}. פגיעה ישירה ב-DTI.`;
        actionItem = "ניתן לשפר את יחס שירות החוב (DSR) במידה ויבוטלו התחייבויות משניות אלו.";
    }
    else if (lifestyle.length > 0) {
        title = "הערכת אנליסט אשראי: רגישות להוצאות גמישות";
        mood = "neutral";
        const diningInsight = lifestyle.find(i => i.type === 'lifestyle');
        const focusArea = diningInsight ? "המסעדות והבילויים" : "ההוצאות המשתנות";
        
        summary = `מבנה ההוצאות הקשיחות תקין. קיימת גמישות מבנית ב${focusArea} המאפשרת הקצאת אשראי למימון רכב.`;
        actionItem = "בניית מתווה הלוואה רגיש לתזרים, שקילת שערוך בטוחות או בלוני הון.";
    }
    else {
        title = "הערכת אנליסט אשראי: פרופיל יציב";
        mood = "happy";
        summary = "תזרים המזומנים החזוי מציג עקביות וללא חריגות מהותיות. מקדם היציבות תומך במתן אשראי ברמת הסיכון הבסיסית.";
        actionItem = "מאושר לחיתום. יש ליישם מטריצת תמחור סטנדרטית מבוססת LTV ו-DTI.";
    }

    return {
        type: 'strategic_brain',
        title: title,
        description: summary,
        actionItem: actionItem,
        mood: mood,
        totalPotential: totalPotentialSavings,
        icon: 'BrainCircuit', 
        priority: 1000
    };
};

const getPriorityScore = (insight) => {
    if (insight.type === 'tax_refund') return 100;
    if (insight.type === 'money_leak') return 80;
    if (insight.type === 'alert') return 60;
    return 10;
};

export const runAgents = (transactions) => {
    if (!transactions || transactions.length < 5) return [];

    const now = new Date();
    
    const processedTransactions = transactions.map(t => {
        const debit = t.debit !== undefined ? t.debit : (t.amount < 0 ? Math.abs(t.amount) : 0);
        const credit = t.credit !== undefined ? t.credit : (t.amount > 0 ? t.amount : 0);
        
        return {
            ...t,
            date: t.date ? new Date(t.date) : new Date(),
            debit,
            credit,
            description: String(t.description || ""),
            details: String(t.details || "")
        };
    });

    const fiscalInsights = runFiscalAgent(processedTransactions);

    const recentTransactions = processedTransactions.filter(t => 
        (now - t.date) / (1000 * 60 * 60 * 24) <= 45
    );

    const liquidityInsights = runLiquidityAgent(recentTransactions);
    const subInsights = runSubscriptionAgent(processedTransactions);
    const trendInsights = runTrendAgent(processedTransactions);
    const lifestyleInsights = runLifestyleAgent(processedTransactions);

    const allInsights = [...fiscalInsights, ...liquidityInsights, ...subInsights, ...trendInsights, ...lifestyleInsights];

    const brainInsight = runStrategicBrainAgent(allInsights);
    
    const sortedInsights = allInsights.sort((a, b) => getPriorityScore(b) - getPriorityScore(a));
    
    if (brainInsight) {
        return [brainInsight, ...sortedInsights].slice(0, 7);
    }

    return sortedInsights.slice(0, 6);
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const transactions = body?.transactions || [];

        if (!Array.isArray(transactions) || transactions.length === 0) {
            return Response.json({ success: false, error: "Valid transactions array required" });
        }

        const insights = runAgents(transactions);

        return Response.json({
            success: true,
            insights: insights
        });
    } catch (e) {
        console.error("insightEngine Error:", e);
        return Response.json({ success: false, error: e.message }, { status: 500 });
    }
});