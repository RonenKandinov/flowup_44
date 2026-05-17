// Unified B2B Financing underwriting — covers Reverse Factoring, RBF, PO Financing,
// SME Working Capital, and Merchant Cash Advance. Reuses LoanLogic + InsightEngine
// and applies product-specific Policy rules.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ACQUIRER_PATTERNS = ['ישראכרט', 'isracard', 'כאל', 'cal', 'מקס', 'max', 'leumi card', 'shva', 'שב"א'];

function matchesAny(text = '', patterns) {
  const t = String(text).toLowerCase();
  return patterns.some(p => t.includes(p.toLowerCase()));
}

function monthKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function computeMRR(transactions) {
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
  return { mrr, momGrowth, monthlySeries: values };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { product_type, requested_amount, context = {} } = await req.json();
    if (!product_type || !requested_amount) {
      return Response.json({ error: 'product_type and requested_amount are required' }, { status: 400 });
    }

    // Pull 12 months of Open Finance transactions for the underwriting target
    const txns = await base44.entities.OpenFinanceTransaction.filter({});
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const recent = txns.filter(t => new Date(t.date) >= twelveMonthsAgo);

    // Run LoanLogic for shared financial strength metrics
    let metrics = null;
    try {
      const res = await base44.functions.invoke('loanLogicV2', { userId: user.id });
      metrics = res?.data?.metrics || null;
    } catch (e) { /* lean */ }

    let status = 'approved';
    let rate = 9;
    let maxAmount = requested_amount;
    let reason = '';
    const extra = {};

    if (product_type === 'reverse_factoring') {
      // Underwrite the large buyer: needs strong corporate cash flow & low DTI.
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
      const burnRate = metrics ? Math.max(0, metrics.totalExpenses - metrics.totalIncome) : 0;
      extra.burn_rate = Math.round(burnRate);

      if (mrr < 20000) {
        status = 'rejected'; reason = 'MRR נמוך מ-20,000 ₪ — לא מתאים ל-RBF.';
      } else {
        maxAmount = Math.min(requested_amount, mrr * 4);
        const repaymentPct = Math.min(15, Math.max(3, (requested_amount / (mrr * 12)) * 100));
        extra.revenue_share_pct = Number(repaymentPct.toFixed(1));
        reason = `MRR יציב של ₪${Math.round(mrr).toLocaleString()} — מומלץ ${repaymentPct.toFixed(1)}% מהכנסות עד החזר מלא.`;
      }

    } else if (product_type === 'purchase_order_financing') {
      const buyerName = (context.buyer_name || '').toLowerCase();
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
        reason = `נמצאו ${buyerInflows.length} תשלומים קודמים מהקונה ו-${fxOutflows.length} העברות מט"ח — יכולת תפעולית מוכחת.`;
      }

    } else if (product_type === 'working_capital') {
      // SME Working Capital — bounds approved amount to REAL business capacity
      // from loanLogicV2: max = 3× monthly net cash flow OR liquid assets ×2,
      // whichever is greater. This is the difference between a "generic 9% rate
      // on whatever you asked for" and underwriting that reflects the account.
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
          reason = `יכולת תזרימית חודשית נמוכה מדי (₪${Math.round(monthlyNet).toLocaleString()}) — לא ניתן לאשר הון חוזר.`;
        } else if (requested_amount > capacityCap) {
          status = 'adjusted';
          maxAmount = Math.min(requested_amount, capacityCap);
          rate = metrics.dti > 55 ? 13 : 11;
          reason = `הסכום המבוקש (₪${requested_amount.toLocaleString()}) חורג מהיכולת התזרימית — אושר עד ₪${Math.round(maxAmount).toLocaleString()} בריבית ${rate}%.`;
        } else if (metrics.dti > 55) {
          status = 'adjusted'; rate = 13;
          maxAmount = Math.min(requested_amount, capacityCap);
          reason = `תזרים לחוץ (DSR ${metrics.dti}%) — אושר ₪${Math.round(maxAmount).toLocaleString()} בריבית גבוהה לתקופה קצרה.`;
        } else {
          maxAmount = Math.min(requested_amount, capacityCap);
          reason = `תזרים יציב — מאושר ₪${Math.round(maxAmount).toLocaleString()} להלוואת גישור.`;
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

    return Response.json({
      success: true,
      decision: {
        status,
        rate,
        max_amount: Math.round(maxAmount),
        reason,
        product_type,
        metrics: metrics ? {
          dti: metrics.dti,
          liquidity_months: metrics.liquidityIndex,
          total_income: metrics.totalIncome,
          total_expenses: metrics.totalExpenses
        } : null,
        product_specific: extra
      }
    });
  } catch (error) {
    console.error('b2bFinancingAnalyze error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});