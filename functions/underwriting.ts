import { createClientFromRequest } from 'npm:@base44/sdk@0.8.11';
import { startOfMonth, subMonths, parseISO, differenceInDays, isSameDay } from 'npm:date-fns@3.6.0';
import * as _ from 'npm:lodash@4.17.21';

const SCORING_WEIGHTS = {
  CASHFLOW: 0.35,
  STABILITY: 0.25,
  VOLATILITY: 0.20,
  DEBT_RATIO: 0.20
};

const RIGID_KEYWORDS = ['loan', 'mortgage', 'rent', 'insurance', 'subscription', 'netflix', 'spotify', 'gym', 'internet', 'utilities'];

export default Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lookbackMonths = 3 } = await req.json().catch(() => ({}));

    // 1. Fetch Data
    const connections = await base44.entities.OpenFinanceConnection.filter({ user_id: user.id, status: 'ACTIVE' });
    
    if (connections.length === 0) {
      return Response.json({
        status: "insufficient_data",
        reason: "No active bank connections found.",
        score: null
      });
    }

    const connectionIds = connections.map(c => c.connection_id);
    // Fetch transactions for all connections (simulated "in" query by fetching all and filtering, or multiple requests. 
    // Since filter doesn't support "in", we loop or fetch all if volume is low. 
    // Best practice: Fetch by connection if possible. Here we assume we can fetch by user's connections)
    
    let allTransactions = [];
    for (const connId of connectionIds) {
      const txs = await base44.entities.OpenFinanceTransaction.filter({ connection_id: connId }, '-date', 1000);
      allTransactions = allTransactions.concat(txs);
    }

    if (allTransactions.length < 10) {
      return Response.json({
        status: "insufficient_data",
        reason: "Insufficient transaction history for analysis.",
        score: null
      });
    }

    // 2. Normalize & Classify
    const analysis = analyzeTransactions(allTransactions, lookbackMonths);
    
    // 3. Generate FlowScore
    const score = calculateFlowScore(analysis);

    return Response.json({
      status: "success",
      timestamp: new Date().toISOString(),
      metrics: analysis,
      underwriting: {
        flowScore: score,
        riskLevel: getRiskLevel(score),
        maxApprovedCredit: calculateMaxCredit(analysis, score),
        reasoning: generateReasoning(analysis, score)
      }
    });

  } catch (error) {
    console.error("Underwriting Engine Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function analyzeTransactions(transactions, months) {
  const now = new Date();
  const startDate = subMonths(now, months);
  
  const validTxs = transactions.filter(t => new Date(t.date) >= startDate);
  
  const incomeTxs = validTxs.filter(t => t.amount > 0);
  const expenseTxs = validTxs.filter(t => t.amount < 0);

  const totalIncome = _.sumBy(incomeTxs, 'amount');
  const totalExpenses = Math.abs(_.sumBy(expenseTxs, 'amount'));
  
  // Detect Recurring Income
  const recurringIncome = detectRecurringPatterns(incomeTxs);
  
  // Identify Rigid Obligations
  const rigidExpenses = expenseTxs.filter(t => 
    RIGID_KEYWORDS.some(kw => t.description?.toLowerCase().includes(kw)) ||
    t.category === 'housing' || t.category === 'loans'
  );
  
  const totalRigid = Math.abs(_.sumBy(rigidExpenses, 'amount'));
  const monthlyAverageIncome = totalIncome / months;
  const monthlyAverageExpense = totalExpenses / months;

  return {
    period_months: months,
    total_income: totalIncome,
    total_expenses: totalExpenses,
    net_cashflow: totalIncome - totalExpenses,
    savings_rate: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) : 0,
    monthly_average_income: monthlyAverageIncome,
    monthly_average_expense: monthlyAverageExpense,
    disposable_income: monthlyAverageIncome - monthlyAverageExpense,
    rigid_obligations_ratio: totalIncome > 0 ? (totalRigid / totalIncome) : 1,
    recurring_income_sources: recurringIncome
  };
}

function detectRecurringPatterns(transactions) {
  // Simple heuristic: Group by description (normalized), check count > 1 per month approx
  const grouped = _.groupBy(transactions, t => t.description?.trim().toLowerCase().slice(0, 10)); // First 10 chars as key
  
  const recurring = [];
  
  for (const [key, txs] of Object.entries(grouped)) {
    if (txs.length >= 2) { // At least 2 occurrences
      const avgAmount = _.meanBy(txs, 'amount');
      const stdDev = calculateStdDev(txs.map(t => t.amount));
      
      // If amount is relatively stable (stdDev < 20% of avg)
      if (stdDev / avgAmount < 0.2) {
        recurring.push({
          source: key,
          average_amount: avgAmount,
          frequency: txs.length,
          confidence: 'high'
        });
      }
    }
  }
  return recurring;
}

function calculateFlowScore(metrics) {
  let score = 600; // Base Score

  // 1. Cashflow Impact (+/- 100)
  if (metrics.net_cashflow > 0) score += 50;
  if (metrics.savings_rate > 0.15) score += 50;
  if (metrics.net_cashflow < 0) score -= 50;

  // 2. Stability Impact
  if (metrics.recurring_income_sources.length > 0) score += 40;
  
  // 3. Debt/Rigid Burden
  if (metrics.rigid_obligations_ratio > 0.5) score -= 50;
  if (metrics.rigid_obligations_ratio < 0.3) score += 30;

  // 4. Caps
  return Math.min(850, Math.max(300, Math.round(score)));
}

function getRiskLevel(score) {
  if (score >= 750) return "LOW";
  if (score >= 650) return "MEDIUM";
  return "HIGH";
}

function calculateMaxCredit(metrics, score) {
  if (score < 600) return 0;
  // Conservative: 3x monthly disposable income
  return Math.max(0, Math.round(metrics.disposable_income * 3));
}

function generateReasoning(metrics, score) {
  const reasons = [];
  if (metrics.net_cashflow > 0) reasons.push("Positive net cashflow identified.");
  else reasons.push("Negative net cashflow detected.");
  
  if (metrics.recurring_income_sources.length > 0) reasons.push(`Found ${metrics.recurring_income_sources.length} recurring income sources.`);
  
  if (metrics.rigid_obligations_ratio > 0.5) reasons.push("High rigid obligation ratio.");
  
  return reasons;
}

function calculateStdDev(array) {
  const n = array.length;
  if (n === 0) return 0;
  const mean = _.mean(array);
  return Math.sqrt(_.sum(array.map(x => Math.pow(x - mean, 2))) / n);
}