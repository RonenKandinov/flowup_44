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
 * Weighted Rolling Average — gives more weight to recent months.
 * For a 12-month window: last 3 months carry 50% of the weight, prior 9 months share the other 50%.
 * Mathematically: recent months reflect current financial reality more accurately than older data,
 * which is critical for both salaried employees (raises, job changes) and freelancers (momentum).
 */
function getWeightedAverage(values) {
    if (!values || values.length === 0) return 0;
    if (values.length < 4) {
        // Not enough data for weighting — fall back to simple average
        return values.reduce((a, b) => a + b, 0) / values.length;
    }

    const recentCount = Math.min(3, Math.floor(values.length / 2));
    const recent = values.slice(-recentCount);
    const prior = values.slice(0, -recentCount);

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const priorAvg = prior.length > 0 ? prior.reduce((a, b) => a + b, 0) / prior.length : recentAvg;

    // 50/50 split: recent vs prior — smooths out one-off spikes while capturing current momentum
    return (recentAvg * 0.5) + (priorAvg * 0.5);
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

// --- MAIN EDGE FUNCTION ---

Deno.serve(withValidation(loanLogicSchema, async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json().catch(() => ({}));
        const userId = body?.userId || "ronenk2424@gmail.com";
        const targetAccountId = body?.targetAccountId;
        const manualLiquidAssets = Number(body?.manualLiquidAssets || body?.metrics?.liquidAssets || body?.liquidAssets || 0);

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
                    accounts = accounts.filter(acc => String(acc.id || acc.accountId || acc.accountNumber) === String(activeTargetAccountId));
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
                const txAccId = String(tx.accountId || tx.account_id || tx.accountNumber || "");
                return txAccId === String(activeTargetAccountId);
            });
        }

        // 4. Process Transactions into Monthly History
        const parseTransactionAmount = (tx) => {
            if (tx.amount !== undefined) {
                if (typeof tx.amount === 'object') {
                    let val = Number(tx.amount.amount || tx.amount.chargedAmount?.amount || 0);
                    const ind = String(tx.creditDebitIndicator || tx.indicator || "").toUpperCase();
                    if (ind === 'DBIT' || ind === 'DEBIT') return -Math.abs(val);
                    if (ind === 'CRDT' || ind === 'CREDIT') return Math.abs(val);
                    return val; // Assume it's signed if no indicator
                }
                return Number(tx.amount);
            }
            if (tx.credit !== undefined || tx.debit !== undefined) {
                return (Number(tx.credit) || 0) - (Number(tx.debit) || 0);
            }
            if (tx.amount_ils !== undefined) {
                return Number(tx.amount_ils);
            }
            return 0;
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
        const incomeDescCount = new Map();
        transactions.forEach((tx) => {
            const amount = parseTransactionAmount(tx);
            if (isNaN(amount) || amount <= 0) return;
            const txDescClean = String(tx?.description || tx?.details || "").toLowerCase().replace(/[0-9\-\/]/g, '').trim();
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

        // Calculate trends (12/4 Momentum Analysis)
        let trends = { income: 0, expenses: 0, dti: 0, investments: 0, momentum: "STABLE" };
        if (history.length >= 4) {
            const recent4 = history.slice(-4);
            const priorMonths = history.slice(0, -4);
            
            const recentAvgIncome = recent4.reduce((sum, m) => sum + m.income, 0) / recent4.length;
            const priorAvgIncome = priorMonths.length > 0 ? priorMonths.reduce((sum, m) => sum + m.income, 0) / priorMonths.length : recentAvgIncome;
            
            const recentAvgExpenses = recent4.reduce((sum, m) => sum + m.expenses, 0) / recent4.length;
            const priorAvgExpenses = priorMonths.length > 0 ? priorMonths.reduce((sum, m) => sum + m.expenses, 0) / priorMonths.length : recentAvgExpenses;
            
            const recentAvgFixed = recent4.reduce((sum, m) => sum + m.fixedExpenses, 0) / recent4.length;
            const priorAvgFixed = priorMonths.length > 0 ? priorMonths.reduce((sum, m) => sum + m.fixedExpenses, 0) / priorMonths.length : recentAvgFixed;
            
            const recentAvgInvestments = recent4.reduce((sum, m) => sum + m.investmentTransfers, 0) / recent4.length;
            const priorAvgInvestments = priorMonths.length > 0 ? priorMonths.reduce((sum, m) => sum + m.investmentTransfers, 0) / priorMonths.length : 0;
            
            const prevDti = priorAvgIncome > 0 ? (priorAvgFixed / priorAvgIncome) * 100 : 100;
            const currDti = recentAvgIncome > 0 ? (recentAvgFixed / recentAvgIncome) * 100 : 100;

            trends.income = priorAvgIncome > 0 ? ((recentAvgIncome - priorAvgIncome) / priorAvgIncome) * 100 : 0;
            trends.expenses = priorAvgExpenses > 0 ? ((recentAvgExpenses - priorAvgExpenses) / priorAvgExpenses) * 100 : 0;
            trends.investments = priorAvgInvestments > 0 ? ((recentAvgInvestments - priorAvgInvestments) / priorAvgInvestments) * 100 : (recentAvgInvestments > 0 ? 100 : 0);
            trends.dti = currDti - prevDti;
            
            if (trends.investments > 20) trends.momentum = "WEALTH_BUILDING";
            else if (trends.income > 10 && trends.expenses < 5) trends.momentum = "IMPROVING";
            else if (trends.expenses > 15 && trends.income < 5) trends.momentum = "DETERIORATING";
        } else if (history.length >= 2) {
            const lastMonth = history[history.length - 1];
            const previousMonths = history.slice(0, -1);
            
            const prevAvgIncome = previousMonths.reduce((sum, m) => sum + m.income, 0) / previousMonths.length;
            const prevAvgExpenses = previousMonths.reduce((sum, m) => sum + m.expenses, 0) / previousMonths.length;
            const prevAvgFixed = previousMonths.reduce((sum, m) => sum + m.fixedExpenses, 0) / previousMonths.length;
            
            const prevDti = prevAvgIncome > 0 ? (prevAvgFixed / prevAvgIncome) * 100 : 100;
            const currDti = lastMonth.income > 0 ? (lastMonth.fixedExpenses / lastMonth.income) * 100 : 100;

            trends.income = prevAvgIncome > 0 ? ((lastMonth.income - prevAvgIncome) / prevAvgIncome) * 100 : 0;
            trends.expenses = prevAvgExpenses > 0 ? ((lastMonth.expenses - prevAvgExpenses) / prevAvgExpenses) * 100 : 0;
            trends.dti = currDti - prevDti;
        }

        if (history.length === 0) {
            throw new Error("No valid transactions found for the given user in Open Finance.");
        }

        // Generate a deterministic session key based on userId to ensure consistent shadow vectors
        const SESSION_KEY = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) || 777;

        // 5. Underwriting Feature Engineering — Weighted Rolling Average + CV Haircut
        // Use active months (income/expense > 0) to avoid zero-months dragging the average down artificially,
        // then apply weighted averaging that favors recent months for responsiveness to current reality.
        const activeIncomeMonths = history.filter(m => m.income > 0);
        const activeExpenseMonths = history.filter(m => m.expenses > 0);

        const rawAvgIncome = activeIncomeMonths.length > 0
            ? getWeightedAverage(activeIncomeMonths.map(m => m.income))
            : 0;

        const avgExpenses = activeExpenseMonths.length > 0
            ? getWeightedAverage(activeExpenseMonths.map(m => m.expenses))
            : 0;

        const avgFixedExpenses = activeExpenseMonths.length > 0
            ? getWeightedAverage(activeExpenseMonths.map(m => m.fixedExpenses))
            : 0;

        // CV-based Income Haircut — risk-adjusted income for underwriting.
        // High volatility (common for freelancers, but also affects salaried with bonuses/commissions)
        // leads to a proportional reduction in "reliable" income used for DTI/runway.
        // Tiers: CV<=0.15 → no haircut | 0.15-0.30 → up to 10% | 0.30-0.50 → up to 20% | >0.50 → up to 30% (capped).
        const incomeCV = getCoefficientOfVariation(activeIncomeMonths.map(m => m.income));
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

        return Response.json({
            success: true,
            status: riskStatus,
            score: finalScore,
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
                forceRedReason: forceRedReason
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