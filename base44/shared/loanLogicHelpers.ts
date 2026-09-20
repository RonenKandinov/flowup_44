// Shared statistical + Open-Finance parsing helpers used by loanLogicV2.
// Extracted out of entry.ts to cut duplication and keep the function file smaller —
// pure functions only, no behavior change from the original inline versions.

export function getStandardDeviation(array) {
    if (!array || array.length === 0) return 0;
    const n = array.length;
    const mean = array.reduce((a, b) => a + b, 0) / n;
    const variance = array.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
    return Math.sqrt(variance);
}

export function getMedian(array) {
    if (!array || array.length === 0) return 0;
    const sorted = [...array].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * MAD-based outlier filter (Median Absolute Deviation).
 * A single one-off transfer / atypical month can lift a 12-month "average expenses"
 * by tens of percent. Mean-based heuristics can't catch this — but MAD is robust to
 * outliers by definition. Any monthly value whose distance from the median exceeds
 * 3 × MAD is treated as an outlier and excluded from the average.
 */
export function filterMonthlyOutliersMAD(values, threshold = 3) {
    if (!values || values.length < 4) return values || [];
    const median = getMedian(values);
    const absDeviations = values.map(v => Math.abs(v - median));
    const mad = getMedian(absDeviations);
    if (mad === 0) return values;
    return values.filter(v => Math.abs(v - median) / mad <= threshold);
}

/**
 * Weighted Rolling Average — Base + Recent Trend model.
 *   final = 0.6 × avg(full window, up to 12 months)   [PAST — stability base]
 *         + 0.4 × avg(last 3 months)                  [PRESENT — recent trend]
 */
export function getWeightedAverage(values) {
    if (!values || values.length === 0) return 0;
    const baseAvg = values.reduce((a, b) => a + b, 0) / values.length;
    if (values.length < 4) return baseAvg;
    const recentCount = Math.min(3, values.length);
    const recent = values.slice(-recentCount);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    return (baseAvg * 0.6) + (recentAvg * 0.4);
}

/**
 * Coefficient of Variation (CV) — dimensionless measure of relative volatility.
 * CV = StdDev / Mean. Used for risk-adjusted "haircut" on income.
 */
export function getCoefficientOfVariation(values) {
    if (!values || values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean === 0) return 0;
    const sd = getStandardDeviation(values);
    return sd / mean;
}

/**
 * Extracts a raw date string from an Open Finance transaction object — tx.date can be
 * either a string or a nested {valueDate, bookingDate, transactionDate} object depending
 * on the provider.
 */
export function getTxDateStr(tx) {
    const txDateObj = tx?.date;
    return tx?.creationDate ||
        (typeof txDateObj === 'string' ? txDateObj : (txDateObj?.valueDate || txDateObj?.bookingDate || txDateObj?.transactionDate)) ||
        tx?.transactionDate;
}

/**
 * Classifies an Open Finance account record into checking/investment/training-fund/overdraft
 * using its type/name/product/details fields.
 */
export function classifyAccountType(acc) {
    const type = (acc.type || acc.accountType || "").toLowerCase();
    const name = (acc.name || acc.accountName || "").toLowerCase();
    const product = (acc.product || "").toLowerCase();
    const details = (acc.details || "").toLowerCase();
    const cashAccountType = (acc.cashAccountType || "").toLowerCase();

    const isOverdraft = type.includes('overdraft') || name.includes('overdraft') || name.includes('מינוס') || product.includes('מינוס');
    const isInvestment = type.includes('investment') || type.includes('securities') || name.includes('תיק') || name.includes('השקעות') || name.includes('ניירות ערך') || name.includes('סחירות') || name.includes('מנייתי') || name.includes('מט"ח') || name.includes('ibi') || name.includes('meitav') || name.includes('excellence') || product.includes('השקעות') || product.includes('ניירות ערך');
    const isTrainingFund = type.includes('training') || type.includes('provident') || type.includes('pension') || name.includes('השתלמות') || name.includes('גמל') || name.includes('פנסיה') || name.includes('קופת') || product.includes('השתלמות') || product.includes('גמל') || product.includes('פנסיה');
    const isChecking = type.includes('checking') || type.includes('current') || cashAccountType.includes('cacc') || name.includes('עו"ש') || name.includes('עובר ושב') || product.includes('עו"ש') || product.includes('עובר ושב') || details.includes('עו"ש');

    return { type, name, product, details, cashAccountType, isOverdraft, isInvestment, isTrainingFund, isChecking };
}

/**
 * Detects cross-account self-transfers: same amount (± small fee tolerance) moving OUT of one
 * account and IN to another within a 48-hour window. These are NOT real income/expense.
 */
export function detectSelfTransfers(transactions, parseAmount) {
    const matched = new Set();
    const FEE_TOLERANCE = 0.02; // 2% tolerance for transfer fees
    const TIME_WINDOW_MS = 48 * 60 * 60 * 1000;

    const indexed = transactions.map((tx, idx) => {
        const amount = parseAmount(tx);
        const dateStr = getTxDateStr(tx);
        const date = dateStr ? new Date(dateStr) : null;
        const accId = String(tx?.accountId || tx?.account_id || tx?.accountNumber || "");
        return { idx, amount, date, accId, tx };
    }).filter(x => x.date && !isNaN(x.date.getTime()) && !isNaN(x.amount));

    const outflows = indexed.filter(x => x.amount < 0);
    const inflows = indexed.filter(x => x.amount > 0);

    for (const out of outflows) {
        if (matched.has(out.idx)) continue;
        const outAbs = Math.abs(out.amount);

        for (const inf of inflows) {
            if (matched.has(inf.idx)) continue;
            if (out.accId && inf.accId && out.accId === inf.accId) continue; // same account — not a transfer

            const timeDiff = Math.abs(inf.date.getTime() - out.date.getTime());
            if (timeDiff > TIME_WINDOW_MS) continue;

            const amountDiff = Math.abs(inf.amount - outAbs) / outAbs;
            if (amountDiff <= FEE_TOLERANCE) {
                matched.add(out.idx);
                matched.add(inf.idx);
                break;
            }
        }
    }

    return matched;
}

export function extractBalance(acc) {
    let balance = 0;
    let extractionPath = 'none';
    let rawValues = {};

    try {
        if (!acc || typeof acc !== 'object') return { balance: 0, path: 'invalid_account_obj' };

        if (acc.availableBalance !== undefined) {
            rawValues.availableBalance = acc.availableBalance;
            balance = Number(acc.availableBalance);
            extractionPath = 'availableBalance';
        }
        else if (acc.currentBalance !== undefined) {
            rawValues.currentBalance = acc.currentBalance;
            balance = Number(acc.currentBalance);
            extractionPath = 'currentBalance';
        }
        else if (Array.isArray(acc.balances) && acc.balances.length > 0) {
            rawValues.balances = acc.balances;

            let targetBal = acc.balances.find(b =>
                b.balanceType === "interimAvailable" ||
                b.type === "interimAvailable" ||
                b.balanceType === "available" ||
                b.type === "available"
            );

            if (!targetBal) {
                targetBal = acc.balances.find(b =>
                    b.balanceType === "closingBooked" ||
                    b.type === "closingBooked" ||
                    b.balanceType === "booked" ||
                    b.type === "booked"
                );
            }

            if (!targetBal) targetBal = acc.balances[0];

            if (targetBal) {
                if (targetBal?.amount?.amount !== undefined) {
                    balance = Number(targetBal.amount.amount);
                    extractionPath = 'balances[].amount.amount';
                } else if (targetBal?.balanceAmount?.amount !== undefined) {
                    balance = Number(targetBal.balanceAmount.amount);
                    extractionPath = 'balances[].balanceAmount.amount';
                } else if (targetBal?.balanceAmount?.value !== undefined) {
                    balance = Number(targetBal.balanceAmount.value);
                    extractionPath = 'balances[].balanceAmount.value';
                } else if (targetBal?.amount !== undefined) {
                    balance = Number(targetBal.amount);
                    extractionPath = 'balances[].amount';
                } else if (targetBal?.value !== undefined) {
                    balance = Number(targetBal.value);
                    extractionPath = 'balances[].value';
                }
            }
        }
        else if (acc.balance !== undefined) {
            rawValues.balance = acc.balance;
            if (typeof acc.balance === 'object' && acc.balance !== null) {
                if (acc.balance.amount !== undefined) {
                    balance = Number(acc.balance.amount);
                    extractionPath = 'balance.amount';
                } else if (acc.balance.value !== undefined) {
                    balance = Number(acc.balance.value);
                    extractionPath = 'balance.value';
                }
            } else {
                balance = Number(acc.balance);
                extractionPath = 'balance';
            }
        }

        if (isNaN(balance) || balance === null) {
            console.warn(`[QA Warning] Balance evaluated to NaN/null. Raw:`, JSON.stringify(rawValues));
            balance = 0;
            extractionPath += '_failed_nan';
        }

    } catch (err) {
        console.error(`[QA Error] Extraction crashed: ${err.message}`, acc);
        balance = 0;
        extractionPath = 'error_catch';
    }

    return { balance, path: extractionPath };
}

// --- UNIT TESTS (Run on module load) ---
function runBalanceExtractionTests() {
    const testCases = [
        { name: "OB format 1", data: { balances: [{ balanceType: "interimAvailable", amount: { amount: "100.5" } }] }, expected: 100.5 },
        { name: "OB format 2", data: { balances: [{ type: "closingBooked", amount: 200 }] }, expected: 200 },
        { name: "Direct balance obj", data: { balance: { amount: "300" } }, expected: 300 },
        { name: "Direct balance num", data: { balance: 400 }, expected: 400 },
        { name: "currentBalance", data: { currentBalance: "500" }, expected: 500 },
        { name: "availableBalance", data: { availableBalance: 600 }, expected: 600 },
        { name: "Empty/Invalid", data: {}, expected: 0 },
        { name: "Corrupted amount", data: { balance: "N/A" }, expected: 0 },
    ];

    let passed = 0;
    testCases.forEach(tc => {
        const result = extractBalance(tc.data);
        if (result.balance === tc.expected) {
            passed++;
        } else {
            console.error(`[Test Failed] ${tc.name}: Expected ${tc.expected}, got ${result.balance} (Path: ${result.path})`);
        }
    });
    console.log(`[QA Tests] ${passed}/${testCases.length} balance extraction unit tests passed.`);
}
runBalanceExtractionTests();

// --- FORENSIC INTELLIGENCE ENGINE ---
// FlowUp's "must-have" layer: surfaces signals that BDI / credit reports CANNOT see,
// because they are built on raw transaction-level cash-flow rather than reported events.
// Purely additive — it never touches the scoring pipeline.
export function buildForensicIntelligence({ behaviorProfile, history, trends, declaredMonthlyExpenses }) {
    try {
        const out = {};

        const isSalaryLabel = (label) => {
            const l = String(label || '').toLowerCase();
            return ['משכורת', 'משכ', 'שכר', 'salary', 'payroll', 'פנסיה', 'קצבה', 'ביטוח לאומי', 'מלגה'].some(kw => l.includes(kw));
        };
        const gigTokens = ['wolt', 'וולט', 'shopify', 'fiverr', 'upwork', 'paypal', 'פייפאל', 'bit', 'ביט', 'paybox', 'uber', 'airbnb', 'etsy', 'amazon', 'freelance', 'עצמאי', 'הכנסה'];
        const sideIncomeStreams = (behaviorProfile?.recurringIncome || [])
            .filter(r => !isSalaryLabel(r.label))
            .map(r => {
                const l = String(r.label || '').toLowerCase();
                const isGig = gigTokens.some(t => l.includes(t));
                return { label: r.label, avgAmount: r.avgAmount, occurrences: r.occurrences, isGigPlatform: isGig };
            })
            .filter(r => r.avgAmount > 0);
        const sideIncomeMonthlyTotal = sideIncomeStreams.reduce((s, r) => s + r.avgAmount, 0);
        out.sideIncome = {
            hasSideIncome: sideIncomeStreams.length > 0 && sideIncomeMonthlyTotal > 0,
            monthlyTotal: Math.round(sideIncomeMonthlyTotal),
            streams: sideIncomeStreams.slice(0, 4),
            gigEconomyDetected: sideIncomeStreams.some(r => r.isGigPlatform)
        };

        let activityDecline = { detected: false, incomeDropPct: 0, severity: 'NONE' };
        const incomeMonths = (history || []).filter(m => m.income > 0).map(m => m.income);
        if (incomeMonths.length >= 5) {
            const recent = incomeMonths.slice(-3);
            const prior = incomeMonths.slice(0, -3);
            const recentMed = getMedian(recent);
            const priorMed = getMedian(prior);
            if (priorMed > 0) {
                const dropPct = Math.round(((priorMed - recentMed) / priorMed) * 100);
                if (dropPct >= 15) {
                    activityDecline = {
                        detected: true,
                        incomeDropPct: dropPct,
                        recentMedianIncome: Math.round(recentMed),
                        priorMedianIncome: Math.round(priorMed),
                        severity: dropPct >= 35 ? 'HIGH' : dropPct >= 25 ? 'MEDIUM' : 'LOW'
                    };
                }
            }
        }
        out.activityDecline = activityDecline;

        const distressFlags = [];
        const overdraftDays = behaviorProfile?.overdraftDays || 0;
        if (overdraftDays >= 3) {
            distressFlags.push({
                flag: 'micro_overdraft_touches',
                label: `נגיעות חוזרות במסגרת האשראי (${overdraftDays} ימים שליליים)`,
                weight: overdraftDays >= 8 ? 'HIGH' : 'MEDIUM'
            });
        }
        const last6 = (history || []).slice(-6);
        const recentNeg = last6.filter(m => m.netFlow < 0).length;
        if (recentNeg >= 2) {
            distressFlags.push({
                flag: 'recurring_negative_cashflow',
                label: `${recentNeg} חודשים עם תזרים שלילי מתוך 6 האחרונים`,
                weight: recentNeg >= 4 ? 'HIGH' : 'MEDIUM'
            });
        }
        if ((trends?.dti || 0) >= 8 && (trends?.income || 0) <= 0) {
            distressFlags.push({
                flag: 'priority_shifting',
                label: `עליית נטל ההוצאות הקבועות (+${Math.round(trends.dti)}% DTI) ללא גידול בהכנסה`,
                weight: 'MEDIUM'
            });
        }
        if (typeof behaviorProfile?.lowestBalanceSeen === 'number' && behaviorProfile.lowestBalanceSeen < -5000) {
            distressFlags.push({
                flag: 'deep_overdraft',
                label: `יתרת שפל שלילית עמוקה (₪${Math.round(behaviorProfile.lowestBalanceSeen).toLocaleString('en-US')})`,
                weight: 'HIGH'
            });
        }
        const highWeightCount = distressFlags.filter(f => f.weight === 'HIGH').length;
        out.earlyDistress = {
            detected: distressFlags.length > 0,
            flags: distressFlags,
            riskLevel: highWeightCount >= 1 || distressFlags.length >= 3 ? 'HIGH'
                : distressFlags.length >= 1 ? 'MEDIUM' : 'NONE',
            leadIndicator: distressFlags.length > 0
                ? 'זוהו סימני לחץ מוקדמים — לרוב מקדימים הופעה ב-BDI ב-60 עד 90 יום'
                : null
        };

        let declarationGap = { available: false };
        const declared = Number(declaredMonthlyExpenses || 0);
        if (declared > 0) {
            const actual = getMedian((history || []).filter(m => m.expenses > 0).map(m => m.expenses));
            const gap = Math.round(actual - declared);
            const gapPct = declared > 0 ? Math.round((gap / declared) * 100) : 0;
            declarationGap = {
                available: true,
                declaredMonthlyExpenses: Math.round(declared),
                actualMonthlyExpenses: Math.round(actual),
                gap,
                gapPct,
                materialMismatch: Math.abs(gapPct) >= 20,
                direction: gap > 0 ? 'UNDER_DECLARED' : 'OVER_DECLARED'
            };
        }
        out.declarationGap = declarationGap;

        const positiveSignals = [];
        if (out.sideIncome.hasSideIncome) positiveSignals.push('side_income');
        const riskSignals = [];
        if (out.activityDecline.detected) riskSignals.push('activity_decline');
        if (out.earlyDistress.detected) riskSignals.push('early_distress');
        if (out.declarationGap.materialMismatch && out.declarationGap.direction === 'UNDER_DECLARED') riskSignals.push('expense_under_declaration');

        out.summary = {
            hiddenStrengthSignals: positiveSignals,
            hiddenRiskSignals: riskSignals,
            hasForensicInsight: positiveSignals.length > 0 || riskSignals.length > 0
        };

        return out;
    } catch (err) {
        console.warn('[ForensicIntelligence] Failed to compute:', err?.message);
        return null;
    }
}

// --- POSITIVE SIGNALS ENGINE ---
// FlowUp's core differentiator: instead of "why decline", surface "why approve".
export function buildPositiveSignals({ history, behaviorProfile, trends }) {
    const out = {
        surplusCreation: { detected: false, monthlySurplus: 0, surplusRatio: 0 },
        financialDiscipline: { detected: false, expenseCV: 0 },
        upwardMobility: { detected: false, growthPct: 0 },
        incomeMomentum: { direction: 'STABLE', changePct: 0 },
        wealthBuilding: { detected: false, monthlyOutflow: 0 },
        resilience: { score: 0, recovered: false, label: 'NONE' },
        opportunityScore: 0
    };
    try {
        if (!history || history.length < 3) return out;

        const last3 = history.slice(-3);
        const avgIncome3 = last3.reduce((s, m) => s + m.income, 0) / 3;
        const avgSurplus3 = last3.reduce((s, m) => s + (m.income - m.expenses), 0) / 3;
        if (avgIncome3 > 0 && avgSurplus3 > avgIncome3 * 0.15) {
            out.surplusCreation = {
                detected: true,
                monthlySurplus: Math.round(avgSurplus3),
                surplusRatio: Math.round((avgSurplus3 / avgIncome3) * 100)
            };
        }

        const expenseValues = history.map(m => m.expenses).filter(v => v > 0);
        if (expenseValues.length >= 4) {
            const expCV = getCoefficientOfVariation(expenseValues);
            out.financialDiscipline = { detected: expCV < 0.15, expenseCV: parseFloat(expCV.toFixed(2)) };
        }

        const incomeHistory = history.map(m => m.income).filter(v => v > 0);
        if (incomeHistory.length >= 6) {
            const early = getMedian(incomeHistory.slice(0, 3));
            const recent = getMedian(incomeHistory.slice(-3));
            if (early > 0) {
                const growthPct = Math.round(((recent - early) / early) * 100);
                out.upwardMobility = { detected: growthPct >= 25, growthPct };
            }
        }

        const incChange = trends?.income || 0;
        out.incomeMomentum = {
            direction: incChange > 8 ? 'UP' : incChange < -8 ? 'DOWN' : 'STABLE',
            changePct: Math.round(incChange)
        };

        const wbOutflow = behaviorProfile?.investmentDiscipline?.avgMonthlyInvestmentOutflow || 0;
        out.wealthBuilding = { detected: wbOutflow > 0, monthlyOutflow: Math.round(wbOutflow) };

        const last6 = history.slice(-6);
        const negMonths = last6.filter(m => m.netFlow < 0).length;
        const lastMonthPositive = last6.length > 0 && last6[last6.length - 1].netFlow >= 0;
        const noOverdraft = (behaviorProfile?.overdraftDays || 0) === 0;
        if (negMonths >= 1 && lastMonthPositive && noOverdraft) {
            out.resilience = {
                score: negMonths === 1 ? 85 : 70,
                recovered: true,
                label: 'RECOVERED_FROM_DIP'
            };
        } else if (negMonths === 0 && noOverdraft) {
            out.resilience = { score: 60, recovered: false, label: 'STEADY' };
        }

        let opp = 0;
        if (out.surplusCreation.detected) opp += 25;
        if (out.financialDiscipline.detected) opp += 20;
        if (out.upwardMobility.detected) opp += 20;
        if (out.incomeMomentum.direction === 'UP') opp += 15;
        if (out.wealthBuilding.detected) opp += 10;
        if (out.resilience.recovered) opp += 10;
        out.opportunityScore = Math.min(100, opp);

        return out;
    } catch (err) {
        console.warn('[PositiveSignals] Failed:', err?.message);
        return out;
    }
}

// --- ADVANCED FACTUAL SIGNALS ENGINE ---
// Factual, evidence-based behavioral signals. Additive only — never touches the score.
export function buildAdvancedSignals({ history, behaviorProfile, transactions, parseAmount, getDesc }) {
    const out = {
        cashDependency: { score: 0, level: 'LOW', cashShare: 0 },
        seasonality: { detected: false, pattern: 'NONE', volatilityPct: 0 },
        recovery: { detected: false, narrative: null },
        lifestyleInflation: { detected: false, incomeGrowthPct: 0, expenseGrowthPct: 0 },
        reinvestment: { detected: false, reinvestRatio: 0 }
    };
    try {
        const cashTokens = ['מזומן', 'משיכת מזומן', 'הפקדת מזומן', 'כספומט', 'atm', 'cash', 'withdrawal'];
        let cashVolume = 0, totalVolume = 0;
        (transactions || []).forEach(tx => {
            const amt = Math.abs(parseAmount(tx));
            if (!amt || isNaN(amt)) return;
            totalVolume += amt;
            const d = getDesc(tx).toLowerCase();
            if (cashTokens.some(t => d.includes(t))) cashVolume += amt;
        });
        const cashShare = totalVolume > 0 ? Math.round((cashVolume / totalVolume) * 100) : 0;
        out.cashDependency = {
            score: cashShare,
            cashShare,
            level: cashShare >= 40 ? 'HIGH' : cashShare >= 20 ? 'MEDIUM' : 'LOW'
        };

        const incomeMonths = (history || []).map(m => m.income).filter(v => v > 0);
        if (incomeMonths.length >= 8) {
            const cv = getCoefficientOfVariation(incomeMonths);
            const recentMed = getMedian(incomeMonths.slice(-3));
            const priorMed = getMedian(incomeMonths.slice(0, -3));
            const cyclical = cv > 0.25 && recentMed < priorMed;
            out.seasonality = {
                detected: cyclical,
                pattern: cyclical ? 'CYCLICAL_DIP' : (cv > 0.25 ? 'VOLATILE' : 'NONE'),
                volatilityPct: Math.round(cv * 100)
            };
        }

        const last8 = (history || []).slice(-8);
        if (last8.length >= 4) {
            const dipIdx = last8.findIndex(m => m.netFlow < 0);
            if (dipIdx >= 0 && dipIdx < last8.length - 1) {
                const afterDip = last8.slice(dipIdx + 1);
                const recoveredFlow = afterDip.filter(m => m.netFlow > 0).length >= Math.ceil(afterDip.length / 2);
                if (recoveredFlow && (behaviorProfile?.overdraftDays || 0) <= 2) {
                    out.recovery = {
                        detected: true,
                        narrative: 'הלקוח חווה חודש קשה בעבר אך חזר לתזרים חיובי ובנה מחדש כרית ביטחון — סימן לחוסן פיננסי אמיתי.'
                    };
                }
            }
        }

        const incs = (history || []).map(m => m.income).filter(v => v > 0);
        const exps = (history || []).map(m => m.expenses).filter(v => v > 0);
        if (incs.length >= 6 && exps.length >= 6) {
            const incEarly = getMedian(incs.slice(0, 3)), incRecent = getMedian(incs.slice(-3));
            const expEarly = getMedian(exps.slice(0, 3)), expRecent = getMedian(exps.slice(-3));
            const incG = incEarly > 0 ? Math.round(((incRecent - incEarly) / incEarly) * 100) : 0;
            const expG = expEarly > 0 ? Math.round(((expRecent - expEarly) / expEarly) * 100) : 0;
            out.lifestyleInflation = {
                detected: incG > 0 && expG > incG + 10,
                incomeGrowthPct: incG,
                expenseGrowthPct: expG
            };
        }

        const wbOutflow = behaviorProfile?.investmentDiscipline?.avgMonthlyInvestmentOutflow || 0;
        const avgInc = incomeMonths.length ? getMedian(incomeMonths) : 0;
        if (avgInc > 0 && wbOutflow > 0) {
            const ratio = Math.round((wbOutflow / avgInc) * 100);
            out.reinvestment = { detected: ratio >= 8, reinvestRatio: ratio };
        }

        return out;
    } catch (err) {
        console.warn('[AdvancedSignals] Failed:', err?.message);
        return out;
    }
}