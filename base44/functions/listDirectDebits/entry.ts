// Returns two things for the selected bank account:
//   1. authorizations — direct-debit / standing-order rows (read-only view)
//   2. hidden_income  — recurring INFLOWS that look like off-book revenue
//                       (private transfers, customer payments, secondary salary)
//                       which BDI doesn't see but Open Finance does.
//
// hidden_income is treated by FlowUp as a POSITIVE collateral signal —
// proof of real cash flow that strengthens the borrower's risk profile.
//
// FlowUp does NOT initiate or modify any payments — display + underwriting only.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Outflow patterns: existing direct-debit / standing-order detection ──────
const STANDING_PATTERNS = [
  'הוראת קבע', 'הו"ק', 'הוק ', 'חיוב הרשאה', 'הרשאה לחיוב',
  'standing order', 'direct debit'
];

// ─── Inflow patterns: recurring revenue that BDI typically cannot see ────────
// Hits = "hidden income" candidate. Misses (salary, BDI-tracked) = ignored.
const HIDDEN_INCOME_PATTERNS = [
  'העברה',            // generic transfer (Bit, Paybox, bank wire, etc.)
  'זיכוי',            // credit from another party
  'bit', 'paybox', 'payme',
  'transfer', 'wire', 'p2p',
  'תשלום מ',          // "תשלום מ-<X>" — customer paying
];

// Patterns that DISQUALIFY an inflow from "hidden income" (already tracked elsewhere)
const TRACKED_INCOME_PATTERNS = [
  'משכורת', 'שכר', 'salary', 'payroll',
  'ביטוח לאומי', 'מס הכנסה החזר',
  'דיבידנד', 'dividend'
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

    const body = await req.json().catch(() => ({}));
    const accountId = body?.accountId || null;

    // ── Pull transactions (last 6 months), optionally filtered to one account ──
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const txnFilter = accountId ? { account_id: accountId } : {};
    const txns = await base44.entities.OpenFinanceTransaction.filter(txnFilter);
    const recent = txns.filter(t => new Date(t.date) >= sixMonthsAgo);

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Direct debits (outflows)
    // ─────────────────────────────────────────────────────────────────────────
    let authorizations = [];

    // Try persisted entity first (admin / Open Finance sync)
    try {
      const filter = accountId ? { user_id: user.id, account_id: accountId } : { user_id: user.id };
      const stored = await base44.entities.DirectDebitAuthorization.filter(filter);
      if (stored.length > 0) authorizations = stored;
    } catch (_) { /* entity may be empty */ }

    // Fallback: heuristic from descriptions
    if (authorizations.length === 0) {
      const candidates = recent.filter(t =>
        t.amount < 0 && matchesAny(t.description, STANDING_PATTERNS)
      );
      const groups = {};
      candidates.forEach(t => {
        let name = (t.description || '').trim();
        STANDING_PATTERNS.forEach(p => {
          name = name.replace(new RegExp(p, 'gi'), '').trim();
        });
        name = name.replace(/\s{2,}/g, ' ').slice(0, 80) || 'מוטב לא מזוהה';
        if (!groups[name]) groups[name] = { name, amounts: [], dates: [], account_id: t.account_id };
        groups[name].amounts.push(Math.abs(t.amount));
        groups[name].dates.push(t.date);
      });
      authorizations = Object.values(groups)
        .filter(g => g.amounts.length >= 2)
        .map(g => {
          const sorted = g.dates.map(d => new Date(d)).sort((a, b) => b - a);
          const avg = g.amounts.reduce((s, v) => s + v, 0) / g.amounts.length;
          return {
            beneficiary_name: g.name,
            account_id: g.account_id,
            amount_limit: Math.round(avg),
            currency: 'ILS',
            frequency: 'monthly',
            status: 'active',
            last_seen_at: sorted[0]?.toISOString(),
            charge_count_6m: g.amounts.length
          };
        })
        .sort((a, b) => b.amount_limit - a.amount_limit);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Hidden income (off-book collateral) — recurring inflows
    // ─────────────────────────────────────────────────────────────────────────
    const inflowCandidates = recent.filter(t =>
      t.amount > 0 &&
      matchesAny(t.description, HIDDEN_INCOME_PATTERNS) &&
      !matchesAny(t.description, TRACKED_INCOME_PATTERNS)
    );

    const inflowGroups = {};
    inflowCandidates.forEach(t => {
      // Normalize source name: strip generic transfer keywords, keep the counterparty
      let name = (t.description || '').trim();
      ['העברה מ', 'העברה ל', 'העברה', 'זיכוי', 'transfer from', 'transfer'].forEach(p => {
        name = name.replace(new RegExp(p, 'gi'), '').trim();
      });
      name = name.replace(/[-–—]/g, ' ').replace(/\s{2,}/g, ' ').slice(0, 60) || 'מקור לא מזוהה';
      if (!inflowGroups[name]) inflowGroups[name] = { name, amounts: [], dates: [] };
      inflowGroups[name].amounts.push(t.amount);
      inflowGroups[name].dates.push(t.date);
    });

    // Only count sources with >= 3 occurrences over 6 months (recurring signal)
    const hiddenSources = Object.values(inflowGroups)
      .filter(g => g.amounts.length >= 3)
      .map(g => {
        const total = g.amounts.reduce((s, v) => s + v, 0);
        // Estimate monthly average over the 6-month window
        const monthlyAvg = Math.round(total / 6);
        return {
          name: g.name,
          monthly_avg: monthlyAvg,
          occurrences_6m: g.amounts.length
        };
      })
      .filter(s => s.monthly_avg >= 200) // ignore noise (< ₪200/mo)
      .sort((a, b) => b.monthly_avg - a.monthly_avg);

    const totalMonthly = hiddenSources.reduce((s, x) => s + x.monthly_avg, 0);

    // Score uplift: every ₪1,000 of verified recurring off-book inflow ≈ +1 pt,
    // capped at +15 to keep the signal proportional.
    const scoreUplift = Math.min(15, Math.round(totalMonthly / 1000));

    return Response.json({
      success: true,
      account_id: accountId,
      authorizations,
      hidden_income: {
        total_monthly: totalMonthly,
        source_count: hiddenSources.length,
        score_uplift: scoreUplift,
        sources: hiddenSources
      }
    });
  } catch (error) {
    console.error('listDirectDebits error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});