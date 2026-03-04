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

        // 1. Array of balances (Standard Open Banking)
        if (Array.isArray(acc.balances) && acc.balances.length > 0) {
            rawValues.balances = acc.balances;
            
            // Priority 1: interimAvailable or available
            let targetBal = acc.balances.find(b => 
                b.balanceType === "interimAvailable" || 
                b.type === "interimAvailable" ||
                b.balanceType === "available" ||
                b.type === "available"
            );
            
            // Priority 2: closingBooked or booked
            if (!targetBal) {
                targetBal = acc.balances.find(b => 
                    b.balanceType === "closingBooked" || 
                    b.type === "closingBooked" ||
                    b.balanceType === "booked" ||
                    b.type === "booked"
                );
            }
            
            // Fallback: first element
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
        // 2. Direct balance object/value
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
        // 3. currentBalance
        else if (acc.currentBalance !== undefined) {
            rawValues.currentBalance = acc.currentBalance;
            balance = Number(acc.currentBalance);
            extractionPath = 'currentBalance';
        } 
        // 4. availableBalance
        else if (acc.availableBalance !== undefined) {
            rawValues.availableBalance = acc.availableBalance;
            balance = Number(acc.availableBalance);
            extractionPath = 'availableBalance';
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

Deno.serve(async (req) => {
    try {
        const body = await req.json().catch(() => ({}));
        const userId = body?.userId || "ronenk2424@gmail.com";
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
                
                console.log(`[Liquid Assets] Processing ${accounts.length} accounts`);
                
                accounts.forEach((acc) => {
                    const type = (acc.type || acc.accountType || "").toLowerCase();
                    const { balance: balanceAmount, path } = extractBalance(acc);

                    if (balanceAmount !== 0) {
                        console.log(`[Account QA] Type: ${type || 'unknown'}, Extracted Balance: ${balanceAmount}, Extraction Path: ${path}`);
                        
                        // Apply haircut for investment accounts
                        if (type.includes('investment') || type.includes('securities') || type.includes('תיק')) {
                            liquidAssets += (balanceAmount * 0.8);
                        } else {
                            liquidAssets += balanceAmount;
                        }
                    } else {
                        console.warn(`[Account QA Warning] Zero or undetermined balance for account type: ${type || 'unknown'}. Path: ${path}`);
                    }
                });
                
                console.log(`[Liquid Assets] Total calculated: ${liquidAssets}`);
            }
        } catch (e) {
            console.error("Failed to fetch/process accounts:", e);
        }

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
        const transactions = txData?.data || txData?.items || txData?.transactions || [];

        // 4. Process Transactions into Monthly History
        const monthlyData = {};
        const today = new Date();
        let investmentTransfers = 0;

        // --- HYBRID AI CLASSIFICATION PRE-PROCESSING ---
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

        transactions.forEach((tx) => {
            const amount = Number(tx?.amount?.chargedAmount?.amount || tx?.amount || 0);
            if (isNaN(amount)) return;

            const category = (tx?.category?.main || tx?.category || "").toLowerCase();
            // tx.date from Open Finance is an object {valueDate, bookingDate, transactionDate} — not a string
            const txDateObj = tx?.date;
            const dateStr = tx?.creationDate ||
                (typeof txDateObj === 'string' ? txDateObj : (txDateObj?.valueDate || txDateObj?.bookingDate || txDateObj?.transactionDate)) ||
                tx?.transactionDate;
            const txDesc = String(tx?.description || "").toLowerCase();

            let date = dateStr ? new Date(dateStr) : today;
            if (isNaN(date.getTime())) date = today;

            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    month: monthKey,
                    income: 0,
                    expenses: 0,
                    fixedExpenses: 0,
                    flexibleExpenses: 0,
                    netFlow: 0
                };
            }

            const currentMonth = monthlyData[monthKey];

            if (amount > 0) {
                currentMonth.income += amount;
            } else {
                const absAmt = Math.abs(amount);
                
                // Detect transfers to investments, savings, provident funds, training funds
                const investmentKeywords = [
                    "השקע", "ניירות ערך", "מניות", "קרן", "גמל", "השתלמות", "פיקדון", "חסכון", "קופת", 
                    "מיטב", "אלטשולר", "הראל", "כלל", "מגדל", "פניקס", "פסגות", "ילין", "מור", "סחירות",
                    "investment", "stock", "fund", "deposit", "saving", "broker", "crypto", "trade", "portfolio"
                ];
                
                const isInvestmentTransfer = investmentKeywords.some(kw => category.includes(kw) || txDesc.includes(kw));
                if (isInvestmentTransfer) {
                    investmentTransfers += absAmt;
                }

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
                        // Hebrew
                        "הלוואה", "משכנתא", "ביטוח", "שכירות", "דירה", "חיוב", "תשלום קבוע",
                        "מנוי", "ארנונה", "חשמל", "מים", "גז", "ועד בית", "טלפון", "אינטרנט",
                        "החזר", "תשלומים", "מס", "היטל", "אגרה"
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
            currentMonth.netFlow = currentMonth.income - currentMonth.expenses;
        });

        // Add detected investment transfers to liquid assets
        liquidAssets += investmentTransfers;

        // Sort history chronologically and take only the last 6 months
        let history = Object.values(monthlyData)
            .sort((a, b) => a.month.localeCompare(b.month))
            .slice(-6);

        // Calculate trends
        let trends = { income: 0, expenses: 0, dti: 0 };
        if (history.length >= 2) {
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

        const SESSION_KEY = Math.random() * 1000;

        // 5. Shadow Vectorization
        const shadowHistory = history.map(m => ({
            incomeVec: toShadow(m.income, SESSION_KEY),
            fixedVec: toShadow(m.fixedExpenses, SESSION_KEY),
            totalExpVec: toShadow(m.expenses, SESSION_KEY),
            netVec: toShadow(m.netFlow, SESSION_KEY)
        }));

        // 6. Vector Reconstruction & Feature Engineering
        // Calculate deterministic averages directly from history to prevent fluctuating values
        const avgIncome = history.reduce((acc, h) => acc + h.income, 0) / history.length;
        const avgExpenses = history.reduce((acc, h) => acc + h.expenses, 0) / history.length;
        const avgFixedExpenses = history.reduce((acc, h) => acc + h.fixedExpenses, 0) / history.length;

        const incomeVolatility = getStandardDeviation(history.map(m => m.income)) / (avgIncome || 1);
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

        let riskStatus = "ORANGE";
        if (finalScore >= 80) riskStatus = "GREEN";
        else if (finalScore < 55) riskStatus = "RED";

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
                    trends: trends,
                    history: history
                }
            },
            metrics: {
                totalIncome: Math.round(avgIncome),
                totalExpenses: Math.round(avgExpenses),
                fixedExpenses: Math.round(avgFixedExpenses),
                lifestyleExpenses: Math.round(avgExpenses - avgFixedExpenses),
                netCashFlow: Math.round(avgIncome - avgExpenses),
                liquidAssets: Math.round(liquidAssets),
                score: finalScore,
                dti: Math.round(dtiPerc),
                runway: parseFloat(runwayMonths.toFixed(1)),
                trends: trends
            }
        });

    } catch (error) {
        console.error("loanLogicV2 Error:", error);
        return Response.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
});//