import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const TERM_OPTIONS = [24, 36, 48, 60, 72, 84];

function calculateMonthlyPayment(principal, annualRate, termMonths) {
  const monthlyRate = annualRate / 12;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));
}

function calculateApprovalProbability(dsr, liquidityMonths, amountRatio, termMonths) {
  let score = 92;
  score -= Math.max(0, dsr - 35) * 1.4;
  score += Math.min(12, Math.max(0, (liquidityMonths - 2) * 3));
  score -= Math.max(0, amountRatio - 0.7) * 35;
  score -= termMonths >= 84 ? 6 : termMonths >= 72 ? 3 : 0;
  return Math.max(5, Math.min(99, Math.round(score)));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const requestedAmount = Number(body?.principal || 50000);
    const baseRate = Number(body?.baseRate || 0.09);

    let avgIncome = Number(body?.income || 0);
    let liquidAssets = Number(body?.liquidAssets || 0);
    let avgFixedExpenses = Number(body?.fixedExpenses || 0);

    if (!avgIncome || liquidAssets === undefined || avgFixedExpenses === undefined) {
      const userId = body?.userId || 'ronenk2424@gmail.com';
      const API_ROOT = 'https://api.open-finance.ai';
      const API_V2 = 'https://api.open-finance.ai/v2';
      const API_KEY = Deno.env.get('OPEN_FINANCE_API_KEY');
      const API_SECRET = Deno.env.get('OPEN_FINANCE_API_SECRET');

      if (!API_KEY || !API_SECRET) {
        throw new Error('Missing Open Finance API keys');
      }

      const tokenRes = await fetch(`${API_ROOT}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, clientId: API_KEY, clientSecret: API_SECRET })
      });
      if (!tokenRes.ok) throw new Error('Auth Error');
      const { accessToken } = await tokenRes.json();

      const accountsRes = await fetch(`${API_V2}/data/accounts`, { headers: { Authorization: `Bearer ${accessToken}` } });
      liquidAssets = 0;
      if (accountsRes.ok) {
        const accData = await accountsRes.json();
        const accounts = accData.data || accData.items || [];
        accounts.forEach((acc) => {
          const bal = Number(acc.availableBalance || acc.currentBalance || acc.balance?.amount || 0);
          if (bal > 0) liquidAssets += bal;
        });
      }

      const txRes = await fetch(`${API_V2}/data/transactions`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const txData = await txRes.json();
      const transactions = txData.data || txData.items || [];

      let totalIncome = 0;
      const incomeMonths = new Set();
      const categoryExpenses = {};

      transactions.forEach((tx) => {
        let amount = Number(tx.amount?.amount || tx.amount || 0);
        const ind = String(tx.creditDebitIndicator || tx.indicator || '').toUpperCase();
        if (ind === 'DBIT' || ind === 'DEBIT') amount = -Math.abs(amount);
        else if (ind === 'CRDT' || ind === 'CREDIT') amount = Math.abs(amount);
        else if (tx.credit !== undefined || tx.debit !== undefined) amount = (Number(tx.credit) || 0) - (Number(tx.debit) || 0);

        const txDesc = String(tx?.description || tx?.details || '').toLowerCase();
        const category = String(tx.category?.main || tx.categoryName || tx.category || 'general').toLowerCase();

        const isPersonalIncome = amount > 0 && ['משכורת', 'שכר', 'salary', 'payroll', 'קצבה', 'ביטוח לאומי', 'פנסיה', 'ילדים', 'מלגה'].some((kw) => category.includes(kw) || txDesc.includes(kw));
        const personalExpenseKeywords = ['סופר', 'מסעדה', 'ביגוד', 'בילוי', 'supermarket', 'restaurant', 'clothing', 'entertainment', 'wolts', 'wolt', 'תן ביס', 'מכולת', 'פארם', 'קולנוע', 'סרט'];
        const isPersonalExpense = amount < 0 && personalExpenseKeywords.some((kw) => category.includes(kw) || txDesc.includes(kw));

        if (amount > 0 && !isPersonalIncome) {
          totalIncome += amount;
          const date = tx.date?.valueDate || tx.creationDate || tx.transactionDate || new Date().toISOString();
          incomeMonths.add(String(date).substring(0, 7));
        } else if (amount < 0 && !isPersonalExpense) {
          const key = `${category} | ${txDesc}`;
          if (!categoryExpenses[key]) categoryExpenses[key] = [];
          categoryExpenses[key].push(Math.abs(amount));
        }
      });

      const monthsCount = Math.max(1, incomeMonths.size);
      avgIncome = totalIncome / monthsCount;

      let fixedExpensesSum = 0;
      Object.entries(categoryExpenses).forEach(([cat, amounts]) => {
        const catAvg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const threshold = catAvg * 2.5;
        const cleanAmounts = amounts.filter((a) => a <= threshold);
        const catCleanTotal = cleanAmounts.reduce((a, b) => a + b, 0);
        const fixedKeywords = [
          'housing', 'loan', 'insurance', 'transportation', 'utilities', 'rent', 'fixed', 'commitment',
          'mortgage', 'lease', 'subscription', 'installment', 'payment plan', 'supplier', 'cloud', 'software', 'saas', 'hosting', 'office', 'payroll', 'salary',
          'הלוואה', 'משכנתא', 'ביטוח', 'שכירות', 'דירה', 'חיוב', 'תשלום קבוע', 'מנוי', 'ארנונה', 'חשמל', 'מים', 'גז', 'ועד בית', 'טלפון', 'אינטרנט',
          'החזר', 'תשלומים', 'מס', 'היטל', 'אגרה', 'מע"מ', 'מעמ', 'ביטוח לאומי', 'ספק', 'ענן', 'תוכנה', 'משרד', 'משכורת', 'שכר עבודה', 'רואה חשבון', 'ייעוץ', 'פרסום', 'שיווק', 'גוגל', 'פייסבוק'
        ];
        if (fixedKeywords.some((k) => cat.includes(k))) {
          fixedExpensesSum += catCleanTotal;
        }
      });

      avgFixedExpenses = fixedExpensesSum / Math.max(1, incomeMonths.size);
    }

    const dsrBefore = avgIncome > 0 ? (avgFixedExpenses / avgIncome) * 100 : 100;
    const liquidityMonths = avgFixedExpenses > 0 ? liquidAssets / avgFixedExpenses : 12;
    const beforeProbability = calculateApprovalProbability(dsrBefore, liquidityMonths, 0.5, 24);

    const maxAllowedDownPayment = Math.min(liquidAssets, requestedAmount * 0.3);
    const downPaymentSteps = [0, 0.1, 0.2, 0.3]
      .map((ratio) => Math.min(maxAllowedDownPayment, requestedAmount * ratio))
      .filter((value, index, arr) => arr.indexOf(value) === index);

    const candidates = [];

    for (const term of TERM_OPTIONS) {
      for (const downPayment of downPaymentSteps) {
        const suggestedLoanAmount = requestedAmount - downPayment;
        if (suggestedLoanAmount <= 0) continue;

        const monthlyPayment = calculateMonthlyPayment(suggestedLoanAmount, baseRate, term);
        const dsrAfter = avgIncome > 0 ? ((avgFixedExpenses + monthlyPayment) / avgIncome) * 100 : 100;
        const freeCashFlow = avgIncome - avgFixedExpenses - monthlyPayment;
        const amountRatio = requestedAmount > 0 ? suggestedLoanAmount / requestedAmount : 1;
        const approvalProbabilityAfter = calculateApprovalProbability(dsrAfter, liquidityMonths, amountRatio, term);
        const termPreferencePenalty = term === 24 ? 0 : term === 36 ? 1 : term === 48 ? 2 : term === 60 ? 3 : term === 72 ? 4 : 5;
        const amountReductionPenalty = Math.round((1 - amountRatio) * 100) * 3;
        const downPaymentPenalty = requestedAmount > 0 ? Math.round((downPayment / requestedAmount) * 100) * 2 : 0;
        const priorityScore = approvalProbabilityAfter - termPreferencePenalty - amountReductionPenalty - downPaymentPenalty;

        if (dsrAfter <= 100 && freeCashFlow > 0 && liquidityMonths >= 2) {
          candidates.push({
            suggestedLoanAmount,
            term,
            monthlyPayment,
            dsrBefore,
            dsrAfter,
            approvalProbabilityBefore: beforeProbability,
            approvalProbabilityAfter,
            downPayment,
            priorityScore
          });
        }
      }
    }

    if (candidates.length === 0) {
      return Response.json({
        success: true,
        approved: false,
        decision: {
          status: 'DECLINE',
          suggestedLoanAmount: 0,
          term: 0,
          monthlyPayment: 0,
          dsrBefore: Math.round(dsrBefore),
          dsrAfter: null,
          approvalProbabilityBefore: beforeProbability,
          approvalProbabilityAfter: 0
        }
      });
    }

    candidates.sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      if (b.approvalProbabilityAfter !== a.approvalProbabilityAfter) return b.approvalProbabilityAfter - a.approvalProbabilityAfter;
      if (b.term !== a.term) return b.term - a.term;
      return b.suggestedLoanAmount - a.suggestedLoanAmount;
    });

    const best = candidates[0];

    return Response.json({
      success: true,
      approved: true,
      decision: {
        status: 'APPROVE',
        suggestedLoanAmount: Math.round(best.suggestedLoanAmount),
        term: best.term,
        monthlyPayment: Math.round(best.monthlyPayment),
        dsrBefore: Math.round(best.dsrBefore),
        dsrAfter: Math.round(best.dsrAfter),
        approvalProbabilityBefore: best.approvalProbabilityBefore,
        approvalProbabilityAfter: best.approvalProbabilityAfter
      }
    });
  } catch (error) {
    console.error('DealRescuerEngine Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});