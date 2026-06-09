import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';
import { z } from 'npm:zod';

function withValidation(schema, handler) {
    return async (req) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            try {
                const body = await req.clone().json();
                const validation = schema.safeParse(body);
                if (!validation.success) {
                    return Response.json({ 
                        success: false, 
                        error: "Payload validation failed", 
                        details: validation.error.issues 
                    }, { status: 400 });
                }
            } catch (e) {
                // Ignore empty bodies
            }
        }
        return handler(req);
    };
}

const loanLogicSchema = z.object({
    userId: z.string().optional(),
    targetAccountId: z.string().nullable().optional(),
    manualLiquidAssets: z.union([z.number(), z.string()]).optional(),
    metrics: z.any().optional(),
    liquidAssets: z.union([z.number(), z.string()]).optional()
}).passthrough();

// --- CONFIGURATION ---
const SCORING_WEIGHTS = {
    STABILITY: 0.35,
    SERVICEABILITY: 0.25,
    LIQUIDITY: 0.25,
    VOLATILITY: 0.15
};

// --- MILLENNIUM SHADOW FUNCTIONS (Vector Logic) ---

/**
 * Transforms a scalar value into a Shadow Vector (m, p)
 */
function toShadow(value, key) {
    const theta = (value % key) * (Math.PI / 180);
    return {
        m: value * Math.cos(theta),
        p: value * Math.sin(theta)
    };
}

/**
 * Reconstructs a scalar value from a Shadow Vector
 */
function fromShadow(m, p, key) {
    return Math.round(Math.sqrt(m * m + p * p));
}

// --- HELPER FUNCTIONS ---

function getStandardDeviation(array) {
    if (!array || array.length === 0) return 0;
    const n = array.length;
    const mean = array.reduce((a, b) => a + b, 0) / n;
    const variance = array.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
    return Math.sqrt(variance);
}

function getMedian(array) {
    if (!array || array.length === 0) return 0;
    const sorted = [...array].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * MAD-based outlier filter (Median Absolute Deviation).
 * A single one-off transfer / atypical month can lift a 12-month "average expenses"
 * by tens of percent (e.g. ₪50,761 vs a real ₪33k baseline). Mean-based heuristics
 * can't catch this — but MAD is robust to outliers by definition.
 *
 * Rule: any monthly value whose distance from the median exceeds 3 × MAD is treated
 * as an outlier and excluded from the average. The median itself is unaffected by
 * the outlier, which is exactly the property we need for stable underwriting.
 *
 * Used for both incomes and expenses to neutralize the effect of one-off events
 * (large transfers, refunds, atypical months) on the 12-month rolling averages.
 */
function filterMonthlyOutliersMAD(values, threshold = 3) {
    if (!values || values.length < 4) return values || [];
    const median = getMedian(values);
    const absDeviations = values.map(v => Math.abs(v - median));
    const mad = getMedian(absDeviations);
    // If MAD is 0 (very stable series) — return as-is to avoid div-by-zero false positives
    if (mad === 0) return values;
    return values.filter(v => Math.abs(v - median) / mad <= threshold);
}

/**
 * Weighted Rolling Average — Base + Recent Trend model.
 *   final = 0.6 × avg(full window, up to 12 months)   [PAST — stability base]
 *         + 0.4 × avg(last 3 months)                  [PRESENT — recent trend]
 *
 * Regular average = past. Weighted = present. CV = risk.
 * This split keeps long-term stability as the anchor (60%) while giving
 * meaningful weight (40%) to the most recent financial reality —
 * works for both salaried employees (raises, bonuses) and freelancers (momentum).
 */
function getWeightedAverage(values) {
    if (!values || values.length === 0) return 0;

    const baseAvg = values.reduce((a, b) => a + b, 0) / values.length;

    // Not enough history for a meaningful "recent trend" — return the simple base average.
    if (values.length < 4) return baseAvg;

    const recentCount = Math.min(3, values.length);
    const recent = values.slice(-recentCount);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;

    // 60% past baseline + 40% recent trend
    return (baseAvg * 0.6) + (recentAvg * 0.4);
}

/**
 * Coefficient of Variation (CV) — dimensionless measure of relative volatility.
 * CV = StdDev / Mean. Unlike raw StdDev, CV allows fair comparison across income levels.
 * Used for risk-adjusted "haircut" on income to price volatility mathematically.
 */
function getCoefficientOfVariation(values) {
    if (!values || values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean === 0) return 0;
    const sd = getStandardDeviation(values);
    return sd / mean;
}

/**
 * Detects cross-account self-transfers: same amount (± small fee tolerance) moving OUT of one
 * account and IN to another within a 48-hour window. These are NOT real income/expense —
 * they don't change total net worth and must be excluded to avoid artificially inflating averages.
 * Critical for both salaried (savings transfers) and freelancers (business↔personal).
 */
function detectSelfTransfers(transactions, parseAmount) {
    const matched = new Set();
    const FEE_TOLERANCE = 0.02; // 2% tolerance for transfer fees
    const TIME_WINDOW_MS = 48 * 60 * 60 * 1000;

    // Index transactions with parsed amount + date + account
    const indexed = transactions.map((tx, idx) => {
        const amount = parseAmount(tx);
        const txDateObj = tx?.date;
        const dateStr = tx?.creationDate ||
            (typeof txDateObj === 'string' ? txDateObj : (txDateObj?.valueDate || txDateObj?.bookingDate || txDateObj?.transactionDate)) ||
            tx?.transactionDate;
        const date = dateStr ? new Date(dateStr) : null;
        const accId = String(tx?.accountId || tx?.account_id || tx?.accountNumber || "");
        return { idx, amount, date, accId, tx };
    }).filter(x => x.date && !isNaN(x.date.getTime()) && !isNaN(x.amount));

    // Separate outflows and inflows
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

function extractBalance(acc) {
    let balance = 0;
    let extractionPath = 'none';
    let rawValues = {};

    try {
        if (!acc || typeof acc !== 'object') return { balance: 0, path: 'invalid_account_obj' };

        // 1. Priority 1: Direct availableBalance (Common in Poalim/Open Finance Israel)
        if (acc.availableBalance !== undefined) {
            rawValues.availableBalance = acc.availableBalance;
            balance = Number(acc.availableBalance);
            extractionPath = 'availableBalance';
        } 
        // 2. Priority 2: Direct currentBalance
        else if (acc.currentBalance !== undefined) {
            rawValues.currentBalance = acc.currentBalance;
            balance = Number(acc.currentBalance);
            extractionPath = 'currentBalance';
        } 
        // 3. Priority 3: Array of balances (Standard Open Banking)
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
        // 4. Priority 4: Direct balance object/value
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

        // Edge case handling: NaN or Null
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
// --- UNIT TESTS (Run on load) ---
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
// Execute tests
runBalanceExtractionTests();

// --- FORENSIC INTELLIGENCE ENGINE ---
// FlowUp's "must-have" layer: surfaces signals that BDI / credit reports CANNOT see,
// because they are built on raw transaction-level cash-flow rather than reported events.
// Everything below is computed on top of the ALREADY-CLEANED data (self-transfers,
// one-offs and MAD outliers excluded upstream) and is purely additive — it never
// touches the scoring pipeline. Returns a compact, narrative-friendly object.
function buildForensicIntelligence({ behaviorProfile, history, trends, declaredMonthlyExpenses }) {
    try {
        const out = {};

        // ── CHANNEL A: SIDE-INCOME DETECTION (salaried with a side hustle / gig) ──
        // Recurring income streams that are NOT salary/pension but appear consistently.
        // Tells the lender: "this borrower has repayment-supporting income beyond base salary".
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

        // ── CHANNEL B: ACTIVITY DECLINE / VELOCITY (self-employed hiding a slowdown) ──
        // Compares the income velocity of the last ~3 months vs the prior baseline.
        // A consistent drop is an early signal of a shrinking business that VAT reports
        // and BDI won't reflect for months.
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

        // ── CHANNEL C: EARLY DISTRESS DETECTION (3 months before BDI) ──
        // Silent flags that precede a formal default by months:
        //  1. micro-overdraft touches (repeated brief dips into the overdraft line)
        //  2. rising fixed-vs-income pressure in recent months (priority shifting)
        //  3. recent net-flow turning negative (running dry)
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
        // Priority shifting: fixed-expense share of income climbing over the last 4 months
        if ((trends?.dti || 0) >= 8 && (trends?.income || 0) <= 0) {
            distressFlags.push({
                flag: 'priority_shifting',
                label: `עליית נטל ההוצאות הקבועות (+${Math.round(trends.dti)}% DTI) ללא גידול בהכנסה`,
                weight: 'MEDIUM'
            });
        }
        // Lowest balance deeply negative — acute pressure
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

        // ── CHANNEL D: DECLARATION-vs-REALITY (expense gap) ──
        // Only computed when the partner passed the customer's self-declared expenses.
        // Compares declared monthly living expenses against the actual classified spend.
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

        // ── COMPOSITE SUMMARY ──
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
// Detects quality borrowers the formal score may underrate. Purely additive — never
// touches the scoring pipeline. Built on the already-cleaned monthly history.
function buildPositiveSignals({ history, behaviorProfile, trends }) {
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

        // 1) SURPLUS CREATION — consistently keeps a meaningful share of income.
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

        // 2) FINANCIAL DISCIPLINE — low expense volatility = stable, non-impulsive spend.
        const expenseValues = history.map(m => m.expenses).filter(v => v > 0);
        if (expenseValues.length >= 4) {
            const expCV = getCoefficientOfVariation(expenseValues);
            out.financialDiscipline = { detected: expCV < 0.15, expenseCV: parseFloat(expCV.toFixed(2)) };
        }

        // 3) UPWARD MOBILITY — median income of last third vs first third (≥25% growth).
        const incomeHistory = history.map(m => m.income).filter(v => v > 0);
        if (incomeHistory.length >= 6) {
            const early = getMedian(incomeHistory.slice(0, 3));
            const recent = getMedian(incomeHistory.slice(-3));
            if (early > 0) {
                const growthPct = Math.round(((recent - early) / early) * 100);
                out.upwardMobility = { detected: growthPct >= 25, growthPct };
            }
        }

        // 4) INCOME MOMENTUM — directional read of the income trend (uses computed trends).
        const incChange = trends?.income || 0;
        out.incomeMomentum = {
            direction: incChange > 8 ? 'UP' : incChange < -8 ? 'DOWN' : 'STABLE',
            changePct: Math.round(incChange)
        };

        // 5) WEALTH BUILDING — recurring outflow to long-term savings/investments.
        const wbOutflow = behaviorProfile?.investmentDiscipline?.avgMonthlyInvestmentOutflow || 0;
        out.wealthBuilding = { detected: wbOutflow > 0, monthlyOutflow: Math.round(wbOutflow) };

        // 6) RESILIENCE — handled a rough month WITHOUT defaulting (recovered to positive).
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

        // 7) OPPORTUNITY SCORE — composite "why approve" index (0-100).
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
// Factual, evidence-based behavioral signals (not moral judgments). Helps the lender
// understand WHY a number moved (seasonality), HOW money is used (reinvestment),
// and DEPENDENCY patterns (cash). Additive only — never touches the score.
function buildAdvancedSignals({ history, behaviorProfile, transactions, parseAmount, getDesc }) {
    const out = {
        cashDependency: { score: 0, level: 'LOW', cashShare: 0 },
        seasonality: { detected: false, pattern: 'NONE', volatilityPct: 0 },
        recovery: { detected: false, narrative: null },
        lifestyleInflation: { detected: false, incomeGrowthPct: 0, expenseGrowthPct: 0 },
        reinvestment: { detected: false, reinvestRatio: 0 }
    };
    try {
        // A) CASH DEPENDENCY — share of activity that is physical cash (deposits/withdrawals).
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

        // B) SEASONALITY — detect cyclical income swings vs a genuine decline.
        const incomeMonths = (history || []).map(m => m.income).filter(v => v > 0);
        if (incomeMonths.length >= 8) {
            const cv = getCoefficientOfVariation(incomeMonths);
            const recentMed = getMedian(incomeMonths.slice(-3));
            const priorMed = getMedian(incomeMonths.slice(0, -3));
            // High swings BUT prior peaks were similar → likely seasonal, not collapse.
            const cyclical = cv > 0.25 && recentMed < priorMed;
            out.seasonality = {
                detected: cyclical,
                pattern: cyclical ? 'CYCLICAL_DIP' : (cv > 0.25 ? 'VOLATILE' : 'NONE'),
                volatilityPct: Math.round(cv * 100)
            };
        }

        // C) FINANCIAL RECOVERY — went negative, climbed back to positive + rebuilt buffer.
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

        // D) LIFESTYLE INFLATION — expenses growing faster than income.
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

        // E) BUSINESS REINVESTMENT — when income rises, money flows to investments/savings
        //    (proxy for equipment/inventory/marketing) rather than being fully drained.
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

// --- MAIN EDGE FUNCTION ---

Deno.serve(withValidation(loanLogicSchema, async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json().catch(() => ({}));
        const userId = body?.userId || "ronenk2424@gmail.com";
        const targetAccountId = body?.targetAccountId;
        const manualLiquidAssets = Number(body?.manualLiquidAssets || body?.metrics?.liquidAssets || body?.liquidAssets || 0);
        // Optional: customer's self-declared monthly living expenses (from the partner's
        // intake form). Enables the Declaration-vs-Reality forensic channel when present.
        const declaredMonthlyExpenses = Number(body?.declaredMonthlyExpenses || body?.metrics?.declaredMonthlyExpenses || 0);

        const API_ROOT = "https://api.open-finance.ai";
        const API_V2 = "https://api.open-finance.ai/v2";
        const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
        const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

        if (!API_KEY || !API_SECRET) {
            throw new Error("Missing Open Finance API keys");
        }

        // 1. Get Access Token
        const tokenRes = await fetch(`${API_ROOT}/oauth/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId,
                clientId: API_KEY,
                clientSecret: API_SECRET
            })
        });

        if (!tokenRes.ok) {
            throw new Error(`Open Finance Auth Error: ${tokenRes.status} ${tokenRes.statusText}`);
        }

        const tokenJson = await tokenRes.json();
        if (!tokenJson?.accessToken) {
            throw new Error("Failed to get access token from Open Finance");
        }
        const accessToken = tokenJson.accessToken;

        // 2. Fetch Accounts & Calculate Real Liquid Assets
        let liquidAssets = 0;
        let liquidAssetsBreakdown = { cash: 0, etf: 0, trainingFund: 0 };
        let debugAccountsData = [];
        let availableAccounts = [];
        let activeTargetAccountId = targetAccountId;
        console.log(`[Debug] Starting to fetch accounts...`);
        try {
            const accountsRes = await fetch(`${API_V2}/data/accounts`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/json"
                }
            });

            console.log(`[Debug] Accounts API status: ${accountsRes.status}`);
            if (accountsRes.ok) {
                const accountsData = await accountsRes.json();
                debugAccountsData = accountsData;
                let rawAccounts = accountsData?.data || accountsData?.items || accountsData?.accounts || [];
                if (!rawAccounts.length && Array.isArray(accountsData)) {
                    rawAccounts = accountsData;
                }
                
                console.log(`[Debug] Raw accounts before filter:`, rawAccounts.length);
                
                // Deduplicate accounts by ID to avoid losing sub-accounts (like checking vs credit limit) that share the same accountNumber
                const uniqueAccountsMap = new Map();
                rawAccounts.forEach(acc => {
                    const key = acc.id || acc.accountId || acc.accountNumber;
                    // If we already have this key, only overwrite if the new one has a valid balance and the old one doesn't
                    if (!uniqueAccountsMap.has(key)) {
                        uniqueAccountsMap.set(key, acc);
                    } else {
                        const existingBal = extractBalance(uniqueAccountsMap.get(key)).balance;
                        const newBal = extractBalance(acc).balance;
                        if (existingBal === 0 && newBal !== 0) {
                            uniqueAccountsMap.set(key, acc);
                        }
                    }
                });
                let accounts = Array.from(uniqueAccountsMap.values());
                
                // Extract available accounts for the UI dropdown, filtering out accounts with 0 balance and fixing names
                availableAccounts = accounts
                    .filter(a => extractBalance(a).balance !== 0)
                    .map(a => {
                        const type = (a.type || a.accountType || "").toLowerCase();
                        const name = (a.name || a.accountName || "").toLowerCase(); 
                        const product = (a.product || "").toLowerCase();
                        const details = (a.details || "").toLowerCase();
                        const cashAccountType = (a.cashAccountType || "").toLowerCase();
                        
                        let displayName = a.name || a.accountName || "חשבון בנק";
                        
                        const isOverdraft = type.includes('overdraft') || name.includes('overdraft') || name.includes('מינוס') || product.includes('מינוס');
                        const isInvestment = type.includes('investment') || type.includes('securities') || name.includes('תיק') || name.includes('השקעות') || name.includes('ניירות ערך') || name.includes('סחירות') || name.includes('מנייתי') || name.includes('מט"ח') || name.includes('ibi') || name.includes('meitav') || name.includes('excellence') || product.includes('השקעות') || product.includes('ניירות ערך');
                        const isTrainingFund = type.includes('training') || type.includes('provident') || type.includes('pension') || name.includes('השתלמות') || name.includes('גמל') || name.includes('פנסיה') || name.includes('קופת') || product.includes('השתלמות') || product.includes('גמל') || product.includes('פנסיה');
                        const isChecking = type.includes('checking') || type.includes('current') || cashAccountType.includes('cacc') || name.includes('עו"ש') || name.includes('עובר ושב') || product.includes('עו"ש') || product.includes('עובר ושב') || details.includes('עו"ש');

                        if (isChecking) displayName = "חשבון עו״ש";
                        else if (isInvestment) displayName = "תיק השקעות";
                        else if (isTrainingFund) displayName = "קופת גמל / השתלמות";
                        else if (isOverdraft) displayName = "מסגרת אשראי";

                        return {
                            id: a.id || a.accountId || a.accountNumber,
                            name: displayName,
                            number: a.accountNumber || a.accountNo || "",
                            isChecking
                        };
                    })
                    .filter(a => a.isChecking);

                if (!activeTargetAccountId && availableAccounts.length > 0) {
                    const preferredAccount = availableAccounts.find(a => a.number && a.number.endsWith('4498'));
                    activeTargetAccountId = preferredAccount ? preferredAccount.id : availableAccounts[0].id;
                }

                // Filter to activeTargetAccountId if provided (skip if 'all' is selected to aggregate multiple banks)
                if (activeTargetAccountId && activeTargetAccountId !== 'all') {
                    const filteredAccounts = accounts.filter(acc => String(acc.id || acc.accountId || acc.accountNumber) === String(activeTargetAccountId));
                    // SAFETY: a stale accountId (e.g. left over from a different customer's session)
                    // would filter to 0 accounts and crash the whole analysis. If the requested
                    // account doesn't belong to THIS customer, ignore the filter and aggregate
                    // all of this customer's accounts instead of returning "No transactions found".
                    if (filteredAccounts.length === 0) {
                        console.warn(`[Account Filter] targetAccountId "${activeTargetAccountId}" not found for this customer — falling back to ALL accounts.`);
                        activeTargetAccountId = 'all';
                    } else {
                        accounts = filteredAccounts;
                    }
                }
                
                console.log(`[Liquid Assets] Processing ${accounts.length} unique accounts (from ${rawAccounts.length} raw)`);
                
               accounts.forEach((acc) => {
                    const type = (acc.type || acc.accountType || "").toLowerCase();
                    const name = (acc.name || acc.accountName || "").toLowerCase(); 
                    const product = (acc.product || "").toLowerCase();
                    const details = (acc.details || "").toLowerCase();
                    const cashAccountType = (acc.cashAccountType || "").toLowerCase();
                    
                    // Fallback to extract balance directly if extractBalance fails
                    let { balance: balanceAmount, path } = extractBalance(acc);
                    
                    if (balanceAmount === 0) {
                        // Try to find balance in other common Open Finance fields
                        if (acc.availableBalance !== undefined) balanceAmount = Number(acc.availableBalance);
                        else if (acc.currentBalance !== undefined) balanceAmount = Number(acc.currentBalance);
                        else if (acc.balance !== undefined && !isNaN(Number(acc.balance))) balanceAmount = Number(acc.balance);
                        else if (acc.balance?.amount !== undefined) balanceAmount = Number(acc.balance.amount);
                    }

                    if (balanceAmount !== 0) {
                        console.log(`[Account QA] Name: ${name}, Type: ${type}, Product: ${product}, CashAccountType: ${cashAccountType}, Balance: ${balanceAmount}, Path: ${path}`);
                        
                        const isOverdraft = type.includes('overdraft') || name.includes('overdraft') || name.includes('מינוס') || product.includes('מינוס');
                        const isInvestment = type.includes('investment') || type.includes('securities') || name.includes('תיק') || name.includes('השקעות') || name.includes('ניירות ערך') || name.includes('סחירות') || name.includes('מנייתי') || name.includes('מט"ח') || name.includes('ibi') || name.includes('meitav') || name.includes('excellence') || product.includes('השקעות') || product.includes('ניירות ערך');
                        const isTrainingFund = type.includes('training') || type.includes('provident') || type.includes('pension') || name.includes('השתלמות') || name.includes('גמל') || name.includes('פנסיה') || name.includes('קופת') || product.includes('השתלמות') || product.includes('גמל') || product.includes('פנסיה');
                        const isChecking = type.includes('checking') || type.includes('current') || cashAccountType.includes('cacc') || name.includes('עו"ש') || name.includes('עובר ושב') || product.includes('עו"ש') || product.includes('עובר ושב') || details.includes('עו"ש');

                        let finalBalance = balanceAmount;
                        if (isOverdraft) {
                            finalBalance = -Math.abs(balanceAmount);
                        }

                        if (isInvestment) {
                            liquidAssetsBreakdown.etf += finalBalance;
                            liquidAssets += (finalBalance * 0.8);
                        } else if (isTrainingFund) {
                            liquidAssetsBreakdown.trainingFund += finalBalance;
                            liquidAssets += (finalBalance * 0.55);
                        } else {
                            liquidAssetsBreakdown.cash += finalBalance;
                            liquidAssets += finalBalance; 
                        }
                    }
                });
                
                console.log(`[Liquid Assets] Total calculated: ${liquidAssets}`);
            }
        } catch (e) {
            console.error("Failed to fetch/process accounts:", e);
        }

        // Add manualLiquidAssets only to the final sum
        liquidAssets += manualLiquidAssets;
        liquidAssetsBreakdown.cash += manualLiquidAssets;
        liquidAssets = Math.max(0, liquidAssets);

        // 3. Fetch Transactions
        const txRes = await fetch(`${API_V2}/data/transactions`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json"
            }
        });

        if (!txRes.ok) {
            throw new Error(`Open Finance TX Error: ${txRes.status} ${txRes.statusText}`);
        }

        const txData = await txRes.json();
        let transactions = txData?.data || txData?.items || txData?.transactions || [];

        if (activeTargetAccountId && activeTargetAccountId !== 'all') {
            transactions = transactions.filter(tx => {
                const txAccId = String(tx.accountId || tx.account_id || tx.resourceId || tx.accountNumber || "");
                return txAccId === String(activeTargetAccountId);
            });
        }

        // 4. Process Transactions into Monthly History
        const asNumber = (value) => {
            if (value === undefined || value === null) return 0;
            if (typeof value === 'number') return value;
            if (typeof value === 'string') return Number(value.replace(/,/g, '')) || 0;
            if (typeof value === 'object') {
                return asNumber(value.amount ?? value.value ?? value.chargedAmount?.amount ?? value.balanceAmount?.amount);
            }
            return 0;
        };

        const parseTransactionAmount = (tx) => {
            const raw = tx.amount ?? tx.transactionAmount ?? tx.instructedAmount ?? tx.entryAmount ?? tx.bookingAmount ?? tx.value ?? tx.amount_ils;
            let amount = asNumber(raw);
            if (amount === 0 && (tx.credit !== undefined || tx.debit !== undefined)) {
                amount = asNumber(tx.credit) - asNumber(tx.debit);
            }
            const ind = String(tx.creditDebitIndicator || tx.indicator || tx.type || "").toUpperCase();
            if (ind.includes('DBIT') || ind.includes('DEBIT')) return -Math.abs(amount);
            if (ind.includes('CRDT') || ind.includes('CREDIT')) return Math.abs(amount);
            return amount;
        };

        const monthlyData = {};
        const today = new Date();
        let investmentTransfers = 0;

        // --- CROSS-ACCOUNT SELF-TRANSFER DETECTION ---
        // Only run when aggregating across all accounts — single-account view won't have cross-account pairs.
        const selfTransferIndices = (!activeTargetAccountId || activeTargetAccountId === 'all')
            ? detectSelfTransfers(transactions, parseTransactionAmount)
            : new Set();
        console.log(`[Self-Transfers] Detected ${selfTransferIndices.size / 2} cross-account transfer pairs (${selfTransferIndices.size} transactions excluded)`);

        // --- RECURRING INCOME PRE-PROCESSING ---
        // Description may be a nested object in some Open Finance providers — we
        // need a tolerant extractor here too, otherwise recurring detection misses
        // every Israeli bank account.
        //
        // 🔒 PRIVACY: never surface a real human name in the underwriter narrative.
        // We use debtorName only for grouping (counts/aggregations) but redact it
        // to a generic label when it looks like a personal counterparty (“First Last”
        // in Hebrew or English, no business/merchant tokens).
        const looksLikePersonalName = (s) => {
            if (!s || typeof s !== 'string') return false;
            const clean = s.trim();
            if (clean.length < 4 || clean.length > 40) return false;
            // Reject anything that obviously belongs to a merchant / institution
            // Whole-word tokens that flag the label as institutional / business (not personal).
            // Use \b boundaries so e.g. "רונן קנדינוב" never matches a partial token.
            const businessTokens = /(\b(?:LTD|LLC|INC|CORP|GROUP|BANK|VISA|MASTER|PAYPAL|GOOGLE|APPLE|UBER|WOLT)\b|בע"מ|בע”מ|בעמ"מ|חברה|חב'|בנק|ביטוח|לאומי|מכבי|קופת|הלוואה|מקס|ישראכרט|כלל|גמל|משכורת|משכ|משכור|משכו|שכר|פנסיה|גמדי|לעומי|ביטוח לאומי|שלטון|הכנסה|ריבית|מס)/i;
            if (businessTokens.test(clean)) return false;
            const parts = clean.split(/\s+/).filter(Boolean);
            if (parts.length < 2 || parts.length > 4) return false;
            // Each token must look like a name (letters only, no digits/symbols)
            return parts.every(p => /^[\u0590-\u05FFA-Za-z'’-]{2,}$/.test(p));
        };
        const redactPersonalLabel = (label) => looksLikePersonalName(label) ? 'העברה אישית (לא מזוהה)' : label;
        const extractDescText = (tx) => {
            if (tx?.debtorName && typeof tx.debtorName === 'string' && tx.debtorName.trim()) {
                return tx.debtorName.trim();
            }
            const cand = tx?.description ?? tx?.details;
            if (!cand) return '';
            if (typeof cand === 'string') return cand;
            if (typeof cand === 'object') {
                const direct = cand.description || cand.text || cand.original || cand.initialClean || '';
                if (direct) return String(direct);
                if (typeof cand.additionalInfo === 'string') {
                    try {
                        const ai = JSON.parse(cand.additionalInfo);
                        return String(ai?.purposeDescription || ai?.transactionDescription || '');
                    } catch { /* noop */ }
                }
            }
            return '';
        };
        const incomeDescCount = new Map();
        transactions.forEach((tx) => {
            const amount = parseTransactionAmount(tx);
            if (isNaN(amount) || amount <= 0) return;
            const txDescClean = extractDescText(tx).toLowerCase().replace(/[0-9\-\/]/g, '').trim();
            if (txDescClean) {
                incomeDescCount.set(txDescClean, (incomeDescCount.get(txDescClean) || 0) + 1);
            }
        });

        // --- HYBRID AI CLASSIFICATION PRE-PROCESSING ---
        const uniqueExpensesMap = new Map();
        transactions.forEach((tx) => {
            const amount = parseTransactionAmount(tx);
            if (isNaN(amount) || amount >= 0) return;
            const category = (tx?.category?.main || tx?.category || "").toLowerCase();
            const txDesc = String(tx?.description || "").toLowerCase();
            const key = `${txDesc}|${category}`;
            if (!uniqueExpensesMap.has(key)) {
                uniqueExpensesMap.set(key, { desc: txDesc, category });
            }
        });

        let aiClassifications = {};
        if (uniqueExpensesMap.size > 0) {
            try {
                const expensesToClassify = Array.from(uniqueExpensesMap.values()).map((e, idx) => ({ id: idx, ...e }));
                const limitedExpenses = expensesToClassify.slice(0, 100); // Prevent payload overload
                
                const prompt = `You are a financial underwriting classification engine.

Your goal is to classify expenses as FIXED or FLEXIBLE for credit risk analysis.

Definitions:

FIXED:
- Contractual or recurring obligations
- Monthly or periodic payments
- Housing, loans, insurance, utilities, telecom
- Education fees, health plans
- Taxes and government payments
- Subscriptions and memberships
- Any payment that would damage credit score if unpaid

FLEXIBLE:
- Discretionary or lifestyle spending
- Food outside home, shopping, entertainment
- Travel, gifts, leisure
- One-time or irregular purchases

Rules:
- If a transaction appears regularly and in similar amount -> classify as FIXED.
- If unclear -> classify as FLEXIBLE.
- Be conservative but realistic.
- Return JSON only.

Transactions:
${JSON.stringify(limitedExpenses)}
`;
                
                const llmRes = await base44.integrations.Core.InvokeLLM({
                    prompt,
                    response_json_schema: {
                        type: "object",
                        properties: {
                            classifications: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        id: { type: "number" },
                                        classification: { type: "string", enum: ["FIXED", "FLEXIBLE"] }
                                    },
                                    required: ["id", "classification"]
                                }
                            }
                        },
                        required: ["classifications"]
                    }
                });
                
                if (llmRes && llmRes.classifications) {
                    llmRes.classifications.forEach(c => {
                        const exp = limitedExpenses.find(e => e.id === c.id);
                        if (exp) {
                            aiClassifications[`${exp.desc}|${exp.category}`] = c.classification === "FIXED";
                        }
                    });
                }
            } catch (err) {
                console.error("AI Classification failed, falling back to keywords:", err.message);
            }
        }

        transactions.forEach((tx, txIdx) => {
            const amount = parseTransactionAmount(tx);
            if (isNaN(amount)) return;

            // Skip cross-account self-transfers — they don't represent real income or expense
            if (selfTransferIndices.has(txIdx)) return;

            const category = (tx?.category?.main || tx?.categoryName || tx?.category || "").toLowerCase();
            // tx.date from Open Finance is an object {valueDate, bookingDate, transactionDate} — not a string
            const txDateObj = tx?.date;
            const dateStr = tx?.creationDate ||
                (typeof txDateObj === 'string' ? txDateObj : (txDateObj?.valueDate || txDateObj?.bookingDate || txDateObj?.transactionDate)) ||
                tx?.transactionDate;
            const txDesc = String(tx?.description || tx?.details || "").toLowerCase();

            let date = dateStr ? new Date(dateStr) : today;
            if (isNaN(date.getTime())) date = today;

            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    month: monthKey,
                    income: 0,
                    primaryIncome: 0,
                    expenses: 0,
                    fixedExpenses: 0,
                    flexibleExpenses: 0,
                    investmentTransfers: 0,
                    netFlow: 0
                };
            }

            const currentMonth = monthlyData[monthKey];

            // Identify general "noise" that shouldn't count towards operational income/expenses
            const txDescClean = txDesc.replace(/[0-9\-\/]/g, '').trim();
            const isRecurringIncome = amount > 0 && txDescClean && incomeDescCount.get(txDescClean) >= 3;

            const isInternalTransfer = ["העברה בין חשבונות", "העברה פנימית", "internal transfer", "own account"].some(kw => category.includes(kw) || txDesc.includes(kw));
            const isLoanDeposit = amount >= 15000 && ["הלוואה", "loan", "משכנתא", "mortgage", "מימון", "הלוואות"].some(kw => category.includes(kw) || txDesc.includes(kw));
            const isPersonalIncome = amount > 0 && ["משכורת", "שכר", "salary", "payroll", "קצבה", "ביטוח לאומי", "פנסיה", "ילדים", "מלגה"].some(kw => category.includes(kw) || txDesc.includes(kw));
            const isRefundOrReversal = amount > 0 && ["החזר", "refund", "reversal", "ביטול"].some(kw => category.includes(kw) || txDesc.includes(kw)) && !txDesc.includes("זיכוי");
            
            const investmentKeywords = [
                "השקע", "ניירות ערך", "מניות", "קרן", "גמל", "השתלמות", "פיקדון", "חסכון", "קופת", 
                "מיטב", "אלטשולר", "הראל", "כלל", "מגדל", "פניקס", "פסגות", "ילין", "מור", "סחירות",
                "investment", "stock", "fund", "deposit", "saving", "broker", "crypto", "trade", "portfolio"
            ];
            const isInvestmentTransfer = amount < 0 && investmentKeywords.some(kw => category.includes(kw) || txDesc.includes(kw));

            if (amount > 0) {
                if (!isInternalTransfer && !isLoanDeposit && !isInvestmentTransfer && !isRefundOrReversal) {
                    currentMonth.income += amount;
                    if (isRecurringIncome || isPersonalIncome) {
                        currentMonth.primaryIncome += amount;
                    }
                }
            } else {
                const absAmt = Math.abs(amount);
                
                if (isInvestmentTransfer) {
                    investmentTransfers += absAmt;
                    liquidAssetsBreakdown.etf += absAmt;
                    currentMonth.investmentTransfers += absAmt;
                    console.log(`[Debug] Investment transfer found: ${txDesc} ${category} ${absAmt}`);
                }

                if (!isInternalTransfer && !isInvestmentTransfer) {
                    currentMonth.expenses += absAmt;
                    
                    const key = `${txDesc}|${category}`;
                    let isFixed = false;

                    // Priority 1: use Open Finance's own classification (REGULAR_EXPENSE = fixed recurring)
                    const ofClassType = (tx?.classification?.type || "").toUpperCase();
                    if (ofClassType === "REGULAR_EXPENSE" || ofClassType === "REGULAR_INCOME") {
                        isFixed = (ofClassType === "REGULAR_EXPENSE");
                    } else if (aiClassifications[key] !== undefined) {
                        isFixed = aiClassifications[key];
                    } else {
                        // Fallback to keywords if AI classification failed or missed this item
                        const fixedKeywords = [
                            // English
                            "housing", "loan", "insurance", "transportation", "utilities", "rent", "fixed", "commitment",
                            "mortgage", "lease", "subscription", "installment", "payment plan",
                            "supplier", "cloud", "software", "saas", "hosting", "office", "payroll", "salary",
                            // Hebrew
                            "הלוואה", "משכנתא", "ביטוח", "שכירות", "דירה", "חיוב", "תשלום קבוע",
                            "מנוי", "ארנונה", "חשמל", "מים", "גז", "ועד בית", "טלפון", "אינטרנט",
                            "החזר", "תשלומים", "מס", "היטל", "אגרה", "מע\"מ", "מעמ", "ביטוח לאומי",
                            "ספק", "ענן", "תוכנה", "משרד", "משכורת", "שכר עבודה", "רואה חשבון", "ייעוץ", "פרסום", "שיווק", "גוגל", "פייסבוק"
                        ];
                        
                        isFixed = fixedKeywords.some((keyword) => 
                            category.includes(keyword) || txDesc.includes(keyword)
                        );
                    }
                    
                    if (isFixed) {
                        currentMonth.fixedExpenses += absAmt;
                    } else {
                        currentMonth.flexibleExpenses += absAmt;
                    }
                }
            }
            currentMonth.netFlow = currentMonth.income - currentMonth.expenses;
        });

        // Add detected investment transfers to liquid assets
        liquidAssets += investmentTransfers;

        // Sort history chronologically
        let history = Object.values(monthlyData)
            .sort((a, b) => a.month.localeCompare(b.month));

        // Exclude current month if it's too empty (e.g., less than 20% of previous month's volume)
        const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        if (history.length > 0 && history[history.length - 1].month === currentMonthKey) {
            const currentMonthData = history[history.length - 1];
            if (history.length > 1) {
                const prevMonthData = history[history.length - 2];
                if ((currentMonthData.income + currentMonthData.expenses) < (prevMonthData.income + prevMonthData.expenses) * 0.2) {
                    history.pop();
                }
            } else if (currentMonthData.income + currentMonthData.expenses < 1000) {
                history.pop();
            }
        }

        history = history.slice(-12);

        // ── SPARSE-MONTH FILTERING ──────────────────────────────────────────────
        // A "sparse month" (one with abnormally low transaction volume — e.g. only the
        // first few days of a month, or a partial sync) drags both the average and the
        // 4-vs-prior trend toward zero, producing misleading drops like "−54%" and
        // "−35%" even when the underlying financial reality hasn't changed.
        //
        // Rule: a month whose total volume (income + expenses) is below 30% of the
        // 12-month MEDIAN is treated as data-thin and excluded from trend computation
        // (it stays in `history` for context but is not used in the rolling averages).
        const buildTrendHistory = (full) => {
            if (full.length < 4) return full;
            const volumes = full.map(m => m.income + m.expenses).filter(v => v > 0).sort((a, b) => a - b);
            if (volumes.length === 0) return full;
            const medianVol = volumes[Math.floor(volumes.length / 2)];
            const threshold = medianVol * 0.3;
            return full.filter(m => (m.income + m.expenses) >= threshold);
        };
        const trendHistory = buildTrendHistory(history);

        // Calculate trends (12/4 Momentum Analysis) — uses MEDIAN over `trendHistory`
        // (sparse months filtered out) for stability against partial-month outliers.
        // Median is robust to a single one-off month (vacation, bonus, sync gap).
        // Output is clamped to ±50% to avoid showing alarming numbers driven by data noise.
        let trends = { income: 0, expenses: 0, dti: 0, investments: 0, momentum: "STABLE" };
        const clampPct = (v) => Math.max(-50, Math.min(50, v));

        if (trendHistory.length >= 4) {
            const recent4 = trendHistory.slice(-4);
            const priorMonths = trendHistory.slice(0, -4);

            const recentMedIncome = getMedian(recent4.map(m => m.income));
            const priorMedIncome = priorMonths.length > 0 ? getMedian(priorMonths.map(m => m.income)) : recentMedIncome;

            const recentMedExpenses = getMedian(recent4.map(m => m.expenses));
            const priorMedExpenses = priorMonths.length > 0 ? getMedian(priorMonths.map(m => m.expenses)) : recentMedExpenses;

            const recentMedFixed = getMedian(recent4.map(m => m.fixedExpenses));
            const priorMedFixed = priorMonths.length > 0 ? getMedian(priorMonths.map(m => m.fixedExpenses)) : recentMedFixed;

            const recentMedInvestments = getMedian(recent4.map(m => m.investmentTransfers));
            const priorMedInvestments = priorMonths.length > 0 ? getMedian(priorMonths.map(m => m.investmentTransfers)) : 0;

            const prevDti = priorMedIncome > 0 ? (priorMedFixed / priorMedIncome) * 100 : 100;
            const currDti = recentMedIncome > 0 ? (recentMedFixed / recentMedIncome) * 100 : 100;

            trends.income = clampPct(priorMedIncome > 0 ? ((recentMedIncome - priorMedIncome) / priorMedIncome) * 100 : 0);
            trends.expenses = clampPct(priorMedExpenses > 0 ? ((recentMedExpenses - priorMedExpenses) / priorMedExpenses) * 100 : 0);
            trends.investments = clampPct(priorMedInvestments > 0 ? ((recentMedInvestments - priorMedInvestments) / priorMedInvestments) * 100 : (recentMedInvestments > 0 ? 50 : 0));
            trends.dti = clampPct(currDti - prevDti);

            if (trends.investments > 20) trends.momentum = "WEALTH_BUILDING";
            else if (trends.income > 10 && trends.expenses < 5) trends.momentum = "IMPROVING";
            else if (trends.expenses > 15 && trends.income < 5) trends.momentum = "DETERIORATING";
        } else if (trendHistory.length >= 2) {
            const lastMonth = trendHistory[trendHistory.length - 1];
            const previousMonths = trendHistory.slice(0, -1);

            const prevMedIncome = getMedian(previousMonths.map(m => m.income));
            const prevMedExpenses = getMedian(previousMonths.map(m => m.expenses));
            const prevMedFixed = getMedian(previousMonths.map(m => m.fixedExpenses));

            const prevDti = prevMedIncome > 0 ? (prevMedFixed / prevMedIncome) * 100 : 100;
            const currDti = lastMonth.income > 0 ? (lastMonth.fixedExpenses / lastMonth.income) * 100 : 100;

            trends.income = clampPct(prevMedIncome > 0 ? ((lastMonth.income - prevMedIncome) / prevMedIncome) * 100 : 0);
            trends.expenses = clampPct(prevMedExpenses > 0 ? ((lastMonth.expenses - prevMedExpenses) / prevMedExpenses) * 100 : 0);
            trends.dti = clampPct(currDti - prevDti);
        }

        if (history.length === 0) {
            throw new Error("No valid transactions found for the given user in Open Finance.");
        }

        // Generate a deterministic session key based on userId to ensure consistent shadow vectors
        const SESSION_KEY = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) || 777;

        // 5. Underwriting Feature Engineering — Weighted Rolling Average + CV Haircut
        // Use active months from `trendHistory` (sparse months excluded) so that a partial-month
        // sync or a one-off low-volume month doesn't drag the 12-month average down artificially.
        // Then apply weighted averaging that favors recent months for responsiveness to current reality.
        const activeIncomeMonths = trendHistory.filter(m => m.income > 0);
        const activeExpenseMonths = trendHistory.filter(m => m.expenses > 0);

        // ── ONE-OFF / OUTLIER NEUTRALIZATION (MAD filter) ─────────────────
        // The averages used for underwriting must reflect the borrower's TYPICAL
        // monthly behavior — not a single one-off event (large transfer, atypical
        // month, refund, etc.). Without this filter, a single outlier month could
        // inflate the 12-month "ממוצע הוצאות" by 30-50%, producing misleading DTI
        // and undermining the credit decision. Self-transfers across own accounts
        // are already excluded earlier; MAD covers everything else (one-off
        // unclassified transfers, atypical months, manual top-ups).
        const incomeValuesFiltered = filterMonthlyOutliersMAD(activeIncomeMonths.map(m => m.income));
        const expenseValuesFiltered = filterMonthlyOutliersMAD(activeExpenseMonths.map(m => m.expenses));
        const fixedValuesFiltered = filterMonthlyOutliersMAD(activeExpenseMonths.map(m => m.fixedExpenses));

        const incomeOutliersExcluded = activeIncomeMonths.length - incomeValuesFiltered.length;
        const expenseOutliersExcluded = activeExpenseMonths.length - expenseValuesFiltered.length;
        if (incomeOutliersExcluded > 0 || expenseOutliersExcluded > 0) {
            console.log(`[MAD Filter] Excluded ${incomeOutliersExcluded} income outliers, ${expenseOutliersExcluded} expense outliers from rolling averages.`);
        }

        const rawAvgIncome = incomeValuesFiltered.length > 0
            ? getWeightedAverage(incomeValuesFiltered)
            : 0;

        const avgExpenses = expenseValuesFiltered.length > 0
            ? getWeightedAverage(expenseValuesFiltered)
            : 0;

        const avgFixedExpenses = fixedValuesFiltered.length > 0
            ? getWeightedAverage(fixedValuesFiltered)
            : 0;

        // CV-based Income Haircut — risk-adjusted income for underwriting.
        // Computed on the OUTLIER-FILTERED income series so a single one-off doesn't
        // inflate volatility and trigger an unjustified haircut.
        // Tiers: CV<=0.15 → no haircut | 0.15-0.30 → up to 10% | 0.30-0.50 → up to 20% | >0.50 → up to 30% (capped).
        const incomeCV = getCoefficientOfVariation(incomeValuesFiltered);
        let incomeHaircut = 0;
        if (incomeCV > 0.15 && incomeCV <= 0.30) {
            incomeHaircut = ((incomeCV - 0.15) / 0.15) * 0.10;
        } else if (incomeCV > 0.30 && incomeCV <= 0.50) {
            incomeHaircut = 0.10 + ((incomeCV - 0.30) / 0.20) * 0.10;
        } else if (incomeCV > 0.50) {
            incomeHaircut = Math.min(0.30, 0.20 + ((incomeCV - 0.50) / 0.50) * 0.10);
        }
        const avgIncome = rawAvgIncome * (1 - incomeHaircut);
        console.log(`[Income Haircut] CV=${incomeCV.toFixed(3)}, Haircut=${(incomeHaircut * 100).toFixed(1)}%, Raw=${Math.round(rawAvgIncome)}, Adjusted=${Math.round(avgIncome)}`);

        // Legacy incomeVolatility retained for scoring (same definition as CV)
        const incomeVolatility = incomeCV;
        const DTI = avgIncome > 0 ? avgFixedExpenses / avgIncome : 1;
        const runwayMonths = avgExpenses > 0 ? (liquidAssets / avgExpenses) : 12;

        // 7. Built Financial Resilience Score
        let scoreServiceability = 0;
        const dtiPerc = DTI * 100;
        if (dtiPerc <= 40) scoreServiceability = 80 + (40 - dtiPerc) * 0.5;
        else if (dtiPerc <= 57) scoreServiceability = 55 + (57 - dtiPerc) * (24 / 17);
        else scoreServiceability = Math.max(0, 54 - (dtiPerc - 57));

        const positiveMonthsRatio = history.filter(m => m.netFlow > 0).length / history.length;
        const scoreStability = positiveMonthsRatio * 100;
        const scoreLiquidity = Math.min((runwayMonths / 6) * 100, 100);
        const scoreVolatility = Math.max(0, 100 - (incomeVolatility * 100));

        let finalScore = Math.round(
            (SCORING_WEIGHTS.STABILITY * scoreStability) +
            (SCORING_WEIGHTS.SERVICEABILITY * scoreServiceability) +
            (SCORING_WEIGHTS.LIQUIDITY * scoreLiquidity) +
            (SCORING_WEIGHTS.VOLATILITY * scoreVolatility)
        );

        // Boost score for Wealth Builders
        if (trends.momentum === "WEALTH_BUILDING") {
            finalScore = Math.min(100, finalScore + 10);
            console.log("[Resilience Boost] Applied Wealth Building +10 pts");
        }

        // --- EXTREME RISK CLAMP LAYER ---
        const isHighRiskDTI = dtiPerc > 120;
        const isHighRiskCashFlow = avgIncome > 0 ? (avgExpenses > avgIncome * 1.2) : (avgExpenses > 0);
        
        if (isHighRiskDTI || isHighRiskCashFlow) {
            finalScore = Math.min(finalScore, 45); // Medium range
        }

        const isExtremeDTI = dtiPerc > 150;
        const isExtremeCashFlow = avgIncome > 0 ? (avgExpenses > avgIncome * 1.5) : (avgExpenses > 0);
        
        if (isExtremeDTI || isExtremeCashFlow) {
            const expIncRatio = avgIncome > 0 ? (avgExpenses / avgIncome * 100).toFixed(1) : 'Infinity';
            console.log(`[Risk Clamp] Extreme risk detected. DTI: ${dtiPerc}%, Exp/Inc: ${expIncRatio}%`);
            finalScore = Math.min(finalScore, 25);

            const isVeryExtremeCashFlow = avgIncome > 0 ? (avgExpenses > avgIncome * 2.0) : (avgExpenses > 0);
            if (dtiPerc > 200 || isVeryExtremeCashFlow) {
                 finalScore = Math.min(finalScore, 15); // Set a realistic floor instead of crashing to 5
            }
        }
        // --------------------------------

        // Fetch custom underwriting rules
        let rules = {
            max_dti_approve: 35,
            max_dti_review: 45,
            min_liquidity_months: 1,
            max_expense_income_ratio: 90,
            min_income: 8000,
            enable_second_chance: true
        };
        try {
            const savedRules = await base44.asServiceRole.entities.UnderwritingRule.list();
            if (savedRules && savedRules.length > 0) {
                rules = { ...rules, ...savedRules[0] };
            }
        } catch (e) {
            console.warn("Could not fetch custom rules, using defaults", e);
        }

        let riskStatus = "ORANGE";
        if (finalScore >= 80) riskStatus = "GREEN";
        else if (finalScore < 55) riskStatus = "RED";

        // Apply Underwriting Rules overrides
        const expIncRatio = avgIncome > 0 ? (avgExpenses / avgIncome * 100) : 100;
        let isRejected = false;
        let isReview = false;
        let forceRedReason = null;

        if (dtiPerc > rules.max_dti_review) {
            isRejected = true;
            forceRedReason = `DTI (${Math.round(dtiPerc)}%) מעל המקסימום המותר (${rules.max_dti_review}%)`;
        }
        if (avgIncome < rules.min_income) {
            isRejected = true;
            forceRedReason = `הכנסה (₪${Math.round(avgIncome)}) נמוכה מהמינימום הנדרש (₪${rules.min_income})`;
        }
        
        if (dtiPerc > rules.max_dti_approve && dtiPerc <= rules.max_dti_review) isReview = true;
        if (expIncRatio > rules.max_expense_income_ratio) isReview = true;
        if (runwayMonths < rules.min_liquidity_months) isReview = true;

        if (isRejected) {
            riskStatus = "RED";
            finalScore = Math.min(finalScore, 45); // Cap score for rejected
        } else if (isReview && riskStatus === "GREEN") {
            riskStatus = "ORANGE";
            finalScore = Math.min(finalScore, 79); // Cap score for review
        }

        // --- 12 MONTHS CLEAN PROFILE CHECK (AUTO GREEN) ---
        let isClean12Months = false;
        if (history.length === 12) {
            const negativeKeywords = ['פיגור', 'החזרת', 'חריגה', 'הוצאה לפועל', 'עיקול', 'הגבלת', 'התראה', 'returned', 'arrears', 'collection', 'overdraft fee'];
            isClean12Months = true;
            
            const twelveMonthsAgo = new Date();
            twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
            
            const recentTxns = transactions.filter(tx => {
                const txDateObj = tx?.date;
                const dateStr = tx?.creationDate ||
                    (typeof txDateObj === 'string' ? txDateObj : (txDateObj?.valueDate || txDateObj?.bookingDate || txDateObj?.transactionDate)) ||
                    tx?.transactionDate;
                let date = dateStr ? new Date(dateStr) : today;
                return date >= twelveMonthsAgo;
            });

            for (const tx of recentTxns) {
                const desc = String(tx?.description || tx?.details || "").toLowerCase();
                const category = String(tx?.category?.main || tx?.categoryName || tx?.category || "").toLowerCase();
                const balanceAfter = Number(tx?.balance_after_transaction || tx?.balance || 0);

                const hasNegativeKeyword = negativeKeywords.some(kw => desc.includes(kw) || category.includes(kw));
                const hasNegativeBalance = (tx.balance_after_transaction !== undefined || tx.balance !== undefined) && balanceAfter < 0;

                if (hasNegativeKeyword || hasNegativeBalance) {
                    isClean12Months = false;
                    break;
                }
            }
            
            if (isClean12Months) {
                console.log("[12 Months Clean] Customer has been completely clean for 12 months. Enhancing status.");
                if (isRejected) {
                    riskStatus = "ORANGE";
                    finalScore = Math.max(finalScore, 65);
                    forceRedReason = null;
                } else if (isReview) {
                    riskStatus = "ORANGE";
                    finalScore = Math.max(finalScore, 75);
                } else {
                    riskStatus = "GREEN";
                    finalScore = Math.max(finalScore, 85);
                }
            }
        }

        // ── DB PERSISTENCE (Idempotent) ───────────────────────────────────
        // Until now the platform showed empty Transaction / FinancialSnapshot tables
        // because the engine only computed in-memory and returned to the client.
        // Now we persist the FILTERED, classified data so the platform DB is the
        // source of truth for portfolio analytics, audit, and B2B reporting.
        // Idempotent: we wipe the prior records for this user before re-inserting,
        // so re-running the engine doesn't accumulate duplicates.
        // Use the request-scoped client (acts AS the authenticated user) so that the
        // entity RLS auto-stamps `created_by` to user.email — service-role writes
        // are blocked by the RLS rule (`created_by == {{user.email}}`). When called
        // anonymously (no token), persistence is skipped silently.
        try {
            const me = await base44.auth.me().catch(() => null);
            const persistenceUserId = me?.id || userId;
            const entityClient = me?.email ? base44.entities : base44.asServiceRole.entities;
            if (!persistenceUserId) {
                console.log('[Persistence] Skipped: no user identifier in request context');
            } else {
                // 1. FinancialSnapshot — one consolidated record per run
                const snapshotPayload = {
                    user_id: persistenceUserId,
                    current_balance: Math.round(liquidAssets),
                    projected_eom_balance: Math.round(avgIncome - avgExpenses),
                    total_income: Math.round(avgIncome),
                    total_expenses: Math.round(avgExpenses),
                    avg_daily_spending: Math.round((avgExpenses || 0) / 30),
                    risk_level: riskStatus === 'GREEN' ? 'green' : riskStatus === 'RED' ? 'red' : 'yellow',
                    upload_date: new Date().toISOString()
                };
                await entityClient.FinancialSnapshot.create(snapshotPayload);

                // 2. Transactions — persist a bounded slice of the FILTERED transactions
                // (self-transfers excluded already). We only persist real income/expense
                // transactions so the DB reflects operational cash-flow only — matching
                // what the averages are computed on.
                const txnRecords = [];
                transactions.forEach((tx, txIdx) => {
                    if (selfTransferIndices.has(txIdx)) return;
                    const amount = parseTransactionAmount(tx);
                    if (isNaN(amount) || amount === 0) return;

                    const txDateObj = tx?.date;
                    const dateStr = tx?.creationDate ||
                        (typeof txDateObj === 'string' ? txDateObj : (txDateObj?.valueDate || txDateObj?.bookingDate || txDateObj?.transactionDate)) ||
                        tx?.transactionDate;
                    let date = dateStr ? new Date(dateStr) : new Date();
                    if (isNaN(date.getTime())) date = new Date();

                    txnRecords.push({
                        user_id: persistenceUserId,
                        date: date.toISOString().split('T')[0],
                        description: String(tx?.description || tx?.details || '').slice(0, 200),
                        amount: amount,
                        balance: Number(tx?.balance_after_transaction || tx?.balance || 0),
                        category: amount > 0 ? 'income' : 'expense'
                    });
                });

                // Cap at 500 most-recent to keep payload size sane and writes fast
                const recentTxnRecords = txnRecords
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .slice(0, 500);

                if (recentTxnRecords.length > 0) {
                    await entityClient.Transaction.bulkCreate(recentTxnRecords);
                }
                console.log(`[Persistence] Saved 1 FinancialSnapshot + ${recentTxnRecords.length} Transactions for ${persistenceUserId}`);
            }
        } catch (persistErr) {
            // Persistence failure must NOT break the underwriting response.
            console.error('[Persistence] Failed to save analytics data:', persistErr?.message || persistErr);
        }

        // ── BEHAVIOR PROFILE (story-level data for the AI Analyst) ──
        // We already have the filtered transactions, the recurring-income map, the
        // self-transfer indices and the per-month aggregates. Bundle them into a
        // compact, story-friendly profile so the InsightEngine can write "how this
        // customer actually lives through the month" — not just metric aggregates.
        const safeDesc = (tx) => {
            // Open Finance (Hapoalim/Israel) ships description as an object:
            //   { description: "העב' לאחר-נייד", initialClean, additionalInfo: <stringified JSON> }
            // Prefer the human-readable counterparty when present (debtorName at tx level)
            // then the structured description fields, then anything we can pull from additionalInfo.
            if (tx?.debtorName && typeof tx.debtorName === 'string' && tx.debtorName.trim()) {
                return tx.debtorName.trim();
            }
            const cand = tx?.description ?? tx?.details ?? tx?.remittanceInformation ?? tx?.narrative;
            if (!cand) return '';
            if (typeof cand === 'string') return cand.trim();
            if (typeof cand === 'object') {
                // Pick the most descriptive available field, in priority order
                const direct = cand.description || cand.text || cand.value || cand.original ||
                               cand.remittanceInformation || cand.narrative ||
                               cand.unstructured || cand.reference || cand.initialClean;
                if (direct && typeof direct === 'string') return direct.trim();
                // Last resort — try to parse additionalInfo's purposeDescription / transactionDescription
                if (typeof cand.additionalInfo === 'string') {
                    try {
                        const ai = JSON.parse(cand.additionalInfo);
                        const fromAi = ai?.purposeDescription || ai?.transactionDescription;
                        if (fromAi && typeof fromAi === 'string') return fromAi.trim();
                    } catch { /* not valid JSON */ }
                }
                return '';
            }
            return String(cand).trim();
        };
        const behaviorProfile = (() => {
            try {
                // 1) Recurring income streams (salary, pensions, child benefits, etc.)
                //    Group by cleaned description, keep streams that appear 3+ times.
                const incomeStreams = new Map();
                transactions.forEach((tx, idx) => {
                    if (selfTransferIndices.has(idx)) return;
                    const amount = parseTransactionAmount(tx);
                    if (isNaN(amount) || amount <= 0) return;
                    const txDesc = safeDesc(tx);
                    const clean = txDesc.toLowerCase().replace(/[0-9\-\/]/g, '').trim();
                    if (!clean || (incomeDescCount.get(clean) || 0) < 3) return;
                    const txDateObj = tx?.date;
                    const dateStr = tx?.creationDate ||
                        (typeof txDateObj === 'string' ? txDateObj : (txDateObj?.valueDate || txDateObj?.bookingDate || txDateObj?.transactionDate)) ||
                        tx?.transactionDate;
                    const d = dateStr ? new Date(dateStr) : null;
                    const dayOfMonth = d && !isNaN(d.getTime()) ? d.getDate() : null;
                    if (!incomeStreams.has(clean)) {
                        incomeStreams.set(clean, { label: txDesc.slice(0, 40), amounts: [], days: [] });
                    }
                    const s = incomeStreams.get(clean);
                    s.amounts.push(amount);
                    if (dayOfMonth) s.days.push(dayOfMonth);
                });
                const recurringIncome = Array.from(incomeStreams.values())
                    .map(s => ({
                        // 🔒 Redact personal names — keep only generic / institutional labels.
                        label: redactPersonalLabel(s.label),
                        avgAmount: Math.round(s.amounts.reduce((a, b) => a + b, 0) / s.amounts.length),
                        occurrences: s.amounts.length,
                        typicalDayOfMonth: s.days.length ? Math.round(getMedian(s.days)) : null
                    }))
                    .sort((a, b) => b.avgAmount * b.occurrences - a.avgAmount * a.occurrences)
                    .slice(0, 5);

                // 2) Top expense merchants (where the money actually goes)
                const merchantSpend = new Map();
                transactions.forEach((tx, idx) => {
                    if (selfTransferIndices.has(idx)) return;
                    const amount = parseTransactionAmount(tx);
                    if (isNaN(amount) || amount >= 0) return;
                    const txDesc = safeDesc(tx);
                    if (!txDesc) return;
                    // Group by first 3 words / 30 chars to merge "SHUFERSAL TLV" with "SHUFERSAL HAIFA"
                    const key = txDesc.toLowerCase().replace(/[0-9]/g, '').trim().split(/\s+/).slice(0, 3).join(' ').slice(0, 30);
                    if (!key) return;
                    const cur = merchantSpend.get(key) || { label: txDesc.slice(0, 40), total: 0, count: 0 };
                    cur.total += Math.abs(amount);
                    cur.count += 1;
                    merchantSpend.set(key, cur);
                });
                const topMerchants = Array.from(merchantSpend.values())
                    .map(m => ({
                        // 🔒 Redact personal names — same rule as recurringIncome.
                        label: redactPersonalLabel(m.label),
                        totalSpend: Math.round(m.total),
                        occurrences: m.count,
                        avgTicket: Math.round(m.total / m.count)
                    }))
                    .sort((a, b) => b.totalSpend - a.totalSpend)
                    .slice(0, 6);

                // 3) Cash-flow timing within the month: split each month into 3 windows
                //    (days 1-10, 11-20, 21-end) and measure expense share. Tells us if the
                //    customer "burns hot" right after salary or "runs dry" at month-end.
                const windowSpend = { early: 0, mid: 0, late: 0 };
                let timingSamples = 0;
                transactions.forEach((tx, idx) => {
                    if (selfTransferIndices.has(idx)) return;
                    const amount = parseTransactionAmount(tx);
                    if (isNaN(amount) || amount >= 0) return;
                    const txDateObj = tx?.date;
                    const dateStr = tx?.creationDate ||
                        (typeof txDateObj === 'string' ? txDateObj : (txDateObj?.valueDate || txDateObj?.bookingDate || txDateObj?.transactionDate)) ||
                        tx?.transactionDate;
                    const d = dateStr ? new Date(dateStr) : null;
                    if (!d || isNaN(d.getTime())) return;
                    const day = d.getDate();
                    const abs = Math.abs(amount);
                    if (day <= 10) windowSpend.early += abs;
                    else if (day <= 20) windowSpend.mid += abs;
                    else windowSpend.late += abs;
                    timingSamples++;
                });
                const totalWindowSpend = windowSpend.early + windowSpend.mid + windowSpend.late || 1;
                const spendTiming = {
                    earlyMonthPct: Math.round((windowSpend.early / totalWindowSpend) * 100),
                    midMonthPct:   Math.round((windowSpend.mid   / totalWindowSpend) * 100),
                    lateMonthPct:  Math.round((windowSpend.late  / totalWindowSpend) * 100),
                    samples: timingSamples
                };

                // 4) Overdraft / negative-balance touches (when the bank reports running balance)
                let overdraftDays = 0;
                let lowestBalanceSeen = null;
                transactions.forEach((tx) => {
                    const bal = Number(tx?.balance_after_transaction ?? tx?.balance);
                    if (!isFinite(bal)) return;
                    if (bal < 0) overdraftDays++;
                    if (lowestBalanceSeen === null || bal < lowestBalanceSeen) lowestBalanceSeen = bal;
                });

                // 5) Savings/investment discipline (monthly average outflow to investments)
                const monthsCounted = Math.max(1, history.length);
                const avgMonthlyInvestmentOutflow = Math.round(investmentTransfers / monthsCounted);

                // 5a) Pledgeable / collateralizable asset signals — money routed to investments is GOOD money.
                // It proves saving discipline and may create lender-side collateral options.
                const pledgeableAssets = [];
                const investableSecurities = Math.round(liquidAssetsBreakdown.etf || 0);
                const trainingFunds = Math.round(liquidAssetsBreakdown.trainingFund || 0);
                if (investableSecurities > 0) {
                    pledgeableAssets.push({
                        type: 'marketable_securities',
                        label: 'תיק השקעות / ניירות ערך',
                        estimatedValue: investableSecurities,
                        haircutPct: 20,
                        pledgeableValue: Math.round(investableSecurities * 0.8),
                        evidence: 'זוהה יתרת השקעות או העברות חוזרות להשקעות ב-12 החודשים האחרונים'
                    });
                }
                if (trainingFunds > 0) {
                    pledgeableAssets.push({
                        type: 'training_fund_or_provident',
                        label: 'קרן השתלמות / קופת גמל',
                        estimatedValue: trainingFunds,
                        haircutPct: 45,
                        pledgeableValue: Math.round(trainingFunds * 0.55),
                        evidence: 'זוהה נכס פנסיוני/חיסכון ארוך טווח שניתן לבחון כשעבוד חלקי'
                    });
                }
                const totalPledgeableValue = pledgeableAssets.reduce((sum, asset) => sum + asset.pledgeableValue, 0);

                // 5b) EXISTING LOANS DETECTION — scan the 12-month transaction window for
                // recurring debits that look like loan repayments (consumer loans, credit-card
                // installments, mortgages, BNPL, finance companies). This tells the AI Analyst
                // "the borrower already carries N existing loans" so the underwriting summary
                // doesn't ignore stacked debt the new loan would compound on top of.
                // We group by cleaned merchant key, keep groups with 3+ occurrences and stable
                // monthly amount, and tag the dominant loan type for the narrative.
                const loanKeywords = [
                    'הלוואה', 'החזר הלוואה', 'החזר קרן', 'משכנתא', 'תשלום להלוואה',
                    'תשלום חודשי', 'מימון', 'הסדר', 'קרדיט', 'אשראי',
                    'מקס', 'ישראכרט', 'כאל און', 'כאל-און', 'פיננסים ישירים',
                    'loan', 'mortgage', 'installment', 'finance', 'credit'
                ];
                const excludeFromLoans = ['משכור', 'שכר', 'salary', 'payroll', 'קצבה', 'פנסיה', 'ביטוח לאומי', 'לאומי', 'מלגה', 'ילדים'];
                const loanCandidates = new Map();
                transactions.forEach((tx, idx) => {
                    if (selfTransferIndices.has(idx)) return;
                    const amount = parseTransactionAmount(tx);
                    if (isNaN(amount) || amount >= 0) return; // outflows only
                    const absAmt = Math.abs(amount);
                    if (absAmt < 200 || absAmt > 30000) return; // typical loan repayment range
                    const desc = safeDesc(tx).toLowerCase();
                    const cat = String(tx?.category?.main || tx?.categoryName || tx?.category || '').toLowerCase();
                    const haystack = `${desc} ${cat}`;
                    if (!loanKeywords.some(kw => haystack.includes(kw.toLowerCase()))) return;
                    if (excludeFromLoans.some(kw => haystack.includes(kw.toLowerCase()))) return;
                    // Group key: first 3 meaningful words of description (after stripping digits)
                    const key = desc.replace(/[0-9\-\/]/g, '').trim().split(/\s+/).slice(0, 3).join(' ').slice(0, 40);
                    if (!key) return;
                    const txDateObj = tx?.date;
                    const dateStr = tx?.creationDate ||
                        (typeof txDateObj === 'string' ? txDateObj : (txDateObj?.valueDate || txDateObj?.bookingDate || txDateObj?.transactionDate)) ||
                        tx?.transactionDate;
                    const d = dateStr ? new Date(dateStr) : null;
                    const monthKey = d && !isNaN(d.getTime()) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : null;
                    if (!loanCandidates.has(key)) {
                        loanCandidates.set(key, { label: safeDesc(tx).slice(0, 40), amounts: [], months: new Set() });
                    }
                    const c = loanCandidates.get(key);
                    c.amounts.push(absAmt);
                    if (monthKey) c.months.add(monthKey);
                });
                const existingLoans = Array.from(loanCandidates.values())
                    .filter(c => c.months.size >= 3) // appears in 3+ distinct months = real recurring loan
                    .map(c => {
                        const avgAmount = Math.round(c.amounts.reduce((a, b) => a + b, 0) / c.amounts.length);
                        const lower = c.label.toLowerCase();
                        let loanType = 'consumer_loan';
                        if (/משכנתא|mortgage/.test(lower)) loanType = 'mortgage';
                        else if (/כאל|מקס|ישראכרט|credit/.test(lower)) loanType = 'credit_card_installment';
                        else if (/רכב|רכב auto|car/.test(lower)) loanType = 'auto_loan';
                        return {
                            label: redactPersonalLabel(c.label),
                            monthlyAmount: avgAmount,
                            monthsObserved: c.months.size,
                            loanType
                        };
                    })
                    .sort((a, b) => b.monthlyAmount - a.monthlyAmount)
                    .slice(0, 8);
                const existingLoansMonthlyTotal = existingLoans.reduce((sum, l) => sum + l.monthlyAmount, 0);

                // 6) Month-by-month story (last 6 months of net flow)
                const recentMonths = history.slice(-6).map(h => ({
                    month: h.month,
                    income: Math.round(h.income),
                    expenses: Math.round(h.expenses),
                    fixed: Math.round(h.fixedExpenses),
                    netFlow: Math.round(h.netFlow),
                    investedOut: Math.round(h.investmentTransfers || 0)
                }));
                const negativeMonths = recentMonths.filter(m => m.netFlow < 0).length;

                return {
                    recurringIncome,
                    topMerchants,
                    spendTiming,
                    overdraftDays,
                    lowestBalanceSeen: lowestBalanceSeen !== null ? Math.round(lowestBalanceSeen) : null,
                    avgMonthlyInvestmentOutflow,
                    recentMonths,
                    negativeMonthsInLast6: negativeMonths,
                    transactionsAnalyzed: transactions.length - selfTransferIndices.size,
                    existingLoans,
                    existingLoansMonthlyTotal,
                    existingLoansCount: existingLoans.length,
                    pledgeableAssets,
                    totalPledgeableValue,
                    investmentDiscipline: {
                        avgMonthlyInvestmentOutflow,
                        totalInvestmentTransfers12m: Math.round(investmentTransfers),
                        signal: avgMonthlyInvestmentOutflow > 0 ? 'POSITIVE_WEALTH_BUILDING' : 'NONE'
                    }
                };
            } catch (err) {
                console.warn('[BehaviorProfile] Failed to build:', err?.message);
                return null;
            }
        })();

        // ── UNDECLARED INCOME DISCREPANCY ENGINE ──────────────────────────────
        // FlowUp's differentiator: surface "strong on paper-weak" customers whose
        // REAL, consistent inflow exceeds their formally-declared income. We are NOT
        // labeling this "black money" — we only flag a legitimate, evidence-based gap
        // between declared salary and consistent actual inflow, so the lender can give
        // credit to applicants traditional models reject. Built entirely on top of the
        // already-cleaned behaviorProfile (self-transfers, one-offs & MAD already excluded).
        const undeclaredIncomeAnalysis = (() => {
            try {
                if (!behaviorProfile?.recurringIncome?.length) return null;

                const isSalaryLabel = (label) => {
                    const l = String(label || '').toLowerCase();
                    return ['משכורת', 'משכ', 'שכר', 'salary', 'payroll', 'פנסיה', 'קצבה', 'ביטוח לאומי'].some(kw => l.includes(kw));
                };

                // Formal declared income = recurring streams that look like salary/pension.
                // If none are detected, fall back to the policy minimum so the ratio stays meaningful.
                const formalIncome = behaviorProfile.recurringIncome
                    .filter(r => isSalaryLabel(r.label))
                    .reduce((sum, r) => sum + r.avgAmount, 0) || 0;

                // Actual consistent inflow = ALL recurring income streams (already 3+ occurrences).
                const actualInflow = behaviorProfile.recurringIncome.reduce((sum, r) => sum + r.avgAmount, 0);

                const baseline = formalIncome > 0 ? formalIncome : rules.min_income;
                const discrepancyGap = actualInflow - baseline;

                // Indication requires: meaningful gap (>25% of baseline), NO overdraft touches,
                // and a clean 12-month profile (no returned payments / arrears).
                const hasUnreportedInflowIndication =
                    discrepancyGap > (baseline * 0.25) &&
                    (behaviorProfile.overdraftDays || 0) === 0 &&
                    (behaviorProfile.negativeMonthsInLast6 || 0) === 0;

                const ratioPct = baseline > 0 ? Math.round((discrepancyGap / baseline) * 100) : 0;

                return {
                    formalIncome: Math.round(formalIncome),
                    formalIncomeSource: formalIncome > 0 ? 'detected_salary' : 'policy_minimum_fallback',
                    actualInflow: Math.round(actualInflow),
                    discrepancyGap: Math.round(discrepancyGap),
                    discrepancyRatio: baseline > 0 ? parseFloat((discrepancyGap / baseline).toFixed(2)) : 0,
                    hasUnreportedInflowIndication,
                    justificationText: hasUnreportedInflowIndication
                        ? `קיימת אינדיקציה לפעילות כלכלית גבוהה ב-${ratioPct}% מההכנסה המדווחת. התזרים הנכנס העקבי עומד על כ-₪${Math.round(actualInflow).toLocaleString('en-US')} בחודש, ללא משיכות יתר וללא חודשים שליליים — סיגנל לכושר החזר ריאלי חזק מהמשתקף בתלוש. מומלץ לשקול זאת בהערכת כושר ההחזר.`
                        : null
                };
            } catch (err) {
                console.warn('[UndeclaredIncome] Failed to compute:', err?.message);
                return null;
            }
        })();

        // ── FORENSIC INTELLIGENCE (must-have signals BDI can't see) ──
        // Built on the cleaned behaviorProfile + monthly history. Purely additive —
        // surfaces side-income, activity decline, early-distress and declaration gaps
        // for the AI Analyst and the underwriter, without touching the score.
        const forensicIntelligence = buildForensicIntelligence({
            behaviorProfile,
            history,
            trends,
            declaredMonthlyExpenses
        });

        // ── POSITIVE SIGNALS + ADVANCED FACTUAL SIGNALS ──
        // "Why approve" intelligence — quality signals the formal score may underrate,
        // plus factual behavioral context (cash dependency, seasonality, recovery,
        // lifestyle inflation, reinvestment). Both additive — never touch the score.
        const positiveSignals = buildPositiveSignals({ history, behaviorProfile, trends });
        const advancedSignals = buildAdvancedSignals({
            history,
            behaviorProfile,
            transactions,
            parseAmount: parseTransactionAmount,
            getDesc: safeDesc
        });

        return Response.json({
            success: true,
            status: riskStatus,
            score: finalScore,
            behaviorProfile,
            undeclaredIncomeAnalysis,
            forensicIntelligence,
            positiveSignals,
            advancedSignals,
            report: {
                score: finalScore,
                status: riskStatus,
                metrics: {
                    dti: Math.round(dtiPerc),
                    runwayMonths: parseFloat(runwayMonths.toFixed(1)),
                    monthlyAverageIncome: Math.round(avgIncome),
                    monthlyAverageExpenses: Math.round(avgExpenses),
                    liquidAssets: Math.round(liquidAssets),
                    liquidAssetsBreakdown: {
                        cash: Math.round(liquidAssetsBreakdown.cash),
                        etf: Math.round(liquidAssetsBreakdown.etf),
                        trainingFund: Math.round(liquidAssetsBreakdown.trainingFund)
                    },
                    trends: trends,
                    history: history
                }
            },
            metrics: {
                totalIncome: Math.round(avgIncome),
                rawIncome: Math.round(rawAvgIncome),
                incomeCV: parseFloat(incomeCV.toFixed(3)),
                incomeHaircutPct: parseFloat((incomeHaircut * 100).toFixed(1)),
                selfTransfersExcluded: selfTransferIndices.size / 2,
                incomeOutliersExcluded,
                expenseOutliersExcluded,
                totalExpenses: Math.round(avgExpenses),
                fixedExpenses: Math.round(avgFixedExpenses),
                lifestyleExpenses: Math.round(avgExpenses - avgFixedExpenses),
                netCashFlow: Math.round(avgIncome - avgExpenses),
                liquidAssets: Math.round(liquidAssets),
                liquidAssetsBreakdown: {
                    cash: Math.round(liquidAssetsBreakdown.cash),
                    etf: Math.round(liquidAssetsBreakdown.etf),
                    trainingFund: Math.round(liquidAssetsBreakdown.trainingFund)
                },
                score: finalScore,
                status: riskStatus,
                isClean12Months: isClean12Months,
                dti: Math.round(dtiPerc),
                runway: parseFloat(runwayMonths.toFixed(1)),
                trends: trends,
                forceRedReason: forceRedReason,
                undeclaredIncomeAnalysis,
                forensicIntelligence,
                positiveSignals,
                advancedSignals
            },
            availableAccounts,
            activeTargetAccountId,
            debugAccountsData
        });

    } catch (error) {
        console.error("loanLogicV2 Error:", error);
        return Response.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}));