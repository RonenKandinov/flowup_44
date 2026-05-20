// Read-only view of standing-order / direct-debit authorizations attached to the
// user's bank account. Two sources, in priority order:
//   1. DirectDebitAuthorization entity rows (if Open Finance sync persisted them)
//   2. Heuristic extraction from OpenFinanceTransaction descriptions
//      (הוראת קבע / standing order / חיוב הרשאה patterns)
//
// FlowUp does NOT initiate or modify these — this is for display + compliance review.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const STANDING_PATTERNS = [
  'הוראת קבע', 'הו"ק', 'הוק ', 'חיוב הרשאה', 'הרשאה לחיוב',
  'standing order', 'direct debit'
];

const matchesAny = (text = '', patterns) => {
  const t = String(text).toLowerCase();
  return patterns.some(p => t.includes(p.toLowerCase()));
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Prefer persisted authorizations (admin or user-owned)
    let stored = [];
    try {
      stored = await base44.entities.DirectDebitAuthorization.filter({ user_id: user.id });
    } catch (e) { /* entity may be empty */ }

    if (stored.length > 0) {
      return Response.json({
        success: true,
        source: 'open_finance_sync',
        authorizations: stored
      });
    }

    // 2. Heuristic extraction from transactions
    const txns = await base44.entities.OpenFinanceTransaction.filter({});
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const candidates = txns.filter(t =>
      new Date(t.date) >= sixMonthsAgo &&
      t.amount < 0 &&
      matchesAny(t.description, STANDING_PATTERNS)
    );

    // Group by beneficiary (best-effort: strip patterns to extract name)
    const groups = {};
    candidates.forEach(t => {
      let name = (t.description || '').trim();
      STANDING_PATTERNS.forEach(p => {
        name = name.replace(new RegExp(p, 'gi'), '').trim();
      });
      name = name.replace(/\s{2,}/g, ' ').slice(0, 80) || 'מוטב לא מזוהה';

      if (!groups[name]) {
        groups[name] = { name, amounts: [], dates: [], account_id: t.account_id };
      }
      groups[name].amounts.push(Math.abs(t.amount));
      groups[name].dates.push(t.date);
    });

    const authorizations = Object.values(groups)
      .filter(g => g.amounts.length >= 2) // need at least 2 charges to look recurring
      .map(g => {
        const sorted = g.dates.map(d => new Date(d)).sort((a, b) => b - a);
        const avgAmount = g.amounts.reduce((s, v) => s + v, 0) / g.amounts.length;
        return {
          beneficiary_name: g.name,
          account_id: g.account_id,
          amount_limit: Math.round(avgAmount),
          currency: 'ILS',
          frequency: 'monthly',
          status: 'active',
          last_seen_at: sorted[0]?.toISOString(),
          charge_count_6m: g.amounts.length
        };
      })
      .sort((a, b) => b.amount_limit - a.amount_limit);

    return Response.json({
      success: true,
      source: 'transaction_heuristic',
      authorizations
    });
  } catch (error) {
    console.error('listDirectDebits error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});