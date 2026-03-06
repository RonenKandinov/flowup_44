import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

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

// --- QUALITY ASSURANCE & EXTRACTION ---
function extractBalance(acc) {
    let balance = 0;
    let extractionPath = 'none';
    let rawValues = {};

    try {
        if (!acc || typeof acc !== 'object') return { balance: 0, path: 'invalid_account_obj' };

        // Priority 1: Direct availableBalance (Common in Poalim/Open Finance Israel)
        if (acc.availableBalance !== undefined) {
            rawValues.availableBalance = acc.availableBalance;
            balance = Number(acc.availableBalance);
            extractionPath = 'availableBalance';
        } 
        // Priority 2: Direct currentBalance
        else if (acc.currentBalance !== undefined) {
            rawValues.currentBalance = acc.currentBalance;
            balance = Number(acc.currentBalance);
            extractionPath = 'currentBalance';
        }
        // Priority 3: Array of balances (Standard Open Banking)
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
                } else if (targetBal?.amount !== undefined) {
                    balance = Number(targetBal.amount);
                    extractionPath = 'balances[].amount';
                } else if (targetBal?.value !== undefined) {
                    balance = Number(targetBal.value);
                    extractionPath = 'balances[].value';
                }
            }
        } 
        // Priority 4: Direct balance object/value
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

// --- UNIT TESTS ---
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

// --- MAIN EDGE FUNCTION ---

Deno.serve(async (req) => {
    try {
        const body = await req.json().catch(() => ({}));
        const userId = body?.userId || "ronenk2424@gmail.com";
        const manualLiquidAssets = Number(body?.manualLiquidAssets || body?.metrics?.liquidAssets || body?.liquidAssets || 0);

        const API_ROOT = "https://api.open-finance.ai";
        const API_V2 = "https://api.open-finance.ai/v2";
        const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
        const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

        const base44 = createClientFromRequest(req);

        if (!API_KEY || !API_SECRET) {
            throw new Error("Missing Open Finance API keys");
        }

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
        const accessToken = tokenJson.accessToken;

        let liquidAssets = manualLiquidAssets;
        try {
            const accountsRes = await fetch(`${API_V2}/data/accounts`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/json"
                }
            });

            if (accountsRes.ok) {
                const accountsData = await accountsRes.json();
                const accounts = accountsData?.data || accountsData?.items || accountsData?.accounts || [];
                
                accounts.forEach((acc) => {
                    const type = (acc.type || acc.accountType || "").toLowerCase();
                    const name = (acc.name || acc.accountName || "").toLowerCase();
                    const { balance: balanceAmount, path } = extractBalance(acc);

                    if (balanceAmount !== 0) {
                        console.log(`[Account QA] Type: ${type || 'unknown'}, Extracted Balance: ${balanceAmount}, Extraction Path: ${path}`);
                        
                        if (type.includes('investment') || type.includes('securities') || name.includes('תיק') || name.includes('השקעות')) {
                            liquidAssets += (balanceAmount * 0.8);
                        } else {
                            liquidAssets += balanceAmount;
                        }
                    }
                });
            }
        } catch (e) {
            console.error("Failed to fetch/process accounts:", e);
        }

        liquidAssets = Math.max(0, liquidAssets);

        const txRes = await fetch(`${API_V2}/data/transactions`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json"
            }
        });

        const txData = await txRes.json();
        const transactions = txData?.data || txData?.items || txData?.transactions || [];

        const monthlyData = {};
        const today = new Date();
        let investmentTransfers = 0;

        const uniqueExpensesMap = new Map();
        transactions.forEach((tx) => {
            const amount = Number(tx?.amount?.chargedAmount?.amount || tx?.amount || 0);
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
                const limitedExpenses = expensesToClassify.slice(0, 100); 
                
                const prompt = `You are a financial underwriting classification engine.
                Classify expenses as FIXED, FLEXIBLE or LIQUID_ASSET_TRANSFER (Savings/Investments).
                
                FIXED: Recurring obligations (Rent, Loans, Insurance, Utilities).
                FLEXIBLE: Discretionary spending (Food, Shopping, Leisure).
                LIQUID_ASSET_TRANSFER: Deposits to savings, investments, "הפקדה לחיסכון", "קופת גמל".

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
                                        classification: { type: "string", enum: ["FIXED", "FLEXIBLE", "LIQUID_ASSET_TRANSFER"] }
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
                            aiClassifications[`${exp.desc}|${exp.category}`] = c.classification;
                        }
                    });
                }
            } catch (err) {
                console.error("AI Classification failed:", err.message);
            }
        }

        transactions.forEach((tx) => {
            const amount = Number(tx?.amount?.chargedAmount?.amount || tx?.amount || 0);
            if (isNaN(amount)) return;

            const category = (tx?.category?.main || tx?.category || "").toLowerCase();
            const txDateObj = tx?.date;
            const dateStr = tx?.creationDate || (typeof txDateObj === 'string' ? txDateObj : (txDateObj?.valueDate || txDateObj?.bookingDate)) || tx?.transactionDate;
            const txDesc = String(tx?.description || "").toLowerCase();

            let date = dateStr ? new Date(dateStr) : today;
            if (isNaN(date.getTime())) date = today;

            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { income: 0, expenses: 0, fixedExpenses: 0, flexibleExpenses: 0, netFlow: 0 };
            }

            const currentMonth = monthlyData[monthKey];

            if (amount > 0) {
                currentMonth.income += amount;
            } else {
                const absAmt = Math.abs(amount);
                const key = `${txDesc}|${category}`;
                const classification = aiMap[key] || aiClassifications[key];

                if (classification === "LIQUID_ASSET_TRANSFER") {
                    investmentTransfers += absAmt;
                } else if (classification === "FIXED") {
                    currentMonth.fixedExpenses += absAmt;
                    currentMonth.expenses += absAmt;
                } else {
                    currentMonth.flexibleExpenses += absAmt;
                    currentMonth.expenses += absAmt;
                }
            }
            currentMonth.netFlow = currentMonth.income - currentMonth.expenses;
        });

        liquidAssets += investmentTransfers;

        let history = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);

        const SESSION_KEY = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) || 777;

        const shadowHistory = history.map(m => ({
            incomeVec: toShadow(m.income, SESSION_KEY),
            fixedVec: toShadow(m.fixedExpenses, SESSION_KEY),
            totalExpVec: toShadow(m.expenses, SESSION_KEY)
        }));

        const avgIncome = fromShadow(shadowHistory.reduce((acc, h) => acc + h.incomeVec.m, 0) / history.length, shadowHistory.reduce((acc, h) => acc + h.incomeVec.p, 0) / history.length, SESSION_KEY);
        const avgExpenses = fromShadow(shadowHistory.reduce((acc, h) => acc + h.totalExpVec.m, 0) / history.length, shadowHistory.reduce((acc, h) => acc + h.totalExpVec.p, 0) / history.length, SESSION_KEY);
        const avgFixedExpenses = fromShadow(shadowHistory.reduce((acc, h) => acc + h.fixedVec.m, 0) / history.length, shadowHistory.reduce((acc, h) => acc + h.fixedVec.p, 0) / history.length, SESSION_KEY);

        const DTI = avgIncome > 0 ? avgFixedExpenses / avgIncome : 1;
        const runwayMonths = avgExpenses > 0 ? (liquidAssets / avgExpenses) : 12;

        const dtiPerc = DTI * 100;
        let scoreServiceability = dtiPerc <= 40 ? 80 + (40 - dtiPerc) * 0.5 : Math.max(0, 55 - (dtiPerc - 57));
        const scoreLiquidity = Math.min((runwayMonths / 6) * 100, 100);

        let finalScore = Math.round((SCORING_WEIGHTS.SERVICEABILITY * scoreServiceability) + (SCORING_WEIGHTS.LIQUIDITY * scoreLiquidity) + 30);

        return Response.json({
            success: true,
            status: finalScore >= 80 ? "GREEN" : finalScore < 55 ? "RED" : "ORANGE",
            score: finalScore,
            metrics: {
                totalIncome: Math.round(avgIncome),
                totalExpenses: Math.round(avgExpenses),
                fixedExpenses: Math.round(avgFixedExpenses),
                lifestyleExpenses: Math.round(avgExpenses - avgFixedExpenses),
                netCashFlow: Math.round(avgIncome - avgExpenses),
                liquidAssets: Math.round(liquidAssets),
                score: finalScore,
                dti: Math.round(dtiPerc),
                runway: parseFloat(runwayMonths.toFixed(1))
            }
        });

    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});