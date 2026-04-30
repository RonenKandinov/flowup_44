import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Cash-Flow Intelligence Engine ─────────────────────────────────────────────
// Builds a granular profile of the applicant's REAL repayment capacity by
// analyzing OpenFinanceTransaction history rather than relying on aggregated
// "income vs expenses" totals.
//
// Output is consumed by:
//   • dealRescuerEngine — to refine DSR base (uses recurring net surplus)
//   • InsightsAgent / Dashboard — to surface stability anchors and XAI factors
//
// This is a server-side function because it needs access to the user's
// OpenFinanceTransaction entity records via service role.
// ──────────────────────────────────────────────────────────────────────────────

const STABILITY_KEYWORDS = {
  rent: ['שכר דירה', 'שכירות', 'rent', 'משכנתא', 'mortgage'],
  utilities: ['חשמל', 'מים', 'גז', 'ארנונה', 'אינטרנט', 'סלולר', 'electric', 'water'],
  insurance: ['ביטוח', 'insurance', 'בריאות', 'חיים', 'דירה'],
  savings: ['חיסכון', 'הפקדה', 'קרן השתלמות', 'קופת גמל', 'פיקדון', 'savings', 'deposit', 'pepper invest'],
  investments: ['ניירות ערך', 'השקעות', 'מניות', 'etf', 'investment', 'trading'],
  overdraft: ['עו"ש', 'משיכת יתר', 'חריגה', 'overdraft'],
  salary: ['משכורת', 'שכר', 'salary', 'payroll', 'wage']
};

// ─── Discretionary spending classification ────────────────────────────────────
// Three tiers — each represents how realistically a borrower can cut this category.
//   • EASY   → subscriptions, streaming, gym, dining-out, entertainment
//   • MEDIUM → restaurants, leisure, shopping, cafés
//   • HARD   → fuel, transport, healthcare-lite, school supplies, basic household
// Anything else falls back to MEDIUM as a safe default.
const DISCRETIONARY_KEYWORDS = {
  easy: [
    'netflix', 'spotify', 'disney', 'apple music', 'youtube', 'amazon prime',
    'subscription', 'מנוי', 'מינוי', 'חדר כושר', 'gym', 'streaming',
    'אפל', 'גוגל one', 'icloud', 'cellcom tv', 'yes', 'partner tv', 'hot'
  ],
  medium: [
    'מסעדה', 'restaurant', 'café', 'קפה', 'בר', 'pub', 'בילוי',
    'shopping', 'קניות', 'בגדים', 'fashion', 'zara', 'h&m', 'castro',
    'wolt', 'ten bis', '10bis', 'משלוחים', 'glovo', 'cibus', 'leisure'
  ],
  hard: [
    'דלק', 'fuel', 'sonol', 'paz', 'delek', 'תחבורה', 'רכבת', 'אוטובוס',
    'transport', 'rav kav', 'רב-קו', 'gett', 'uber', 'taxi', 'מונית',
    'בית מרקחת', 'pharmacy', 'super-pharm', 'סופרפארם', 'תרופות',
    'ציוד בית ספר', 'ספרי לימוד', 'גן', 'קייטנה'
  ]
};

const classifyDiscretionaryTier = (description) => {
  const desc = String(description || '').toLowerCase();
  if (DISCRETIONARY_KEYWORDS.easy.some(kw => desc.includes(kw.toLowerCase()))) return 'easy';
  if (DISCRETIONARY_KEYWORDS.hard.some(kw => desc.includes(kw.toLowerCase()))) return 'hard';
  if (DISCRETIONARY_KEYWORDS.medium.some(kw => desc.includes(kw.toLowerCase()))) return 'medium';
  return 'medium'; // safe default
};

const matchKeyword = (description, list) => {
  const desc = String(description || '').toLowerCase();
  return list.some(kw => desc.includes(kw.toLowerCase()));
};

// ─── Recurring transaction detection ──────────────────────────────────────────
// A transaction is "recurring" if a similar amount (±15%) appears in ≥2 of the
// last 3 calendar months under the same description signature.
const detectRecurring = (transactions) => {
  const byMonth = {};
  for (const tx of transactions) {
    const d = new Date(tx.date);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(tx);
  }

  const months = Object.keys(byMonth).sort().slice(-3); // last 3 months
  if (months.length < 2) return { recurring: [], oneOff: transactions };

  // Group transactions by description signature (first 3 words, lowercased)
  const sigOf = (desc) => String(desc || '')
    .toLowerCase()
    .split(/\s+/)
    .slice(0, 3)
    .join(' ')
    .trim() || 'unknown';

  const sigMap = {};
  for (const m of months) {
    for (const tx of byMonth[m]) {
      const sig = sigOf(tx.description);
      if (!sigMap[sig]) sigMap[sig] = [];
      sigMap[sig].push({ ...tx, month: m });
    }
  }

  const recurring = [];
  const recurringIds = new Set();

  for (const [sig, txs] of Object.entries(sigMap)) {
    const monthsSeen = new Set(txs.map(t => t.month));
    if (monthsSeen.size < 2) continue;

    // Check amount stability: avg, then std-dev as % of avg
    const amounts = txs.map(t => Math.abs(Number(t.amount) || 0));
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    if (avg < 50) continue; // ignore tiny noise
    const variance = amounts.reduce((s, a) => s + (a - avg) ** 2, 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    const variability = avg > 0 ? stdDev / avg : 1;
    if (variability > 0.25) continue; // not stable enough

    const sample = txs[0];
    const isIncome = (Number(sample.amount) || 0) > 0;

    recurring.push({
      signature: sig,
      description: sample.description,
      avgAmount: Math.round(avg * (isIncome ? 1 : -1)),
      monthsSeen: monthsSeen.size,
      occurrences: txs.length,
      type: isIncome ? 'income' : 'expense'
    });

    txs.forEach(t => recurringIds.add(t.transaction_id || `${t.date}-${t.amount}-${t.description}`));
  }

  const oneOff = transactions.filter(t => {
    const id = t.transaction_id || `${t.date}-${t.amount}-${t.description}`;
    return !recurringIds.has(id);
  });

  return { recurring, oneOff };
};

// ─── Stability anchors ────────────────────────────────────────────────────────
// Positive signals that indicate responsible financial behavior, even when
// raw numerics look borderline.
const computeStabilityAnchors = (transactions, recurring) => {
  const anchors = [];
  const flags = [];

  // 1. Recurring rent/mortgage paid on time (no big gaps)
  const housingRecurring = recurring.filter(r =>
    r.type === 'expense' && matchKeyword(r.description, STABILITY_KEYWORDS.rent)
  );
  if (housingRecurring.length > 0) {
    anchors.push({
      key: 'housing_consistent',
      label: 'תשלום דיור עקבי',
      detail: `זוהה תשלום דיור חוזר של כ-₪${Math.abs(housingRecurring[0].avgAmount).toLocaleString('he-IL')} בכל חודש`,
      weight: 0.15
    });
  }

  // 2. Recurring utilities (3+ different categories = mature household)
  const utilCats = new Set();
  for (const r of recurring) {
    if (r.type === 'expense' && matchKeyword(r.description, STABILITY_KEYWORDS.utilities)) {
      utilCats.add(r.signature);
    }
  }
  if (utilCats.size >= 2) {
    anchors.push({
      key: 'utilities_paid',
      label: 'חשבונות חיוניים משולמים',
      detail: `${utilCats.size} חשבונות שוטפים (חשמל/מים/אינטרנט) משולמים באופן קבוע`,
      weight: 0.10
    });
  }

  // 3. Recurring savings/investments — strongest positive signal
  const savingsRecurring = recurring.filter(r =>
    r.type === 'expense' && (
      matchKeyword(r.description, STABILITY_KEYWORDS.savings) ||
      matchKeyword(r.description, STABILITY_KEYWORDS.investments)
    )
  );
  if (savingsRecurring.length > 0) {
    const monthlySavings = savingsRecurring.reduce((s, r) => s + Math.abs(r.avgAmount), 0);
    anchors.push({
      key: 'recurring_savings',
      label: 'חיסכון/השקעה חודשיים קבועים',
      detail: `מפריש כ-₪${monthlySavings.toLocaleString('he-IL')} בחודש לחיסכון או השקעה`,
      weight: 0.20
    });
  }

  // 4. Stable salary detection
  const salaryRecurring = recurring.filter(r =>
    r.type === 'income' && matchKeyword(r.description, STABILITY_KEYWORDS.salary)
  );
  if (salaryRecurring.length > 0) {
    const monthlyNetIncome = salaryRecurring.reduce((s, r) => s + r.avgAmount, 0);
    anchors.push({
      key: 'stable_salary',
      label: 'משכורת יציבה',
      detail: `הכנסה חודשית קבועה של כ-₪${monthlyNetIncome.toLocaleString('he-IL')}`,
      weight: 0.20
    });
  }

  // 5. NEGATIVE: Overdraft activity → flag, not anchor
  const overdraftHits = transactions.filter(t =>
    matchKeyword(t.description, STABILITY_KEYWORDS.overdraft)
  );
  if (overdraftHits.length >= 2) {
    flags.push({
      key: 'overdraft_pattern',
      label: 'דפוס משיכות יתר',
      detail: `זוהו ${overdraftHits.length} אירועי משיכת יתר/חריגה ב-90 הימים האחרונים`,
      weight: -0.15
    });
  }

  return { anchors, flags };
};

// ─── Income classification ────────────────────────────────────────────────────
const classifyIncome = (transactions, recurring) => {
  const recurringIncome = recurring
    .filter(r => r.type === 'income')
    .reduce((s, r) => s + r.avgAmount, 0);

  // Variable income: any positive transaction not classified as recurring
  // and not a transfer/refund (best-effort filter).
  const allIncomeTxs = transactions.filter(t => (Number(t.amount) || 0) > 0);
  const totalIncome = allIncomeTxs.reduce((s, t) => s + Number(t.amount), 0);

  // Average over the months we have data for. We use ceil() so a span of e.g.
  // 70 days counts as ~3 months — prevents artificially inflated monthly averages
  // when the data window covers partial months (which is the common case).
  const dates = allIncomeTxs.map(t => new Date(t.date)).filter(d => !isNaN(d));
  if (dates.length === 0) {
    return { recurring: 0, variable: 0, total: 0, monthlyAverage: 0 };
  }
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  const rawSpanDays = Math.max(1, (maxDate - minDate) / (1000 * 60 * 60 * 24));
  const monthsSpan = Math.max(1, Math.ceil(rawSpanDays / 30));
  const monthlyAverage = totalIncome / monthsSpan;

  return {
    recurring: Math.round(recurringIncome),
    variable: Math.max(0, Math.round(monthlyAverage - recurringIncome)),
    total: Math.round(totalIncome),
    monthlyAverage: Math.round(monthlyAverage)
  };
};

// ─── Expense classification ───────────────────────────────────────────────────
// Now produces a 3-tier discretionary breakdown so the dealRescuerEngine can
// apply DIFFERENTIATED β coefficients per category (easy/medium/hard).
const classifyExpenses = (transactions, recurring) => {
  const fixed = recurring
    .filter(r => r.type === 'expense')
    .reduce((s, r) => s + Math.abs(r.avgAmount), 0);

  // Build a set of recurring transaction signatures so we can exclude them
  // from the discretionary tiering below.
  const sigOf = (desc) => String(desc || '').toLowerCase().split(/\s+/).slice(0, 3).join(' ').trim() || 'unknown';
  const recurringSigs = new Set(
    recurring.filter(r => r.type === 'expense').map(r => r.signature)
  );

  const allExpenseTxs = transactions.filter(t => (Number(t.amount) || 0) < 0);
  const totalExpense = allExpenseTxs.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  const dates = allExpenseTxs.map(t => new Date(t.date)).filter(d => !isNaN(d));
  let monthsSpan = 1;
  if (dates.length > 0) {
    const rawSpanDays = Math.max(1, (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24));
    monthsSpan = Math.max(1, Math.ceil(rawSpanDays / 30));
  }
  const monthlyAverage = totalExpense / monthsSpan;

  // Tier the non-recurring (discretionary) transactions into easy/medium/hard
  const tierTotals = { easy: 0, medium: 0, hard: 0 };
  for (const tx of allExpenseTxs) {
    if (recurringSigs.has(sigOf(tx.description))) continue; // already counted in fixed
    const tier = classifyDiscretionaryTier(tx.description);
    tierTotals[tier] += Math.abs(Number(tx.amount) || 0);
  }
  // Convert totals → monthly averages
  const tierMonthly = {
    easy: Math.round(tierTotals.easy / monthsSpan),
    medium: Math.round(tierTotals.medium / monthsSpan),
    hard: Math.round(tierTotals.hard / monthsSpan)
  };
  const discretionary = tierMonthly.easy + tierMonthly.medium + tierMonthly.hard;

  return {
    fixed: Math.round(fixed),
    discretionary: Math.round(discretionary),
    discretionaryBreakdown: tierMonthly,
    monthlyAverage: Math.round(monthlyAverage)
  };
};

// ─── Confidence layer ─────────────────────────────────────────────────────────
// Quality-of-data score (0..1). Used downstream to scale capacity conservatively
// when we don't have enough evidence to trust the projection.
//   - more transactions  → more confident
//   - longer time window → more confident
//   - lower variance     → more confident
const computeConfidence = (transactions, income) => {
  if (!transactions || transactions.length === 0) {
    return { score: 0, dataPoints: 0, monthsCovered: 0, incomeVariance: 1 };
  }
  const dates = transactions.map(t => new Date(t.date)).filter(d => !isNaN(d));
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  const monthsCovered = Math.max(0.1, ((maxDate - minDate) / (1000 * 60 * 60 * 24 * 30)));

  // Volume sub-score: 100+ tx is "full trust", 30 tx → 0.6, 10 tx → 0.3
  const volumeScore = Math.min(1, transactions.length / 100);
  // Span sub-score: 3+ months → 1.0, 2 months → 0.7, 1 month → 0.35
  const spanScore = Math.min(1, monthsCovered / 3);

  // Income variance sub-score
  const incomeAmounts = transactions
    .filter(t => (Number(t.amount) || 0) > 0)
    .map(t => Number(t.amount));
  let incomeVariance = 0;
  let varianceScore = 1;
  if (incomeAmounts.length >= 3) {
    const avg = incomeAmounts.reduce((a, b) => a + b, 0) / incomeAmounts.length;
    if (avg > 0) {
      const v = incomeAmounts.reduce((s, a) => s + (a - avg) ** 2, 0) / incomeAmounts.length;
      incomeVariance = Math.sqrt(v) / avg; // coefficient of variation
      // CV<0.2 → 1.0 ; CV>0.6 → 0.3
      varianceScore = Math.max(0.3, 1 - (incomeVariance - 0.2) * 1.5);
      varianceScore = Math.min(1, varianceScore);
    }
  }

  const score = Number((volumeScore * 0.4 + spanScore * 0.4 + varianceScore * 0.2).toFixed(2));
  return {
    score,
    dataPoints: transactions.length,
    monthsCovered: Number(monthsCovered.toFixed(1)),
    incomeVariance: Number(incomeVariance.toFixed(2)),
    components: {
      volume: Number(volumeScore.toFixed(2)),
      span: Number(spanScore.toFixed(2)),
      variance: Number(varianceScore.toFixed(2))
    }
  };
};

// ─── 6-month liquidity forecast ───────────────────────────────────────────────
// Projects the running balance forward using:
//   net monthly surplus = recurring income − recurring expenses (no discretionary uplift,
//   we want a conservative floor)
// Returns months until projected balance dips below 0 (= liquidity runway).
const forecastLiquidityRunway = ({ currentBalance, income, expenses }) => {
  const netRecurring = income.recurring - expenses.fixed;
  const netRealistic = income.monthlyAverage - expenses.monthlyAverage;

  // Worst-case: if discretionary spending continues at current pace
  const worstCaseMonthly = netRealistic;
  // Best-case: if applicant tightens to recurring-only
  const bestCaseMonthly = netRecurring;

  // Runway under worst case
  let worstRunwayMonths = 999;
  if (worstCaseMonthly < 0 && currentBalance > 0) {
    worstRunwayMonths = Math.floor(currentBalance / Math.abs(worstCaseMonthly));
  } else if (worstCaseMonthly >= 0) {
    worstRunwayMonths = 999; // sustainable
  }

  // 6-month projection (monthly snapshots) — uses worst case for prudence
  const monthly = [];
  let runningBalance = currentBalance;
  for (let i = 1; i <= 6; i++) {
    runningBalance += worstCaseMonthly;
    monthly.push({
      month: i,
      projectedBalance: Math.round(runningBalance),
      stress: runningBalance < 0 ? 'critical' : runningBalance < (expenses.fixed * 0.5) ? 'tight' : 'comfortable'
    });
  }

  return {
    netMonthlyRecurring: Math.round(netRecurring),
    netMonthlyRealistic: Math.round(netRealistic),
    worstCaseRunwayMonths: worstRunwayMonths >= 999 ? null : worstRunwayMonths,
    sixMonthProjection: monthly,
    sustainable: worstCaseMonthly >= 0
  };
};

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const user = await base44.auth.me().catch(() => null);

    // Two input modes:
    //   1. Pull from OpenFinanceTransaction entity (live mode)
    //   2. Accept inline transactions array (testing / CSV mode)
    let transactions = Array.isArray(body?.transactions) ? body.transactions : null;
    let currentBalance = Number(body?.currentBalance ?? 0);

    if (!transactions) {
      if (!user) {
        return Response.json({ error: 'Unauthorized — provide transactions inline or authenticate' }, { status: 401 });
      }
      try {
        // Pull last 90 days from OpenFinanceTransaction
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 90);
        const allTx = await base44.asServiceRole.entities.OpenFinanceTransaction.list('-date', 1000);
        transactions = allTx
          .filter(t => new Date(t.date) >= cutoff)
          .map(t => ({
            transaction_id: t.transaction_id,
            date: t.date,
            amount: Number(t.amount) || 0,
            description: t.description || '',
            category: t.category || ''
          }));

        // Pull current balance from accounts
        const accounts = await base44.asServiceRole.entities.OpenFinanceAccount.list();
        currentBalance = accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
      } catch (e) {
        console.warn('cashFlowIntelligence: could not load OpenFinance entities', e?.message);
        transactions = [];
      }
    }

    if (!transactions || transactions.length === 0) {
      return Response.json({
        success: false,
        error: 'No transactions available for analysis',
        cashFlowProfile: null
      }, { status: 200 });
    }

    // ── Stage 1: detect recurring vs one-off ──
    const { recurring } = detectRecurring(transactions);

    // ── Stage 2: classify income & expenses ──
    const income = classifyIncome(transactions, recurring);
    const expenses = classifyExpenses(transactions, recurring);

    // ── Stage 3: stability anchors & risk flags ──
    const { anchors, flags } = computeStabilityAnchors(transactions, recurring);

    // ── Stage 4: liquidity forecast ──
    const liquidityForecast = forecastLiquidityRunway({ currentBalance, income, expenses });

    // ── Stage 5: derive a cash-flow trust score (0..1) ──
    // Used downstream as an additive modifier for the DSR ceiling.
    const anchorWeight = anchors.reduce((s, a) => s + a.weight, 0);
    const flagWeight = flags.reduce((s, f) => s + f.weight, 0);
    const baseTrust = Math.max(0, Math.min(1, anchorWeight + flagWeight + 0.3));
    const cashFlowTrustScore = Number(baseTrust.toFixed(2));

    // ── Stage 6: real repayment capacity (₪/month) ──
    // This is the key number that dealRescuerEngine should use as DSR denominator
    // instead of (income − expenses − fixed) — it accounts for the REAL pattern.
    const realRepaymentCapacity = Math.max(0, income.recurring - expenses.fixed);

    // ── Stage 7: confidence + volatility ──
    const confidence = computeConfidence(transactions, income);
    // High volatility = income CV above 0.35. Surface a flag downstream so the
    // dealRescuerEngine penalises β accordingly.
    const incomeVolatilityHigh = confidence.incomeVariance > 0.35;
    if (incomeVolatilityHigh) {
      flags.push({
        key: 'income_volatility_high',
        label: 'תנודתיות הכנסה גבוהה',
        detail: `מקדם שונות הכנסה ${(confidence.incomeVariance * 100).toFixed(0)}% — מעל הסף של 35%`,
        weight: -0.10
      });
    }

    return Response.json({
      success: true,
      cashFlowProfile: {
        currentBalance: Math.round(currentBalance),
        income,
        expenses,
        recurringTransactions: recurring.length,
        stabilityAnchors: anchors,
        riskFlags: flags,
        liquidityForecast,
        cashFlowTrustScore,
        realRepaymentCapacity,
        confidence,
        incomeVolatility: {
          coefficient: confidence.incomeVariance,
          isHigh: incomeVolatilityHigh
        },
        dataPoints: transactions.length,
        analyzedPeriodDays: 90
      }
    });
  } catch (error) {
    console.error('cashFlowIntelligence error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});