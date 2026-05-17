// Check Discounting underwriting — scans the requesting business's 12-month Open Finance
// history for the third-party (כותב הצ'ק) to detect prior deposits, bounces, and velocity.
// Then combines with LoanLogic financial strength to produce a Policy Engine decision.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Lean Hebrew/English dictionary for "bounced check" patterns across Israeli banks.
const BOUNCE_PATTERNS = [
  'אכ"מ', 'אכמ', 'אין כיסוי', 'צ\'ק מוחזר', 'צ\'ק חוזר',
  'חזרת צ\'ק', 'החזרת צ\'ק', 'מוחזר', 'returned check', 'nsf'
];
const DEPOSIT_PATTERNS = ["הפקדת צ'ק", "הפקדת שיק", "check deposit", "צ'ק"];

function matchesAny(text = '', patterns) {
  const t = String(text).toLowerCase();
  return patterns.some(p => t.includes(p.toLowerCase()));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { amount, third_party_tax_id, third_party_name, due_date } = await req.json();
    if (!amount) return Response.json({ error: 'amount is required' }, { status: 400 });

    // 1. Pull requesting business transactions (last 12 months from Open Finance)
    const txns = await base44.entities.OpenFinanceTransaction.filter({});
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const recent = txns.filter(t => new Date(t.date) >= twelveMonthsAgo);

    // 2. Behavioral Intelligence on the third party
    const idKey = (third_party_tax_id || '').trim();
    const nameKey = (third_party_name || '').trim().toLowerCase();

    const thirdPartyHits = recent.filter(t => {
      const d = (t.description || '').toLowerCase();
      return (idKey && d.includes(idKey)) || (nameKey && d.includes(nameKey));
    });

    const priorDeposits = thirdPartyHits.filter(t =>
      t.amount > 0 && matchesAny(t.description, DEPOSIT_PATTERNS)
    );
    const bounces = recent.filter(t => matchesAny(t.description, BOUNCE_PATTERNS));
    const thirdPartyBounces = thirdPartyHits.filter(t =>
      matchesAny(t.description, BOUNCE_PATTERNS)
    );

    const avgPriorAmount = priorDeposits.length
      ? priorDeposits.reduce((s, t) => s + Math.abs(t.amount), 0) / priorDeposits.length
      : 0;

    // 3. LoanLogic — financial strength of the requesting business
    let loanMetrics = null;
    try {
      const res = await base44.functions.invoke('loanLogicV2', { userId: user.id });
      loanMetrics = res?.data?.metrics || null;
    } catch (e) { /* lean: continue without */ }

    // 4. Policy Engine
    let status = 'approved';
    let reason = '';
    let discountRate = 2.5; // base rate (%)

    if (thirdPartyBounces.length > 0) {
      status = 'rejected';
      reason = `נמצאו ${thirdPartyBounces.length} צ'קים חוזרים מצד ג' זה ב-12 החודשים האחרונים.`;
    } else if (priorDeposits.length === 0 && idKey) {
      status = 'review';
      reason = 'אין היסטוריית הפקדות קודמות מצד ג׳ זה — נדרשת בדיקה ידנית.';
      discountRate = 4.0;
    } else if (avgPriorAmount > 0 && amount > avgPriorAmount * 3) {
      status = 'adjusted';
      reason = `סכום הצ'ק (₪${amount.toLocaleString()}) חורג משמעותית מההיסטוריה (ממוצע ₪${Math.round(avgPriorAmount).toLocaleString()}) — אושר בעמלה גבוהה.`;
      discountRate = 5.0;
    } else if (priorDeposits.length >= 3) {
      reason = `אושר: ${priorDeposits.length} הפקדות תקינות בסך ₪${Math.round(priorDeposits.reduce((s, t) => s + t.amount, 0)).toLocaleString()}, ללא חזרות.`;
    } else {
      reason = 'היסטוריה נקייה, סכום סביר.';
    }

    // Adjust for requesting business weakness (secondary guarantor)
    if (loanMetrics?.dti > 70 && status === 'approved') {
      status = 'adjusted';
      discountRate += 1.5;
      reason += ' תזרים העסק המבקש חלש — עמלת סיכון נוספת.';
    }

    return Response.json({
      success: true,
      decision: {
        status,
        reason,
        discount_rate: discountRate,
        third_party_history: {
          prior_deposits: priorDeposits.length,
          total_prior_amount: priorDeposits.reduce((s, t) => s + t.amount, 0),
          avg_prior_amount: Math.round(avgPriorAmount),
          third_party_bounces: thirdPartyBounces.length,
          total_account_bounces: bounces.length
        },
        requesting_business: loanMetrics ? {
          dti: loanMetrics.dti,
          liquidity_months: loanMetrics.liquidityIndex
        } : null
      }
    });
  } catch (error) {
    console.error('checkDiscountAnalyze error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});