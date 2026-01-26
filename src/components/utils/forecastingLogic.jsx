/**
 * FlowUp Hybrid Forecasting Engine (Client-Side)
 * -----------------------------------------------
 * Position-Based CSV Parser (ISO-8859-8 encoding)
 * Hybrid Algorithm: Average Daily Net (70%) + Recent Trend (30%)
 * Safety Buffer: 12% Risk Management (multiply by 0.88)
 * Privacy: All calculations happen in-browser, no data sent to server
 */

import { detectBankFromHeader, parseCSVRow } from './bankParsers';

// Safe number conversion utility
const toNum = (v) => parseFloat(v?.toString().replace(/[^\d.-]/g, '')) || 0;

/**
 * Advanced AI Analysis Module (Local-First)
 */
const analyzeSmartInsights = (transactions) => {
    const insights = [];
    if (!transactions || transactions.length < 5) return insights;

    const now = new Date();
    // Use last 45 days to capture monthly cycles reliably
    const recentTransactions = transactions.filter(t => (now - t.date) / (1000 * 60 * 60 * 24) <= 45);

    // --- LIQUIDITY ANALYSIS AGENT LOGIC ---

    // 1. Detect Duplicate Services (Conflicting Subscriptions)
    const serviceCategories = {
        'streaming_music': {
            label: 'שירותי מוזיקה',
            keywords: ['spotify', 'apple music', 'youtube music', 'deezer', 'tidal', 'applemusic']
        },
        'streaming_video': {
            label: 'שירותי סטרימינג',
            keywords: ['netflix', 'disney', 'amazon prime', 'amazon video', 'hbo', 'apple tv', 'partner tv', 'yes+', 'cellcom tv']
        },
        'cloud_storage': {
            label: 'שירותי ענן',
            keywords: ['google storage', 'icloud', 'dropbox', 'onedrive', 'google drive']
        }
    };

    Object.entries(serviceCategories).forEach(([key, category]) => {
        const foundServices = new Map();
        
        recentTransactions.forEach(t => {
            if (t.debit > 0) {
                const desc = t.description.toLowerCase();
                const matched = category.keywords.find(k => desc.includes(k));
                if (matched) {
                    // Use matched keyword as key to group variations of same service
                    if (!foundServices.has(matched)) {
                        foundServices.set(matched, { total: 0, name: matched });
                    }
                    foundServices.get(matched).total += t.debit;
                }
            }
        });

        if (foundServices.size > 1) {
            // Found duplicates!
            const services = Array.from(foundServices.values());
            const servicesNames = services.map(s => s.name).join(' + ');
            const totalMonthly = services.reduce((sum, s) => sum + s.total, 0);
            const potentialSavings = Math.round(totalMonthly * 0.5); // Assume 50% savings

            insights.push({
                type: 'money_leak',
                title: `⚠️ כפילות ב${category.label}`,
                description: `מצאנו חיובים ל-${servicesNames}. בחר אחד וחסוך כסף.`,
                monthlySavings: potentialSavings,
                annualImpact: potentialSavings * 12,
                safeToSpendImpact: Math.round(potentialSavings / 30),
                icon: 'Copy'
            });
        }
    });

    // 2. Detect Double Charges (Same Amount, Same Business, Same Month)
    // Group by (Amount + Description First Word)
    const doubleChargeCandidates = {};
    
    recentTransactions.forEach(t => {
        if (t.debit > 0) {
            // Key: First word of description + amount
            const firstWord = t.description.trim().split(' ')[0];
            const key = `${firstWord}_${t.debit}`;
            
            if (!doubleChargeCandidates[key]) doubleChargeCandidates[key] = [];
            doubleChargeCandidates[key].push(t);
        }
    });

    Object.values(doubleChargeCandidates).forEach(group => {
        if (group.length > 1) {
            // Check if they are in the same month
            const byMonth = {};
            group.forEach(t => {
                const monthKey = `${t.date.getMonth()}-${t.date.getFullYear()}`;
                if (!byMonth[monthKey]) byMonth[monthKey] = [];
                byMonth[monthKey].push(t);
            });

            Object.entries(byMonth).forEach(([mKey, monthGroup]) => {
                if (monthGroup.length > 1) {
                    // Start checking strict description similarity
                    const desc1 = monthGroup[0].description;
                    const allSimilar = monthGroup.every(t => Math.abs(t.description.length - desc1.length) < 5); // Simple length check heuristic
                    
                    if (allSimilar) {
                        const amount = monthGroup[0].debit;
                        const waste = amount * (monthGroup.length - 1);
                        insights.push({
                            type: 'money_leak',
                            title: '⚠️ חיוב כפול חשוד',
                            description: `חיוב של ₪${amount} הופיע ${monthGroup.length} פעמים החודש ב-'${desc1}'.`,
                            monthlySavings: waste,
                            annualImpact: waste * 12,
                            safeToSpendImpact: Math.round(waste / 30),
                            icon: 'AlertOctagon'
                        });
                    }
                }
            });
        }
    });

    // 3. Compliance & Tax Agent (Hidden Money)
    const taxPotential = {
        pension: { total: 0, count: 0, keywords: ['פנסיה', 'הראל', 'מנורה', 'גמל', 'השתלמות', 'מיטב דש', 'אלטשולר', 'פניקס', 'מגדל'] },
        donations: { total: 0, count: 0, keywords: ['תרומה', 'עמותה', 'אגודה', 'לתת', 'לב אחד', 'איחוד הצלה', 'עיגול לטובה', 'cancer', 'donation'] },
        academic: { found: false, keywords: ['אוניברסיטה', 'מכללה', 'טכניון', 'שכר לימוד', 'בן גוריון', 'תל אביב', 'בר אילן', 'הפתוחה'] }
    };

    recentTransactions.forEach(t => {
        if (t.debit > 0) {
            const desc = t.description.toLowerCase();
            
            // Check Pension (Independent deposits often have tax benefits)
            if (taxPotential.pension.keywords.some(k => desc.includes(k))) {
                taxPotential.pension.total += t.debit;
                taxPotential.pension.count++;
            }
            // Check Donations (Section 46)
            if (taxPotential.donations.keywords.some(k => desc.includes(k))) {
                taxPotential.donations.total += t.debit;
                taxPotential.donations.count++;
            }
            // Check Academic
            if (!taxPotential.academic.found && taxPotential.academic.keywords.some(k => desc.includes(k))) {
                taxPotential.academic.found = true;
            }
        }
    });

    // Generate Pension Insight (35% Tax Credit estimation)
    if (taxPotential.pension.total > 0) {
        // Average monthly if multiple found in 45 days, otherwise take total as representative
        const estimatedMonthly = taxPotential.pension.total / (taxPotential.pension.count > 1 ? 1.5 : 1); 
        const taxCreditMonthly = estimatedMonthly * 0.35;
        
        insights.push({
            type: 'tax_refund',
            title: '💰 החזרי מס על פנסיה/גמל',
            description: 'זיהיתי הפקדות המקנות זיכוי מס של 35%. בדוק זכאותך להחזר.',
            monthlySavings: taxCreditMonthly,
            annualImpact: taxCreditMonthly * 12,
            icon: 'Landmark'
        });
    }

    // Generate Donation Insight (35% Tax Refund)
    if (taxPotential.donations.total > 0) {
        const estimatedMonthly = taxPotential.donations.total;
        const refundMonthly = estimatedMonthly * 0.35;

        insights.push({
            type: 'tax_refund',
            title: '🤝 החזר מס על תרומות',
            description: 'תרומות למוסדות מוכרים (סעיף 46) מזכות בהחזר של 35%.',
            monthlySavings: refundMonthly,
            annualImpact: refundMonthly * 12,
            icon: 'Heart'
        });
    }

    // Generate Academic Insight (Tax Points)
    if (taxPotential.academic.found) {
        const creditPointValueYear = 2904; // Approx value of 1 point
        insights.push({
            type: 'tax_refund',
            title: '🎓 זיכוי מס אקדמי',
            description: 'סטודנטים/בוגרים זכאים לנקודות זיכוי במס. אל תשכח לדרוש אותן.',
            monthlySavings: creditPointValueYear / 12,
            annualImpact: creditPointValueYear,
            icon: 'GraduationCap'
        });
    }

    // --- END AGENT LOGIC ---

    // 4. Subscription Scanner Agent (Recurring Bills & Usage Check)
    // Group by description for recurring payments
    const groups = {};
    recentTransactions.forEach(t => { // Use recentTransactions (45 days) for relevance
        if (t.debit > 0) {
            const key = t.description.replace(/[0-9\/\-\.]/g, '').trim().substring(0, 25);
            if (!groups[key]) groups[key] = [];
            groups[key].push(t);
        }
    });

    const FIXED_KEYWORDS = ['מכבי', 'כללית', 'חברת חשמל', 'חשמל', 'ארנונה', 'מים', 'משכנתא', 'שכר דירה', 'גז', 'ועד בית'];
    
    Object.entries(groups).forEach(([name, items]) => {
        const isFixed = FIXED_KEYWORDS.some(kw => name.includes(kw));
        if (isFixed) return;

        if (items.length >= 2) { // At least 2 occurrences to be "recurring"
            const amounts = items.map(i => i.debit);
            const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
            const lastAmount = amounts[0]; 

            // Sub-Agent: Anomaly Detector (Bill Jump)
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

            // Sub-Agent: Subscription Optimizer
            // Check for subscriptions that might be unused or optimizable
            if (items.length >= 1 && amounts.every(a => Math.abs(a - avg) < 5)) {
                let isSubscription = false;
                let actionDesc = '';
                let iconType = 'CreditCard';

                // Categorize
                const telecom = ['פרטנר', 'סלקום', 'פלאפון', 'הוט', 'בזק', 'גולן', '019', 'we4g'];
                const insurance = ['הראל', 'מגדל', 'מנורה', 'הפניקס', 'כלל', 'איידי', 'ביטוח ישיר', 'AIG'];
                const media = ['נטפליקס', 'ספוטיפיי', 'יוטיוב', 'דיסני', 'אפל', 'APPLE', 'NETFLIX', 'SPOTIFY', 'DISNEY', 'YOUTUBE'];
                const bank = ['עמלה', 'דמי כרטיס', 'דמי ניהול'];
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
                } else if (bank.some(b => name.includes(b))) {
                    isSubscription = true;
                    actionDesc = 'עמלה שניתן לבטל בשיחת טלפון אחת לבנק.';
                    iconType = 'Wallet';
                } else if (gym.some(g => name.includes(g))) {
                    isSubscription = true;
                    actionDesc = 'האם אתם מתמידים? אם לא, חבל על התשלום הקבוע.';
                    iconType = 'Dumbbell';
                }

                if (isSubscription) {
                    insights.push({
                        type: 'money_leak', // Upgrade to Agent Card (Dark)
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

    // Prioritize Money Leaks
    return insights.sort((a, b) => (b.type === 'money_leak' ? 1 : -1)).slice(0, 5); 
};

export const processAndForecast = (csvText) => {
    try {
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            return { error: "קובץ ריק או לא תקין" };
        }

        // Improved Parsing using dedicated Bank Parsers
        const headerLine = lines[0];
        const bankType = detectBankFromHeader(headerLine);
        const delimiter = headerLine.includes(';') ? ';' : ',';
        const headers = headerLine.split(delimiter).map(h => h.trim().replace(/"/g, ''));

        let totalCredit = 0;
        let totalDebit = 0;
        let currentBalance = 0;
        let lastRowCredit = 0;
        let lastRowDebit = 0;
        const uniqueDates = new Set();
        const allTransactions = [];

        // Parse using robust parser
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const row = line.split(delimiter).map(v => v.trim().replace(/"/g, ''));
            const parsed = parseCSVRow(row, headers, bankType);
            
            if (parsed) {
                // Parse date
                let transactionDate = null;
                const dateStr = parsed.date;
                if (dateStr.includes('/')) {
                    const parts = dateStr.split('/');
                    const day = parseInt(parts[0]);
                    const month = parseInt(parts[1]) - 1;
                    const year = parts[2].length === 4 ? parseInt(parts[2]) : 2000 + parseInt(parts[2]);
                    transactionDate = new Date(year, month, day);
                } else {
                    transactionDate = new Date(dateStr);
                }

                if (transactionDate && !isNaN(transactionDate.getTime())) {
                    allTransactions.push({
                        date: transactionDate,
                        description: parsed.description || 'תנועה',
                        debit: parsed.debit || 0,
                        credit: parsed.credit || 0,
                        balance: parsed.balance
                    });
                    uniqueDates.add(transactionDate.toDateString());
                }
                
                // Track latest balance (assuming file is sorted, but safe to update)
                if (parsed.balance) currentBalance = parsed.balance;
            }
        }

        // Sort transactions by date (descending)
        allTransactions.sort((a, b) => b.date - a.date);
        
        // Update currentBalance from most recent transaction if available
        if (allTransactions.length > 0) {
            currentBalance = allTransactions[0].balance;
            lastRowCredit = allTransactions[0].credit;
            lastRowDebit = allTransactions[0].debit;
        }

        // 1. Calculate All-Time Totals (for Forecasting)
        let allTimeCredit = 0;
        let allTimeDebit = 0;
        allTransactions.forEach(tx => {
            allTimeCredit += tx.credit;
            allTimeDebit += tx.debit;
        });

        // 2. Calculate Last Month Totals (for Dashboard Display)
        let uniqueDaysInTargetMonth = new Set();
        // Reset totals for the "Display" variables to ensure they only contain the target month
        totalCredit = 0; 
        totalDebit = 0;
        let fixedExpenses = 0;
        let flexExpenses = 0;

        if (allTransactions.length > 0) {
            const mostRecentDate = allTransactions[0].date;
            const targetMonth = mostRecentDate.getMonth();
            const targetYear = mostRecentDate.getFullYear();

            // Filter for strictly the last month
            const monthTransactions = allTransactions.filter(tx => 
                tx.date.getMonth() === targetMonth && 
                tx.date.getFullYear() === targetYear
            );

            // Expanded list of Fixed Expenses (Anchors)
            const FIXED_KEYWORDS_LIST = [
                // Housing & Utilities
                'משכנתא', 'שכר דירה', 'ועד בית', 'ארנונה', 'חשמל', 'חברת חשמל', 'מים', 'גז', 'עירייה', 'מועצה',
                // Government & Taxes
                'ביטוח לאומי', 'מס הכנסה', 'דו"ח', 'משטרה', 'קנס', 'כביש 6', 'מנהרות הכרמל',
                // Telecom & Internet
                'סלקום', 'פרטנר', 'פלאפון', 'הוט', 'בזק', '019', 'we4g', 'גולן', 'yes', 'fiber', 'תשתית', 'ספק', 'internet', 'mobile',
                // Insurance & Finance
                'מכבי', 'כללית', 'מאוחדת', 'לאומית', 'הראל', 'מגדל', 'מנורה', 'פניקס', 'כלל', 'ביטוח', 'aig', 'עמלה', 'הלוואה', 'ריבית',
                // Education
                'גן', 'צהרון', 'מעון', 'בית ספר', 'שכר לימוד', 'חוג', 'אוניברסיטה', 'מכללה', 'טכניון',
                // Subscriptions & Software
                'נטפליקס', 'netflix', 'ספוטיפיי', 'spotify', 'youtube', 'apple', 'google', 'icloud', 'microsoft', 'adobe', 'zoom'
            ];

            for (const tx of monthTransactions) {
                totalDebit += tx.debit;
                totalCredit += tx.credit;
                const dayKey = `${tx.date.getFullYear()}-${tx.date.getMonth()}-${tx.date.getDate()}`;
                uniqueDaysInTargetMonth.add(dayKey);

                // Calculate Fixed (Anchors) vs Flex (Variable)
                if (tx.debit > 0) {
                    const desc = (tx.description || '').toLowerCase();
                    const isFixed = FIXED_KEYWORDS_LIST.some(kw => desc.includes(kw.toLowerCase()));
                    if (isFixed) {
                        fixedExpenses += tx.debit;
                    } else {
                        flexExpenses += tx.debit;
                    }
                }
            }
        }

        if (uniqueDates.size === 0) {
            return { error: "לא נמצאו עסקאות תקינות" };
        }

        // 2. HYBRID ALGORITHM
        const totalDays = uniqueDates.size;

        // Average Daily Net = (AllTimeCredit - AllTimeDebit) / TotalDays
        // We use All-Time data for the forecast trend to be more accurate and stable
        const avgDailyNet = (allTimeCredit - allTimeDebit) / totalDays;

        // Recent Trend = LastRow Credit - LastRow Debit
        const recentTrend = lastRowCredit - lastRowDebit;

        // Hybrid Daily = (AverageDailyNet * 0.7) + (RecentTrend * 0.3)
        const hybridDaily = (avgDailyNet * 0.7) + (recentTrend * 0.3);

        // 3. Safe Forecast with 12% Buffer
        const rawForecast = currentBalance + (hybridDaily * 30);
        const safeForecast = rawForecast * 0.88;
        const projectedEOM = safeForecast;

        // 4. Calculate daily spending (Avg Daily Spending based on Whole CSV)
        // We use All-Time Debit for the risk calculation to align with the "Whole CSV" requirement
        const avgDailySpending = allTimeDebit / totalDays;

        // 5. Determine risk status (Initial - refined by graph later)
        let riskStatus = "green";
        let riskDay = null;

        if (projectedEOM < 0) {
            riskStatus = "red";
        } else if (projectedEOM < currentBalance * 0.2) {
            riskStatus = "yellow";
        }

        // 6. 10th of Month Checkpoint Logic (FlowUp Specific)
        const TARGET_DAY = 10;
        const CONSERVATISM = 0.88;

        // Helper: Get next occurrence of the 10th
        const getNextCheckpoint = () => {
            const d = new Date();
            if (d.getDate() >= TARGET_DAY) {
                d.setMonth(d.getMonth() + 1);
            }
            d.setDate(TARGET_DAY);
            return d;
        };

        // 1. Expected Salary (Income days 1-10)
        // Filter credits between day 1 and 10
        const incomeTxns = allTransactions.filter(t => t.credit > 0 && t.date.getDate() <= 10);
        const incomeByMonth = {};
        incomeTxns.forEach(t => {
            const key = `${t.date.getFullYear()}-${t.date.getMonth()}`;
            incomeByMonth[key] = (incomeByMonth[key] || 0) + t.credit;
        });
        const incomeValues = Object.values(incomeByMonth);
        const avgSalary = incomeValues.length > 0 
            ? incomeValues.reduce((a,b) => a+b, 0) / incomeValues.length 
            : 0;

        // 2. Expected Credit Charges (Debits on the 10th, +/- 1 day buffer)
        const creditChargeTxns = allTransactions.filter(t => t.debit > 0 && t.date.getDate() >= 9 && t.date.getDate() <= 11);
        const chargesByMonth = {};
        creditChargeTxns.forEach(t => {
             const key = `${t.date.getFullYear()}-${t.date.getMonth()}`;
             chargesByMonth[key] = (chargesByMonth[key] || 0) + t.debit;
        });
        const chargeValues = Object.values(chargesByMonth);
        const avgCreditCharge = chargeValues.length > 0
            ? chargeValues.reduce((a,b) => a+b, 0) / chargeValues.length
            : 0;

        // 3. Monthly Profit & Conservatism
        const monthlyProfit = avgSalary - avgCreditCharge;
        const conservativeProfit = monthlyProfit * CONSERVATISM;

        // 4. Projection: Current Balance + Conservative Profit
        const projection = currentBalance + conservativeProfit;

        const milestoneData = {
            projection: Math.round(projection),
            text: "יתרה צפויה לאחר מועד החיוב הקרוב (ה-10 לחודש)"
        };

        // 7. Generate AI Insights
        const smartInsights = analyzeSmartInsights(allTransactions);

        // 8. Generate forecast graph points & Smart Risk Day Detection
        const graphPoints = [];
        let runningBalance = currentBalance;
        let detectedRiskDate = null;

        for (let i = 0; i <= 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            const roundedBalance = Math.round(runningBalance);

            if (roundedBalance < 0 && !detectedRiskDate) {
                detectedRiskDate = date;
            }

            graphPoints.push({
                date: date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }),
                balance: roundedBalance
            });
            runningBalance += hybridDaily;
        }

        // Set Smart Risk Day (only if within 30 days)
        if (detectedRiskDate) {
            riskDay = detectedRiskDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
            riskStatus = "red"; // Force red if we hit zero within 30 days
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
            smartInsights, // Return AI insights
            milestoneData, // Return Milestone-Only forecast
            expenseAnalysis: { 
                fixed: Math.round(fixedExpenses), 
                flex: Math.round(flexExpenses),
                taxPotential: Math.round(smartInsights.filter(i => i.type === 'tax_refund').reduce((sum, i) => sum + (i.monthlySavings || 0), 0))
            }, // Future Cake Data
            transactionCount: allTransactions.length,
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
 * Calculate What-If scenario impact with 12% Safety Buffer
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

    // 1. Calculate adjusted CURRENT balance (Immediate Liquidity)
    const adjustedCurrentBalance = currentBalance + simulatedIncome - simulatedExpense;

    // 2. Calculate adjusted PROJECTED balance (End of Month Forecast)
    // We start from the raw forecast (Current + Trend) to ensure we don't lose the predictive trend
    const originalRawForecast = baselineForecast.rawScore || (baselineForecast.projectedEOM / 0.88);
    const adjustedRawForecast = originalRawForecast + simulatedIncome - simulatedExpense;

    // Apply Safety Buffer (0.88) to the new total
    const newSafeBalance = adjustedRawForecast * 0.88;

    // Update graph points proportionally & Detect Smart Risk Day
    let detectedRiskDate = null;
    const adjustedGraphPoints = baselineForecast.graphPoints.map((point, index) => {
        const newBalance = Math.round(point.balance + simulatedIncome - simulatedExpense);

        // Check for first day dipping below zero
        if (newBalance < 0 && !detectedRiskDate) {
            // Reconstruct date from index (since we don't have the Date object directly in points, only string)
            const date = new Date();
            date.setDate(date.getDate() + index);
            detectedRiskDate = date;
        }

        return {
            ...point,
            balance: newBalance
        };
    });

    // Smart Risk Day Calculation
    let newRiskDay = null;
    let daysUntilRisk = null;

    if (detectedRiskDate) {
        newRiskDay = detectedRiskDate.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
        const today = new Date();
        const diffTime = Math.abs(detectedRiskDate - today);
        daysUntilRisk = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    }

    // Determine risk status based on SAFE balance (after 0.88) AND actual curve
    let newRiskStatus = "green";
    if (newSafeBalance < 0 || detectedRiskDate) {
        newRiskStatus = "red";
    } else if (newSafeBalance < 1500) {
        newRiskStatus = "yellow";
    }

    let trend = null;
    if (daysUntilRisk !== null && baselineForecast.riskDay) {
         // Only calculate trend if both have risk days
         // Simplified for now since primary goal is accuracy of the day itself
    }

    // Adjust Milestone Data if exists (ensure consistency with display)
    let newMilestoneData = null;
    if (baselineForecast.milestoneData) {
        newMilestoneData = {
            ...baselineForecast.milestoneData,
            projection: Math.round(baselineForecast.milestoneData.projection + simulatedIncome - simulatedExpense)
        };
    }

    return {
        ...baselineForecast,
        currentBalance: Math.round(adjustedCurrentBalance),
        projectedEOM: Math.round(newSafeBalance),
        milestoneData: newMilestoneData || baselineForecast.milestoneData,
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
    version: "1.0.0",
    type: "Client-Side MVP",
    engine: "Hybrid SES + Seasonal Average",
    safetyBuffer: "12% Standard Deviation",
    privacy: "All calculations in-browser"
};