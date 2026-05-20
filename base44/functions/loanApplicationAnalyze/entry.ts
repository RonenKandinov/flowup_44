// Unified loan application underwriting engine.
//
// Routes by loan_type:
//   • b2b_financing   → reverse_factoring | revenue_based_financing |
//                       purchase_order_financing | working_capital |
//                       merchant_cash_advance
//   • check_discount  → behavioral analysis of third-party (כותב הצ'ק)
//   • personal_loan   → consumer underwriting via dealRescuerEngine
//
// All paths produce the SAME response shape:
//   { success, decision: { status, rate, max_amount, reason, product_specific } }
//
// This replaces b2bFinancingAnalyze + checkDiscountAnalyze.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Pattern dictionaries ────────────────────────────────────────────────
const BOUNCE_PATTERNS = [
  'אכ"מ', 'אכמ', 'אין כיסוי', 'צ\'ק מוחזר', 'צ\'ק חוזר',
  'חזרת צ\'ק', 'החזרת צ\'ק', 'מוחזר', 'returned check', 'nsf'
];
const DEPOSIT_PATTERNS = ["הפקדת צ'ק", "הפקדת שיק", "check deposit", "צ'ק"];
const ACQUIRER_PATTERNS = ['ישראכרט', 'isracard', 'כאל', 'cal', 'מקס', 'max', 'leumi card', 'shva', 'שב"א'];

const matchesAny = (text = '', patterns) => {
  const t = String(text).toLowerCase();
  return patterns.some(p => t.includes(p.toLowerCase()));
};

const monthKey = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
};

const computeMRR = (transactions) => {
  const byMonth = {};
  transactions.filter(t => t.amount > 0).forEach(t => {
    const k = monthKey(t.date);
    byMonth[k] = (byMonth[k] || 0) + t.amount;
  });
  const months = Object.keys(byMonth).sort();
  const values = months.map(m => byMonth[m]);
  const mrr = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
  let momGrowth = 0;
  if (values.length >= 2) {
    const recent = values.slice(-3).reduce((s, v) => s + v, 0) / Math.min(3, values.length);
    const prior = values.slice(0, -3).reduce((s, v) => s + v, 0) / Math.max(1, values.length - 3);
    momGrowth = prior > 0 ? ((recent - prior) / prior) * 100 : 0;
  }
  return { mrr, momGrowth };
};

// ── CHECK DISCOUNT branch ───────────────────────────────────────────────
async function analyzeCheckDiscount({ base44, requested_amount, details, metrics, recent }) {
  const { third_party_tax_id = '', third_party_name = '' } = details || {};
  const idKey = third_party_tax_id.trim();
  const nameKey = third_party_name.trim().toLowerCase();

  const thirdPartyHits = recent.filter(t => {
    const d = (t.description || '').toLowerCase();
    return (idKey && d.includes(idKey)) || (nameKey && d.includes(nameKey));
  });

  const priorDeposits = thirdPartyHits.filter(t =>
    t.amount > 0 && matchesAny(t.description, DEPOSIT_PATTERNS)
  );
  const bounces = recent.filter(t => matchesAny(t.description, BOUNCE_PATTERNS));
  const thirdPartyBounces = thirdPartyHits.filter(t => matchesAny(t.description, BOUNCE_PATTERNS));

  const avgPriorAmount = priorDeposits.length
    ? priorDeposits.reduce((s, t) => s + Math.abs(t.amount), 0) / priorDeposits.length
    : 0;

  let status = 'approved';
  let reason = '';
  let rate = 2.5;

  if (thirdPartyBounces.length > 0) {
    status = 'rejected';
    reason = `נמצאו ${thirdPartyBounces.length} צ'קים חוזרים מצד ג' זה ב-12 החודשים האחרונים.`;
  } else if (priorDeposits.length === 0 && idKey) {
    status = 'review';
    reason = 'אין היסטוריית הפקדות קודמות מצד ג׳ זה — נדרשת בדיקה ידנית.';
    rate = 4.0;
  } else if (avgPriorAmount > 0 && requested_amount > avgPriorAmount * 3) {
    status = 'adjusted';
    reason = `סכום הצ'ק (₪${requested_amount.toLocaleString()}) חורג משמעותית מההיסטוריה (ממוצע ₪${Math.round(avgPriorAmount).toLocaleString()}) — אושר בעמלה גבוהה.`;
    rate = 5.0;
  } else if (priorDeposits.length >= 3) {
    reason = `אושר: ${priorDeposits.length} הפקדות תקינות, ללא חזרות.`;
  } else {
    reason = 'היסטוריה נקייה, סכום סביר.';
  }

  if (metrics?.dti > 70 && status === 'approved') {
    status = 'adjusted';
    rate += 1.5;
    reason += ' תזרים העסק המבקש חלש — עמלת סיכון נוספת.';
  }

  return {
    status,
    reason,
    rate,
    max_amount: status === 'rejected' ? 0 : requested_amount,
    product_specific: {
      prior_deposits: priorDeposits.length,
      total_prior_amount: Math.round(priorDeposits.reduce((s, t) => s + t.amount, 0)),
      avg_prior_amount: Math.round(avgPriorAmount),
      third_party_bounces: thirdPartyBounces.length,
      total_account_bounces: bounces.length
    }
  };
}

// ── B2B FINANCING branch ────────────────────────────────────────────────
function analyzeB2BFinancing({ product_type, requested_amount, details, metrics, recent }) {
  let status = 'approved';
  let rate = 9;
  let maxAmount = requested_amount;
  let reason = '';
  const extra = {};

  if (product_type === 'reverse_factoring') {
    const monthlyOutflow = recent.filter(t => t.amount < 0)
      .reduce((s, t) => s + Math.abs(t.amount), 0) / 12;
    extra.monthly_outflow = Math.round(monthlyOutflow);
    if (!metrics || metrics.dti > 50) {
      status = 'review'; reason = 'יציבות תאגידית של הקונה דורשת בדיקה ידנית.';
    } else {
      reason = 'הקונה מציג יציבות תזרימית — אושר לתשלום מרוכז לספקים.';
    }
  } else if (product_type === 'revenue_based_financing') {
    const { mrr, momGrowth } = computeMRR(recent);
    extra.mrr = Math.round(mrr);
    extra.mom_growth = Number(momGrowth.toFixed(1));
    if (mrr < 20000) {
      status = 'rejected'; reason = 'MRR נמוך מ-20,000 ₪ — לא מתאים ל-RBF.';
    } else {
      maxAmount = Math.min(requested_amount, mrr * 4);
      const repaymentPct = Math.min(15, Math.max(3, (requested_amount / (mrr * 12)) * 100));
      extra.revenue_share_pct = Number(repaymentPct.toFixed(1));
      reason = `MRR יציב של ₪${Math.round(mrr).toLocaleString()} — מומלץ ${repaymentPct.toFixed(1)}% מהכנסות עד החזר מלא.`;
    }
  } else if (product_type === 'purchase_order_financing') {
    const buyerName = (details?.buyer_name || '').toLowerCase();
    const buyerInflows = buyerName
      ? recent.filter(t => t.amount > 0 && (t.description || '').toLowerCase().includes(buyerName))
      : [];
    const fxOutflows = recent.filter(t =>
      t.amount < 0 && /swift|מט"ח|העברה לחו"ל|wire/i.test(t.description || '')
    );
    extra.prior_buyer_payments = buyerInflows.length;
    extra.fx_outflows = fxOutflows.length;

    if (buyerInflows.length === 0) {
      status = 'review'; reason = 'אין היסטוריית תשלומים מהקונה — נדרשת בדיקה ידנית.';
    } else if (fxOutflows.length < 2) {
      status = 'adjusted'; rate = 11;
      reason = 'אין מספיק היסטוריה תפעולית מול ספקי חו"ל — עמלת סיכון מוגדלת.';
    } else {
      reason = `נמצאו ${buyerInflows.length} תשלומים קודמים מהקונה — יכולת תפעולית מוכחת.`;
    }
  } else if (product_type === 'working_capital') {
    if (!metrics) {
      status = 'review'; reason = 'נתוני תזרים לא זמינים — נדרשת חיבור Open Finance.';
      maxAmount = 0;
    } else {
      const monthlyNet = Math.max(0, (metrics.totalIncome || 0) - (metrics.totalExpenses || 0));
      const liquid = Math.max(0, metrics.liquidAssets || 0);
      const capacityCap = Math.max(monthlyNet * 3, liquid * 2);
      extra.monthly_net_cash_flow = Math.round(monthlyNet);
      extra.capacity_cap = Math.round(capacityCap);

      if (metrics.dti > 70) {
        status = 'rejected'; rate = 0; maxAmount = 0;
        reason = `DSR גבוה מדי (${metrics.dti}%) — אין יכולת החזר נוספת.`;
      } else if (capacityCap < 1000) {
        status = 'rejected'; rate = 0; maxAmount = 0;
        reason = `יכולת תזרימית חודשית נמוכה מדי — לא ניתן לאשר הון חוזר.`;
      } else if (requested_amount > capacityCap) {
        status = 'adjusted';
        maxAmount = Math.min(requested_amount, capacityCap);
        rate = metrics.dti > 55 ? 13 : 11;
        reason = `הסכום המבוקש חורג מהיכולת — אושר עד ₪${Math.round(maxAmount).toLocaleString()} בריבית ${rate}%.`;
      } else if (metrics.dti > 55) {
        status = 'adjusted'; rate = 13;
        maxAmount = Math.min(requested_amount, capacityCap);
        reason = `תזרים לחוץ — אושר ₪${Math.round(maxAmount).toLocaleString()} בריבית גבוהה לתקופה קצרה.`;
      } else {
        maxAmount = Math.min(requested_amount, capacityCap);
        reason = `תזרים יציב — מאושר ₪${Math.round(maxAmount).toLocaleString()}.`;
      }
    }
  } else if (product_type === 'merchant_cash_advance') {
    const acquirerDeposits = recent.filter(t => t.amount > 0 && matchesAny(t.description, ACQUIRER_PATTERNS));
    const monthly = {};
    acquirerDeposits.forEach(t => {
      const k = monthKey(t.date);
      monthly[k] = (monthly[k] || 0) + t.amount;
    });
    const monthlyValues = Object.values(monthly);
    const avgMonthly = monthlyValues.length
      ? monthlyValues.reduce((s, v) => s + v, 0) / monthlyValues.length
      : 0;
    extra.acquirer_deposits_count = acquirerDeposits.length;
    extra.avg_monthly_settlement = Math.round(avgMonthly);

    if (avgMonthly < 10000) {
      status = 'rejected'; reason = 'סליקה חודשית נמוכה מ-10,000 ₪.';
    } else {
      maxAmount = Math.min(requested_amount, avgMonthly * 3);
      reason = `סליקה חודשית ממוצעת של ₪${Math.round(avgMonthly).toLocaleString()} — מאושר.`;
    }
  }

  // ── Risk-based pricing layer (DSCR / runway, mirror of dealRescuerEngine) ──
  if (metrics) {
    const income = metrics.totalIncome || 0;
    const expenses = metrics.totalExpenses || 0;
    const monthlyNet = income - expenses;
    const liquid = Math.max(0, metrics.liquidAssets || 0);

    const monthlyBurn = monthlyNet < 0 ? Math.abs(monthlyNet) : 0;
    const runwayMonths = monthlyBurn > 0 ? (liquid / monthlyBurn) : (liquid > 0 ? 12 : 0);
    const accountCapacityCap = Math.max(0, monthlyNet) * 36 + liquid * 2;

    extra.account_monthly_net = Math.round(monthlyNet);
    extra.account_liquid = Math.round(liquid);
    extra.runway_months = Number(runwayMonths.toFixed(1));

    const trulyInsolvent = monthlyNet <= 0 && liquid < 1000 && runwayMonths < 0.5;
    if (trulyInsolvent) {
      status = 'rejected'; maxAmount = 0; rate = 0;
      reason = `תזרים שלילי ללא רזרבה — אין מקור החזר אפשרי.`;
    } else if (maxAmount > 0) {
      const r = 0.12 / 12;
      const estMonthlyPayment = (maxAmount * r) / (1 - Math.pow(1 + r, -24));
      const stressNOI = Math.max(monthlyNet, liquid / 12);
      const dscr = estMonthlyPayment > 0 ? (stressNOI / estMonthlyPayment) : 99;

      let tier, rateRange;
      if (dscr >= 1.5 && (metrics.dti || 0) < 45 && runwayMonths >= 4) {
        tier = 'A'; rateRange = [9, 11];
      } else if (dscr >= 1.15 && runwayMonths >= 2) {
        tier = 'B'; rateRange = [12, 15];
      } else if (dscr >= 0.85 || liquid > 0) {
        tier = 'C'; rateRange = [16, 19];
      } else {
        tier = 'D'; rateRange = [20, 24];
      }

      const dscrPressure = Math.min(1, Math.max(0, (1.5 - dscr) / 1.5));
      const tieredRate = Math.round(rateRange[0] + (rateRange[1] - rateRange[0]) * dscrPressure);
      rate = Math.max(rate, tieredRate);
      extra.risk_tier = tier;
      extra.estimated_dscr = Number(dscr.toFixed(2));

      if (maxAmount > accountCapacityCap && accountCapacityCap > 0) {
        maxAmount = accountCapacityCap;
        status = (status === 'approved' || status === 'review') ? 'adjusted' : status;
        reason = `${reason} | Tier ${tier} בריבית ${rate}% (DSCR ${dscr.toFixed(2)}).`;
      } else if (status === 'approved') {
        reason = `${reason} (Tier ${tier}, ${rate}%, DSCR ${dscr.toFixed(2)}).`;
      }
    }
  } else {
    status = 'review';
    maxAmount = 0;
    reason = reason || 'אין נתוני חשבון — חיתום דורש חיבור Open Finance.';
  }

  return {
    status, rate, max_amount: Math.round(maxAmount), reason, product_specific: extra
  };
}

// ── PERSONAL LOAN branch ────────────────────────────────────────────────
async function analyzePersonalLoan({ base44, userId, requested_amount, term_months }) {
  // Reuses the existing consumer underwriting engine (Deal Rescuer).
  let res;
  try {
    res = await base44.functions.invoke('dealRescuerEngine', {
      userId,
      loanAmount: requested_amount,
      termMonths: term_months || 36
    });
  } catch (e) {
    return {
      status: 'review',
      rate: 0,
      max_amount: 0,
      reason: 'מנוע החיתום הצרכני לא זמין כעת — נדרש ניסיון נוסף.',
      product_specific: {}
    };
  }

  const data = res?.data || {};
  const top = (data.candidates && data.candidates[0]) || data.bestOffer || null;

  if (!top) {
    return {
      status: 'rejected',
      rate: 0,
      max_amount: 0,
      reason: data.reason || 'לא נמצאה הצעה ברת קיימא לנתונים הנוכחיים.',
      product_specific: { xai: data.xaiFactors || null }
    };
  }

  const mapStatus = (s) => {
    if (s === 'approved' || s === 'aggressive_approval') return 'approved';
    if (s === 'conditional') return 'adjusted';
    if (s === 'rejected') return 'rejected';
    return 'review';
  };

  return {
    status: mapStatus(top.status),
    rate: top.interestRate || 0,
    max_amount: Math.round(top.loanAmount || 0),
    reason: top.justification || top.reason || 'הצעה צרכנית אופטימלית.',
    product_specific: {
      term_months: top.termMonths,
      dsr: top.dsr,
      monthly_payment: top.monthlyPayment ? Math.round(top.monthlyPayment) : null,
      strategy: top.strategy || top.lane || null
    }
  };
}

// ── Main handler ────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      loan_type,
      product_type,
      requested_amount,
      term_months,
      details = {}
    } = await req.json();

    if (!loan_type || !requested_amount) {
      return Response.json({ error: 'loan_type and requested_amount are required' }, { status: 400 });
    }

    // Personal loan does not need Open Finance txns here — dealRescuerEngine handles it.
    if (loan_type === 'personal_loan') {
      const decision = await analyzePersonalLoan({
        base44, userId: user.id, requested_amount, term_months
      });
      return Response.json({ success: true, decision: { ...decision, loan_type, product_type } });
    }

    // Business paths — pull 12 months of Open Finance + LoanLogic metrics once.
    const txns = await base44.entities.OpenFinanceTransaction.filter({});
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const recent = txns.filter(t => new Date(t.date) >= twelveMonthsAgo);

    let metrics = null;
    try {
      const res = await base44.functions.invoke('loanLogicV2', { userId: user.id });
      metrics = res?.data?.metrics || null;
    } catch (e) { /* continue without */ }

    let decision;
    if (loan_type === 'check_discount') {
      decision = await analyzeCheckDiscount({
        base44, requested_amount, details, metrics, recent
      });
    } else if (loan_type === 'b2b_financing') {
      if (!product_type) {
        return Response.json({ error: 'product_type is required for b2b_financing' }, { status: 400 });
      }
      decision = analyzeB2BFinancing({
        product_type, requested_amount, details, metrics, recent
      });
    } else {
      return Response.json({ error: `Unknown loan_type: ${loan_type}` }, { status: 400 });
    }

    return Response.json({
      success: true,
      decision: {
        ...decision,
        loan_type,
        product_type: product_type || null,
        metrics: metrics ? {
          dti: metrics.dti,
          liquidity_months: metrics.liquidityIndex,
          total_income: metrics.totalIncome,
          total_expenses: metrics.totalExpenses
        } : null
      }
    });
  } catch (error) {
    console.error('loanApplicationAnalyze error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});