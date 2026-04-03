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

const API_ROOT = "https://api.open-finance.ai";
const API_V2 = "https://api.open-finance.ai/v2";

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

function extractBalance(acc) {
    let balance = 0;
    let extractionPath = 'none';
    let rawValues = {};

    try {
        if (!acc || typeof acc !== 'object') return { balance: 0, path: 'invalid_account_obj' };

        if (acc.availableBalance !== undefined) {
            rawValues.availableBalance = acc.availableBalance;
            balance = Number(acc.availableBalance);
            extractionPath = 'availableBalance';
        } else if (acc.currentBalance !== undefined) {
            rawValues.currentBalance = acc.currentBalance;
            balance = Number(acc.currentBalance);
            extractionPath = 'currentBalance';
        } else if (Array.isArray(acc.balances) && acc.balances.length > 0) {
            rawValues.balances = acc.balances;
            
            let targetBal = acc.balances.find(b => 
                b.balanceType === "interimAvailable" || b.type === "interimAvailable" ||
                b.balanceType === "available" || b.type === "available"
            );
            
            if (!targetBal) {
                targetBal = acc.balances.find(b => 
                    b.balanceType === "closingBooked" || b.type === "closingBooked" ||
                    b.balanceType === "booked" || b.type === "booked"
                );
            }
            
            if (!targetBal) targetBal = acc.balances[0];

            if (targetBal) {
                if (targetBal?.amount?.amount !== undefined) balance = Number(targetBal.amount.amount);
                else if (targetBal?.balanceAmount?.amount !== undefined) balance = Number(targetBal.balanceAmount.amount);
                else if (targetBal?.balanceAmount?.value !== undefined) balance = Number(targetBal.balanceAmount.value);
                else if (targetBal?.amount !== undefined) balance = Number(targetBal.amount);
                else if (targetBal?.value !== undefined) balance = Number(targetBal.value);
            }
        } else if (acc.balance !== undefined) {
            rawValues.balance = acc.balance;
            if (typeof acc.balance === 'object' && acc.balance !== null) {
                if (acc.balance.amount !== undefined) balance = Number(acc.balance.amount);
                else if (acc.balance.value !== undefined) balance = Number(acc.balance.value);
            } else {
                balance = Number(acc.balance);
            }
        }

        if (isNaN(balance) || balance === null) {
            balance = 0;
        }
        
    } catch (err) {
        balance = 0;
    }

    return { balance, path: extractionPath };
}

// --- MODULAR SUB-FUNCTIONS ---

async function fetchOpenFinanceToken(userId) {
    const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
    const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

    if (!API_KEY || !API_SECRET) throw new Error("Missing Open Finance API keys");

    const tokenRes = await fetch(`${API_ROOT}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, clientId: API_KEY, clientSecret: API_SECRET })
    });

    if (!tokenRes.ok) throw new Error(`Open Finance Auth Error: ${tokenRes.status} ${tokenRes.statusText}`);

    const tokenJson = await tokenRes.json();
    if (!tokenJson?.accessToken) throw new Error("Failed to get access token from Open Finance");
    
    return tokenJson.accessToken;
}

async function fetchAndProcessAccounts(accessToken, targetAccountId, manualLiquidAssets) {
    let liquidAssets = 0;
    let liquidAssetsBreakdown = { cash: 0, etf: 0, trainingFund: 0 };
    let debugAccountsData = [];
    let availableAccounts = [];
    let activeTargetAccountId = targetAccountId;

    const accountsRes = await fetch(`${API_V2}/data/accounts`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
    });

    if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        debugAccountsData = accountsData;
        let rawAccounts = accountsData?.data || accountsData?.items || accountsData?.accounts || [];
        if (!rawAccounts.length && Array.isArray(accountsData)) rawAccounts = accountsData;
        
        const uniqueAccountsMap = new Map();
        rawAccounts.forEach(acc => {
            const key = acc.id || acc.accountId || acc.accountNumber;
            if (!uniqueAccountsMap.has(key)) {
                uniqueAccountsMap.set(key, acc);
            } else {
                const existingBal = extractBalance(uniqueAccountsMap.get(key)).balance;
                const newBal = extractBalance(acc).balance;
                if (existingBal === 0 && newBal !== 0) uniqueAccountsMap.set(key, acc);
            }
        });
        let accounts = Array.from(uniqueAccountsMap.values());
        
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

        if (activeTargetAccountId && activeTargetAccountId !== 'all') {
            accounts = accounts.filter(acc => String(acc.id || acc.accountId || acc.accountNumber) === String(activeTargetAccountId));
        }
        
        accounts.forEach((acc) => {
            const type = (acc.type || acc.accountType || "").toLowerCase();
            const name = (acc.name || acc.accountName || "").toLowerCase(); 
            const product = (acc.product || "").toLowerCase();
            const details = (acc.details || "").toLowerCase();
            const cashAccountType = (acc.cashAccountType || "").toLowerCase();
            
            let { balance: balanceAmount } = extractBalance(acc);
            
            if (balanceAmount === 0) {
                if (acc.availableBalance !== undefined) balanceAmount = Number(acc.availableBalance);
                else if (acc.currentBalance !== undefined) balanceAmount = Number(acc.currentBalance);
                else if (acc.balance !== undefined && !isNaN(Number(acc.balance))) balanceAmount = Number(acc.balance);
                else if (acc.balance?.amount !== undefined) balanceAmount = Number(acc.balance.amount);
            }

            if (balanceAmount !== 0) {
                const isOverdraft = type.includes('overdraft') || name.includes('overdraft') || name.includes('מינוס') || product.includes('מינוס');
                const isInvestment = type.includes('investment') || type.includes('securities') || name.includes('תיק') || name.includes('השקעות') || name.includes('ניירות ערך') || name.includes('סחירות') || name.includes('מנייתי') || name.includes('מט"ח') || name.includes('ibi') || name.includes('meitav') || name.includes('excellence') || product.includes('השקעות') || product.includes('ניירות ערך');
                const isTrainingFund = type.includes('training') || type.includes('provident') || type.includes('pension') || name.includes('השתלמות') || name.includes('גמל') || name.includes('פנסיה') || name.includes('קופת') || product.includes('השתלמות') || product.includes('גמל') || product.includes('פנסיה');

                let finalBalance = balanceAmount;
                if (isOverdraft) finalBalance = -Math.abs(balanceAmount);

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
    }

    liquidAssets += manualLiquidAssets;
    liquidAssetsBreakdown.cash += manualLiquidAssets;
    liquidAssets = Math.max(0, liquidAssets);

    return { liquidAssets, liquidAssetsBreakdown, availableAccounts, activeTargetAccountId, debugAccountsData };
}

async function fetchAndProcessTransactions(accessToken, activeTargetAccountId, base44) {
    const txRes = await fetch(`${API_V2}/data/transactions`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
    });

    if (!txRes.ok) throw new Error(`Open Finance TX Error: ${txRes.status} ${txRes.statusText}`);

    const txData = await txRes.json();
    let transactions = txData?.data || txData?.items || txData?.transactions || [];

    if (activeTargetAccountId && activeTargetAccountId !== 'all') {
        transactions = transactions.filter(tx => {
            const txAccId = String(tx.accountId || tx.account_id || tx.accountNumber || "");
            return txAccId === String(activeTargetAccountId);
        });
    }

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
    if (uniqueExpensesMap.size > 0 && base44) {
        try {
            const expensesToClassify = Array.from(uniqueExpensesMap.values()).map((e, idx) => ({ id: idx, ...e }));
            const limitedExpenses = expensesToClassify.slice(0, 100);
            
            const prompt = `You are a financial underwriting classification engine.
Your goal is to classify expenses as FIXED or FLEXIBLE for credit risk analysis.
Rules: If a transaction appears regularly and in similar amount -> classify as FIXED.
If unclear -> classify as FLEXIBLE. Return JSON only.
Transactions:
${JSON.stringify(limitedExpenses)}`;
            
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

    return { transactions, aiClassifications };
}

function buildMonthlyHistory(transactions, aiClassifications) {
    const monthlyData = {};
    const today = new Date();
    let investmentTransfers = 0;

    const incomeDescCount = new Map();
    transactions.forEach((tx) => {
        const amount = Number(tx?.amount?.chargedAmount?.amount || tx?.amount || 0);
        if (isNaN(amount) || amount <= 0) return;
        const txDescClean = String(tx?.description || tx?.details || "").toLowerCase().replace(/[0-9\-\/]/g, '').trim();
        if (txDescClean) {
            incomeDescCount.set(txDescClean, (incomeDescCount.get(txDescClean) || 0) + 1);
        }
    });

    transactions.forEach((tx) => {
        const amount = Number(tx?.amount?.chargedAmount?.amount || tx?.amount || 0);
        if (isNaN(amount)) return;

        const category = (tx?.category?.main || tx?.categoryName || tx?.category || "").toLowerCase();
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
                income: 0, primaryIncome: 0,
                expenses: 0, fixedExpenses: 0, flexibleExpenses: 0,
                investmentTransfers: 0, netFlow: 0
            };
        }

        const currentMonth = monthlyData[monthKey];

        const txDescClean = txDesc.replace(/[0-9\-\/]/g, '').trim();
        const isRecurringIncome = amount > 0 && txDescClean && incomeDescCount.get(txDescClean) >= 3;

        const isInternalTransfer = ["העברה בין חשבונות", "העברה פנימית", "internal transfer", "own account"].some(kw => category.includes(kw) || txDesc.includes(kw));
        const isLoanDeposit = amount >= 15000 && ["הלוואה", "loan", "משכנתא", "mortgage", "מימון", "הלוואות"].some(kw => category.includes(kw) || txDesc.includes(kw));
        const isDefiniteSalary = amount > 0 && ["משכורת", "שכר", "salary", "payroll", "קצבה", "ביטוח לאומי", "פנסיה", "מס\"ב"].some(kw => category.includes(kw) || txDesc.includes(kw));
        const isRefundOrReversal = amount > 0 && ["החזר", "refund", "reversal", "ביטול"].some(kw => category.includes(kw) || txDesc.includes(kw)) && !txDesc.includes("זיכוי");
        
        const investmentKeywords = ["השקע", "ניירות ערך", "מניות", "קרן", "גמל", "השתלמות", "פיקדון", "חסכון", "קופת", "investment", "stock", "fund", "deposit", "saving"];
        const isInvestmentTransfer = amount < 0 && investmentKeywords.some(kw => category.includes(kw) || txDesc.includes(kw));

        if (amount > 0) {
            if (!isInternalTransfer && !isLoanDeposit && !isInvestmentTransfer && !isRefundOrReversal) {
                let weightedAmount = amount;
                let isPrimary = false;

                if (isDefiniteSalary || isRecurringIncome) {
                    weightedAmount = amount; 
                    isPrimary = true;
                } else {
                    weightedAmount = amount * 0.5;
                }

                currentMonth.income += weightedAmount;
                if (isPrimary) currentMonth.primaryIncome += amount;
            }
        } else {
            const absAmt = Math.abs(amount);
            
            if (isInvestmentTransfer) {
                investmentTransfers += absAmt;
                currentMonth.investmentTransfers += absAmt;
            }

            if (!isInternalTransfer && !isInvestmentTransfer) {
                currentMonth.expenses += absAmt;
                
                const key = `${txDesc}|${category}`;
                let isFixed = false;

                const ofClassType = (tx?.classification?.type || "").toUpperCase();
                if (ofClassType === "REGULAR_EXPENSE" || ofClassType === "REGULAR_INCOME") {
                    isFixed = (ofClassType === "REGULAR_EXPENSE");
                } else if (aiClassifications[key] !== undefined) {
                    isFixed = aiClassifications[key];
                } else {
                    const fixedKeywords = ["housing", "loan", "insurance", "transportation", "utilities", "rent", "fixed", "הלוואה", "משכנתא", "ביטוח", "שכירות", "מנוי", "ארנונה", "חשמל"];
                    isFixed = fixedKeywords.some((keyword) => category.includes(keyword) || txDesc.includes(keyword));
                }
                
                if (isFixed) currentMonth.fixedExpenses += absAmt;
                else currentMonth.flexibleExpenses += absAmt;
            }
        }
        currentMonth.netFlow = currentMonth.income - currentMonth.expenses;
    });

    let history = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));

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

    return { history: history.slice(-12), additionalInvestmentTransfers: investmentTransfers };
}

function calculateMetricsAndTrends(history, liquidAssets) {
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

    const allIncomes = history.map(m => m.income).sort((a, b) => b - a);
    const top3Incomes = allIncomes.slice(0, 3).filter(i => i > 0);
    const rawBestIncome = top3Incomes.length > 0 ? top3Incomes.reduce((a, b) => a + b, 0) / top3Incomes.length : 0;
        
    const allPrimaryIncomes = history.map(m => m.primaryIncome).sort((a, b) => b - a);
    const top3Primary = allPrimaryIncomes.slice(0, 3).filter(i => i > 0);
    const bestPrimaryIncome = top3Primary.length > 0 ? top3Primary.reduce((a, b) => a + b, 0) / top3Primary.length : 0;

    const avgIncome = Math.max(rawBestIncome, bestPrimaryIncome);
    const avgExpenses = getMedian(history.map(m => m.expenses));
    const avgFixedExpenses = getMedian(history.map(m => m.fixedExpenses));

    const incomeVolatility = getStandardDeviation(history.map(m => m.income)) / (avgIncome || 1);
    const DTI = avgIncome > 0 ? avgFixedExpenses / avgIncome : 1;
    const runwayMonths = avgExpenses > 0 ? (liquidAssets / avgExpenses) : 12;

    return { avgIncome, avgExpenses, avgFixedExpenses, incomeVolatility, DTI, runwayMonths, trends };
}

async function evaluateRiskAndRules(base44, metrics, history, transactions) {
    const { avgIncome, avgExpenses, incomeVolatility, DTI, runwayMonths, trends } = metrics;
    
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

    if (trends.momentum === "WEALTH_BUILDING") finalScore = Math.min(100, finalScore + 10);

    const isHighRiskDTI = dtiPerc > 120;
    const isHighRiskCashFlow = avgIncome > 0 ? (avgExpenses > avgIncome * 1.2) : (avgExpenses > 0);
    if (isHighRiskDTI || isHighRiskCashFlow) finalScore = Math.min(finalScore, 45);

    const isExtremeDTI = dtiPerc > 150;
    const isExtremeCashFlow = avgIncome > 0 ? (avgExpenses > avgIncome * 1.5) : (avgExpenses > 0);
    if (isExtremeDTI || isExtremeCashFlow) {
        finalScore = Math.min(finalScore, 25);
        const isVeryExtremeCashFlow = avgIncome > 0 ? (avgExpenses > avgIncome * 2.0) : (avgExpenses > 0);
        if (dtiPerc > 200 || isVeryExtremeCashFlow) finalScore = Math.min(finalScore, 15);
    }

    let rules = { max_dti_approve: 35, max_dti_review: 45, min_liquidity_months: 1, max_expense_income_ratio: 90, min_income: 8000, enable_second_chance: true };
    if (base44) {
        try {
            const savedRules = await base44.asServiceRole.entities.UnderwritingRule.list();
            if (savedRules && savedRules.length > 0) rules = { ...rules, ...savedRules[0] };
        } catch (e) {
            console.warn("Could not fetch custom rules, using defaults", e);
        }
    }

    let riskStatus = finalScore >= 80 ? "GREEN" : (finalScore < 55 ? "RED" : "ORANGE");

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
        finalScore = Math.min(finalScore, 45);
    } else if (isReview && riskStatus === "GREEN") {
        riskStatus = "ORANGE";
        finalScore = Math.min(finalScore, 79);
    }

    let isClean12Months = false;
    if (history.length === 12) {
        const negativeKeywords = ['פיגור', 'החזרת', 'חריגה', 'הוצאה לפועל', 'עיקול', 'הגבלת', 'התראה', 'returned', 'arrears', 'collection', 'overdraft fee'];
        isClean12Months = true;
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        
        const recentTxns = transactions.filter(tx => {
            const txDateObj = tx?.date;
            const dateStr = tx?.creationDate || (typeof txDateObj === 'string' ? txDateObj : (txDateObj?.valueDate || txDateObj?.bookingDate || txDateObj?.transactionDate)) || tx?.transactionDate;
            let date = dateStr ? new Date(dateStr) : new Date();
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
            riskStatus = "GREEN";
            finalScore = Math.max(finalScore, 85);
            forceRedReason = null;
        }
    }

    return { finalScore, riskStatus, forceRedReason, isClean12Months, dtiPerc, expIncRatio };
}

// --- MAIN EDGE FUNCTION ---

Deno.serve(withValidation(loanLogicSchema, async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json().catch(() => ({}));
        const userId = body?.userId || "ronenk2424@gmail.com";
        const targetAccountId = body?.targetAccountId;
        const manualLiquidAssets = Number(body?.manualLiquidAssets || body?.metrics?.liquidAssets || body?.liquidAssets || 0);

        // 1. Authenticate & Fetch token
        const accessToken = await fetchOpenFinanceToken(userId);

        // 2. Fetch & process accounts
        const accountsData = await fetchAndProcessAccounts(accessToken, targetAccountId, manualLiquidAssets);
        let { liquidAssets, liquidAssetsBreakdown, availableAccounts, activeTargetAccountId, debugAccountsData } = accountsData;

        // 3. Fetch transactions & classify
        const { transactions, aiClassifications } = await fetchAndProcessTransactions(accessToken, activeTargetAccountId, base44);

        // 4. Build history
        const { history, additionalInvestmentTransfers } = buildMonthlyHistory(transactions, aiClassifications);
        
        if (history.length === 0) throw new Error("No valid transactions found for the given user in Open Finance.");
        
        liquidAssets += additionalInvestmentTransfers;
        liquidAssetsBreakdown.etf += additionalInvestmentTransfers;

        // 5. Calculate Metrics
        const metrics = calculateMetricsAndTrends(history, liquidAssets);
        
        // 6. Evaluate Risk & Rules
        const riskData = await evaluateRiskAndRules(base44, metrics, history, transactions);

        // 7. Format Output
        return Response.json({
            success: true,
            status: riskData.riskStatus,
            score: riskData.finalScore,
            report: {
                score: riskData.finalScore,
                status: riskData.riskStatus,
                metrics: {
                    dti: Math.round(riskData.dtiPerc),
                    runwayMonths: parseFloat(metrics.runwayMonths.toFixed(1)),
                    monthlyAverageIncome: Math.round(metrics.avgIncome),
                    monthlyAverageExpenses: Math.round(metrics.avgExpenses),
                    liquidAssets: Math.round(liquidAssets),
                    liquidAssetsBreakdown: {
                        cash: Math.round(liquidAssetsBreakdown.cash),
                        etf: Math.round(liquidAssetsBreakdown.etf),
                        trainingFund: Math.round(liquidAssetsBreakdown.trainingFund)
                    },
                    trends: metrics.trends,
                    history: history
                }
            },
            metrics: {
                totalIncome: Math.round(metrics.avgIncome),
                totalExpenses: Math.round(metrics.avgExpenses),
                fixedExpenses: Math.round(metrics.avgFixedExpenses),
                lifestyleExpenses: Math.round(metrics.avgExpenses - metrics.avgFixedExpenses),
                netCashFlow: Math.round(metrics.avgIncome - metrics.avgExpenses),
                liquidAssets: Math.round(liquidAssets),
                liquidAssetsBreakdown: {
                    cash: Math.round(liquidAssetsBreakdown.cash),
                    etf: Math.round(liquidAssetsBreakdown.etf),
                    trainingFund: Math.round(liquidAssetsBreakdown.trainingFund)
                },
                score: riskData.finalScore,
                status: riskData.riskStatus,
                isClean12Months: riskData.isClean12Months,
                dti: Math.round(riskData.dtiPerc),
                runway: parseFloat(metrics.runwayMonths.toFixed(1)),
                trends: metrics.trends,
                forceRedReason: riskData.forceRedReason
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