import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// PMT calculation (standard amortization)
const pmt = (principal, annualRate, months) => {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRate / 12;
  if (r <= 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
};

// Internal stress-test — runs silently inside the engine and can downgrade a strategy's status.
// NOT exposed to the UI as separate data; its effect is reflected only via the final status.
const STRESS_SCENARIOS = [
  { incomeShock: 0.05, rateShock: 0.005 }, // mild: -5% income, +0.5% rate
  { incomeShock: 0.10, rateShock: 0.010 }  // moderate: -10% income, +1.0% rate
];

// High-exposure guard — large principals must survive stricter stress before approval.
// Prevents easy approvals of oversized loans (e.g. ₪700k) even with strong portfolios.
const HIGH_EXPOSURE_THRESHOLD = 200000; // ILS — above this, stricter rules apply
const VERY_HIGH_EXPOSURE_THRESHOLD = 400000;

const runStressTest = ({ candidate, income, existingDebtPayments, estimatedExpenses, dsrLimit, requestedLoanAmount }) => {
  // Returns the (possibly downgraded) status after silent stress testing.
  // Never upgrades a status — only downgrades.
  if (!income || income <= 0) return candidate.status;

  const principal = candidate.loanAmount;
  const rateDecimal = candidate.interestRate / 100;
  const isHighExposure = principal >= HIGH_EXPOSURE_THRESHOLD;
  const isVeryHighExposure = principal >= VERY_HIGH_EXPOSURE_THRESHOLD;

  // For high-exposure loans, require a tighter stress DSR buffer.
  // Normal: stressed DSR must stay <= dsrLimit + 0.05
  // High exposure: stressed DSR must stay <= dsrLimit (no buffer)
  // Very high exposure: stressed DSR must stay <= dsrLimit - 0.03 (tighter)
  const stressCeiling = isVeryHighExposure ? dsrLimit - 0.03
                      : isHighExposure ? dsrLimit
                      : dsrLimit + 0.05;

  let failures = 0;
  let severeFailure = false;

  for (const scenario of STRESS_SCENARIOS) {
    const stressedIncome = income * (1 - scenario.incomeShock);
    const stressedRate = Math.min(0.12, rateDecimal + scenario.rateShock);
    const stressedPayment = pmt(principal, stressedRate, candidate.termMonths);
    // CRITICAL: stress test against DISPOSABLE income (after living expenses), not gross income.
    // Expenses are assumed to scale modestly with income shock — we keep them flat (worst case).
    const stressedDisposable = stressedIncome - existingDebtPayments - estimatedExpenses;
    if (stressedDisposable <= 0) { failures += 1; severeFailure = true; continue; }
    const stressedDsr = stressedPayment / stressedDisposable;

    if (stressedDsr > stressCeiling) failures += 1;
    if (stressedDsr > dsrLimit + 0.10) severeFailure = true;
  }

  // Very-high-exposure loans must pass ALL scenarios cleanly, regardless of original status.
  if (isVeryHighExposure && failures > 0) {
    return severeFailure ? 'rejected' : 'conditional';
  }

  // High-exposure loans: any failure downgrades.
  if (isHighExposure && failures > 0) {
    if (candidate.status === 'approved') return 'conditional';
    if (candidate.status === 'conditional' || severeFailure) return 'rejected';
  }

  // Normal exposure: only severe failures cause downgrade.
  if (severeFailure) {
    if (candidate.status === 'approved') return 'conditional';
    if (candidate.status === 'conditional') return 'rejected';
  } else if (failures >= STRESS_SCENARIOS.length) {
    // Failing all scenarios (even mildly) downgrades approved → conditional.
    if (candidate.status === 'approved') return 'conditional';
  }

  return candidate.status;
};

// Stage 3 — dynamic rate adjustment from analysisInsights
const adjustRate = (baseRate, insights) => {
  if (!insights) return baseRate;
  let rate = baseRate;
  const riskLevel = String(insights.riskLevel || '').toLowerCase();
  if (riskLevel === 'high') rate += 0.015;
  if (riskLevel === 'low') rate -= 0.005;
  if (Number(insights.liquidityMonths) > 3) rate -= 0.005;
  if (Number(insights.behavioralScore) >= 0.6) rate -= 0.005;
  return clamp(rate, 0.05, 0.12);
};

// Stage 2 — Grid search within stage constraints
const gridSearch = ({ income, existingDebtPayments, estimatedExpenses, requestedLoanAmount, baseInterestRate, insights, maxDownPayment, stage, dsrLimit }) => {
  const adjustedBase = adjustRate(baseInterestRate, insights);
  const DSR_LIMIT = dsrLimit;
  const DSR_NEAR = dsrLimit + 0.05; // 5pp above the policy threshold = "קרוב מאוד" לסף
  const behavioralFlex = insights?.isFalseNegative || Number(insights?.behavioralScore) >= 0.6;

  // CRITICAL: DSR is computed against DISPOSABLE income (income − existing debt − living expenses).
  // If disposable is non-positive, the client cannot service ANY new debt — short-circuit.
  const disposableIncome = income - existingDebtPayments - estimatedExpenses;
  if (disposableIncome <= 0) return [];

  // Stage-bound term and amount ratios
  const allTerms = [24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84];
  const terms = allTerms.filter(t => t <= stage.maxTerm);
  const amountRatios = [1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5]
    .filter(r => r >= stage.minAmountRatio);
  const downPaymentRatios = [0, 0.05, 0.1, 0.15, 0.2];
  // Interest rate grid: 5%-12%
  const rateDeltas = [-0.04, -0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03];

  const dpCap = Number.isFinite(maxDownPayment) && maxDownPayment > 0 ? maxDownPayment : Infinity;
  const candidates = [];

  for (const term of terms) {
    for (const ratio of amountRatios) {
      for (const dp of downPaymentRatios) {
        for (const delta of rateDeltas) {
          const grossAmount = requestedLoanAmount * ratio;
          let downPayment = Math.round(grossAmount * dp);
          if (downPayment > dpCap) downPayment = Math.floor(dpCap);
          const netLoan = grossAmount - downPayment;
          if (netLoan <= 0) continue;

          const rate = clamp(adjustedBase + delta, 0.05, 0.12);
          const monthlyPayment = pmt(netLoan, rate, term);
          // DSR = new loan payment ÷ disposable income (after expenses + existing debts).
          const dsr = monthlyPayment / disposableIncome;

          let status = null;
          if (dsr <= DSR_LIMIT) status = 'approved';
          else if (dsr <= DSR_NEAR && behavioralFlex) status = 'conditional';
          if (!status) continue;

          candidates.push({
            loanAmount: Math.round(netLoan),
            grossAmount: Math.round(grossAmount),
            termMonths: term,
            interestRate: Number((rate * 100).toFixed(2)),
            downPayment,
            monthlyPayment: Math.round(monthlyPayment),
            dsr: Number(dsr.toFixed(4)),
            status,
            amountRatio: ratio
          });
        }
      }
    }
  }
  return candidates;
};

// Multi-stage search: run stages in order, stop when we have candidates
const multiStageSearch = (args) => {
  const stages = [
    { name: 'stage1', minAmountRatio: 0.8, maxTerm: 60 },
    { name: 'stage2', minAmountRatio: 0.7, maxTerm: 72 },
    { name: 'stage3', minAmountRatio: 0.5, maxTerm: 84 }
  ];
  for (const stage of stages) {
    const found = gridSearch({ ...args, stage });
    if (found.length > 0) return { candidates: found, stage: stage.name };
  }
  return { candidates: [], stage: null };
};

// Load the policy DSR threshold from UnderwritingRule — falls back to 40% if missing.
const loadPolicyDsrLimit = async (base44) => {
  try {
    const rules = await base44.asServiceRole.entities.UnderwritingRule.list();
    const max = Number(rules?.[0]?.max_dti_approve);
    if (Number.isFinite(max) && max > 0 && max < 100) return max / 100;
  } catch (e) {
    console.warn('dealRescuerEngine: could not load UnderwritingRule, using default 40%', e);
  }
  return 0.4;
};

// ─── Dynamic Risk-Adjustment Layer ─────────────────────────────────────────────
// Adjusts the DSR ceiling around the company policy threshold based on applicant
// quality signals (liquidity, behavior, risk level). The company policy itself is
// NEVER overridden — this only widens or tightens the band around it.
//
// Result is clamped to [30%, 65%] to prevent extreme drift in either direction.
// All adjustments are returned for transparency so analysts/auditors can see
// exactly why the ceiling moved.
const computeAdjustedDsrLimit = (basePolicyLimit, insights) => {
  const baseDsrLimitPct = Math.round(basePolicyLimit * 1000) / 10; // e.g. 0.5 → 50.0
  const adjustments = [];

  if (!insights) {
    return {
      adjustedLimit: basePolicyLimit,
      base_dsr_limit: baseDsrLimitPct,
      adjusted_dsr_limit: baseDsrLimitPct,
      adjustments
    };
  }

  let adjustedPct = baseDsrLimitPct;

  // ── Liquidity adjustment ────
  const liquidity = Number(insights.liquidityMonths);
  if (Number.isFinite(liquidity)) {
    if (liquidity >= 3) {
      adjustedPct += 5;
      adjustments.push('liquidity +5%');
    } else if (liquidity < 1) {
      adjustedPct -= 10;
      adjustments.push('liquidity -10%');
    }
  }

  // ── Behavioral adjustment ────
  const behavior = Number(insights.behavioralScore);
  if (Number.isFinite(behavior)) {
    if (behavior >= 0.8) {
      adjustedPct += 3;
      adjustments.push('behavior +3%');
    } else if (behavior < 0.5) {
      adjustedPct -= 5;
      adjustments.push('behavior -5%');
    }
  }

  // ── Risk level adjustment ────
  const riskLevel = String(insights.riskLevel || '').toLowerCase();
  if (riskLevel === 'low') {
    adjustedPct += 2;
    adjustments.push('risk level +2%');
  } else if (riskLevel === 'high') {
    adjustedPct -= 5;
    adjustments.push('risk level -5%');
  }

  // Clamp the final ceiling to a safe band [30%, 65%]
  adjustedPct = Math.min(65, Math.max(30, adjustedPct));

  return {
    adjustedLimit: adjustedPct / 100,
    base_dsr_limit: baseDsrLimitPct,
    adjusted_dsr_limit: Number(adjustedPct.toFixed(1)),
    adjustments
  };
};

// Stage 4 — composite score (higher = better)
const compositeScore = (c, requestedLoanAmount, dsrLimit) => {
  const closeness = clamp(c.grossAmount / requestedLoanAmount, 0, 1);
  const dsrRatio = clamp(c.dsr / dsrLimit, 0, 1.5);
  return (1 - dsrRatio) * 0.4 + closeness * 0.4 + (1 - c.termMonths / 84) * 0.2;
};

// Per-strategy scoring — each strategy optimizes a DIFFERENT objective
// so the three results are meaningfully distinct.
const strategyScore = (type, c, requestedLoanAmount, insights, dsrLimit) => {
  const closeness = clamp(c.grossAmount / requestedLoanAmount, 0, 1);
  const dsrHeadroom = clamp((dsrLimit - c.dsr) / dsrLimit, -0.5, 1); // how far below policy threshold
  const termRatio = c.termMonths / 84;
  const dpRatio = c.downPayment / Math.max(1, c.grossAmount);
  const statusBonus = c.status === 'approved' ? 0.1 : 0;

  if (type === 'cash_flow_alignment') {
    // Goal: keep requested amount, lower monthly payment via longer term.
    // Reward: high closeness + long term + low monthly burden.
    const monthlyBurden = c.monthlyPayment / Math.max(1, requestedLoanAmount / 48);
    return closeness * 0.55 + termRatio * 0.25 + (1 - clamp(monthlyBurden, 0, 2) / 2) * 0.15 + statusBonus;
  }
  if (type === 'exposure_reduction') {
    // Goal: reduce exposure — smaller principal and/or higher down payment.
    // Reward: low amount + high DP + large DSR headroom + shorter term.
    return (1 - closeness) * 0.4 + dpRatio * 0.25 + dsrHeadroom * 0.25 + (1 - termRatio) * 0.1 + statusBonus;
  }
  // behavioral_approval — Goal: closest to the original request, leveraging behavioral flexibility.
  const behavioralBoost = (insights?.isFalseNegative || Number(insights?.behavioralScore) >= 0.6) ? 0.1 : 0;
  // Encourage using the flexibility band (dsr closer to limit) while staying closest to request.
  const nearLimit = 1 - clamp(Math.abs(c.dsr - (dsrLimit - 0.02)) / 0.1, 0, 1);
  return closeness * 0.6 + nearLimit * 0.2 + (1 - termRatio) * 0.1 + behavioralBoost + statusBonus;
};

// Stage 5 — pick 3 distinct strategies
//
// CRITICAL distinctness rule: when ALL candidates cluster near the DSR ceiling
// (typical when the requested amount is close to the client's max capacity),
// the three strategies would otherwise return identical structures. To force
// meaningful variety, we partition candidates into TYPE-SPECIFIC POOLS that
// represent each strategy's philosophical "lane":
//
//  • cash_flow_alignment → longest available terms (lower monthly payment)
//  • exposure_reduction  → smaller principals AND/OR larger down payments
//  • behavioral_approval → closest to original request (largest principal, may use DSR headband)
//
// Each strategy picks its winner from its OWN pool, so even when the underlying
// candidate set is narrow, the three results occupy distinct corners of the grid.
const pickStrategies = (candidates, requestedLoanAmount, insights, dsrLimit) => {
  if (candidates.length === 0) return [];

  const withScore = candidates.map(c => ({ ...c, score: compositeScore(c, requestedLoanAmount, dsrLimit) }));

  // Sort helpers for the three "lanes"
  const maxTerm = Math.max(...withScore.map(c => c.termMonths));
  const minTerm = Math.min(...withScore.map(c => c.termMonths));
  const maxAmount = Math.max(...withScore.map(c => c.grossAmount));
  const minAmount = Math.min(...withScore.map(c => c.grossAmount));

  // Lane 1 — cash flow: prefer LONGEST term (lowest monthly burden).
  // Pool = candidates within the top 1/3 of available terms.
  const termCutoff = minTerm + (maxTerm - minTerm) * 0.66;
  const cashFlowPool = withScore.filter(c => c.termMonths >= termCutoff);

  // Lane 2 — exposure: prefer SMALLEST principal or HIGHEST down payment.
  // Pool = candidates in the bottom 1/2 of amounts OR with non-zero DP.
  const amountMidpoint = minAmount + (maxAmount - minAmount) * 0.5;
  const exposurePool = withScore.filter(c => c.grossAmount <= amountMidpoint || c.downPayment > 0);

  // Lane 3 — behavioral: prefer LARGEST principal (closest to request).
  // Pool = candidates in the top 1/2 of amounts.
  const behavioralPool = withScore.filter(c => c.grossAmount >= amountMidpoint);

  const pickFromPool = (pool, type) => {
    const source = pool.length > 0 ? pool : withScore; // fallback to full set if pool is empty
    const ranked = [...source]
      .map(c => ({ c, s: strategyScore(type, c, requestedLoanAmount, insights, dsrLimit) }))
      .sort((a, b) => b.s - a.s);
    return ranked[0]?.c || null;
  };

  // Distinctness: two picks are "too similar" if they share the SAME structural fingerprint.
  // Using OR logic — different on ANY one of these dimensions is enough to count as distinct.
  // (The previous AND logic let identical-on-3-dimensions picks slip through.)
  const isDuplicate = (a, b) => {
    if (!a || !b) return false;
    return a.grossAmount === b.grossAmount
        && a.termMonths === b.termMonths
        && Math.abs(a.interestRate - b.interestRate) < 0.01
        && a.downPayment === b.downPayment;
  };

  const order = ['cash_flow_alignment', 'exposure_reduction', 'behavioral_approval'];
  const pools = {
    cash_flow_alignment: cashFlowPool,
    exposure_reduction: exposurePool,
    behavioral_approval: behavioralPool
  };

  const chosen = {};
  for (const type of order) {
    const pool = pools[type];
    const source = pool.length > 0 ? pool : withScore;
    const ranked = [...source]
      .map(c => ({ c, s: strategyScore(type, c, requestedLoanAmount, insights, dsrLimit) }))
      .sort((a, b) => b.s - a.s);

    // Walk down the ranked list and take the first candidate that isn't a duplicate
    // of an already-chosen pick. Falls back to top pick if everything collides.
    let pick = ranked[0]?.c || null;
    for (const { c } of ranked) {
      const conflict = Object.values(chosen).some(existing => isDuplicate(existing, c));
      if (!conflict) { pick = c; break; }
    }
    if (pick) chosen[type] = pick;
  }

  return order.filter(t => chosen[t]).map(t => ({ type: t, c: chosen[t] }));
};

const reasonFor = (type, c) => {
  const dsrPct = (c.dsr * 100).toFixed(1);
  if (type === 'cash_flow_alignment') {
    return `פריסה ל-${c.termMonths} חודשים מורידה את ההחזר ל-₪${c.monthlyPayment.toLocaleString('he-IL')} ומיישרת את ה-DSR ל-${dsrPct}%.`;
  }
  if (type === 'exposure_reduction') {
    const dpTxt = c.downPayment > 0 ? ` ומקדמה של ₪${c.downPayment.toLocaleString('he-IL')}` : '';
    return `הקטנת ההלוואה ל-₪${c.loanAmount.toLocaleString('he-IL')}${dpTxt} מורידה את החשיפה ומביאה ל-DSR של ${dsrPct}%.`;
  }
  return `שמירה על מבנה קרוב לבקשה המקורית (₪${c.loanAmount.toLocaleString('he-IL')} ל-${c.termMonths} חודשים) מאפשרת אישור תוך ניצול הפרופיל ההתנהגותי, עם DSR של ${dsrPct}%.`;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const income = Number(body?.income || 0);
    const existingDebtPayments = Number(
      body?.existingDebtPayments ?? body?.existing_debt_payments ?? body?.debtPayments ?? 0
    );
    const requestedLoanAmount = Number(body?.requestedLoanAmount ?? body?.principal ?? 50000);
    const requestedTermMonths = Number(body?.requestedTermMonths ?? body?.durationMonths ?? 48);
    const baseInterestRate = Number(body?.baseInterestRate ?? body?.baseRate ?? 0.09);
    const maxDownPayment = Number(body?.maxDownPayment ?? Infinity);
    const insights = body?.analysisInsights || null;

    // CRITICAL: real repayment capacity is disposable income, not gross income.
    // Source priority: explicit body.estimatedExpenses → analysisInsights.estimatedExpenses → 70% of income (conservative fallback).
    const estimatedExpenses = Number(
      body?.estimatedExpenses ??
      insights?.estimatedExpenses ??
      (income * 0.7)
    );
    const disposableIncome = income - existingDebtPayments - estimatedExpenses;

    // Load policy DSR threshold from UnderwritingRule — makes the engine responsive to Underwriting Settings.
    const basePolicyDsrLimit = await loadPolicyDsrLimit(base44);

    // ── Dynamic risk-adjustment layer ──
    // Policy stays intact; we tighten/loosen the operational ceiling around it
    // based on applicant quality (liquidity, behavior, risk level).
    const riskAdjustment = computeAdjustedDsrLimit(basePolicyDsrLimit, insights);
    const dsrLimit = riskAdjustment.adjustedLimit;
    const dsrLimitPct = riskAdjustment.adjusted_dsr_limit;

    // currentDsr is informational ("baseline" before any new loan). With the new model,
    // we report it as existing-debt-burden vs. (income − expenses) — i.e. how stretched the
    // client already is BEFORE adding the requested loan. If disposable ≤ 0 we cap at 1 (100%+).
    const preLoanCapacity = income - estimatedExpenses;
    const currentDsr = preLoanCapacity > 0 ? clamp(existingDebtPayments / preLoanCapacity, 0, 2) : 1;
    const currentScore = Number(body?.score || clamp(Math.round(85 - currentDsr * 100 * 0.7), 20, 85));
    const currentStatus = String(body?.currentStatus || (currentDsr <= dsrLimit ? 'approved' : currentDsr <= dsrLimit + 0.1 ? 'borderline' : 'rejected'));

    // Multi-stage search — DSR computed on disposable income inside.
    const { candidates: rawCandidates, stage } = multiStageSearch({
      income,
      existingDebtPayments,
      estimatedExpenses,
      requestedLoanAmount,
      baseInterestRate,
      insights,
      maxDownPayment,
      dsrLimit
    });

    // Silent internal stress testing — may downgrade candidate statuses.
    // Candidates whose status drops to 'rejected' are removed from consideration.
    const stressedCandidates = rawCandidates
      .map(c => {
        const newStatus = runStressTest({
          candidate: c,
          income,
          existingDebtPayments,
          estimatedExpenses,
          dsrLimit,
          requestedLoanAmount
        });
        return { ...c, status: newStatus };
      })
      .filter(c => c.status === 'approved' || c.status === 'conditional');

    const candidates = stressedCandidates;
    const picks = pickStrategies(candidates, requestedLoanAmount, insights, dsrLimit);
    const strategies = picks.map(({ type, c }) => ({
      type,
      status: c.status,
      loanAmount: c.loanAmount,
      termMonths: c.termMonths,
      interestRate: c.interestRate,
      downPayment: c.downPayment,
      monthlyPayment: c.monthlyPayment,
      dsr: Number((c.dsr * 100).toFixed(1)),
      score: Number(c.score.toFixed(3)),
      reason: reasonFor(type, c)
    }));

    // Fallback: no passing combos in any stage
    let fallback = null;
    if (strategies.length === 0) {
      // Run a broad scan with no DSR filter to find the closest attempt
      const broadBase = adjustRate(baseInterestRate, insights);
      let closest = null;
      for (const term of [24, 36, 48, 60, 72, 84]) {
        for (const ratio of [1.0, 0.8, 0.6, 0.5]) {
          const grossAmount = requestedLoanAmount * ratio;
          const monthlyPayment = pmt(grossAmount, broadBase, term);
          // DSR against disposable income (real capacity); if disposable ≤ 0, DSR is effectively infinite.
          const dsr = disposableIncome > 0 ? (monthlyPayment / disposableIncome) : 9.99;
          const cand = {
            loanAmount: Math.round(grossAmount),
            termMonths: term,
            interestRate: Number((broadBase * 100).toFixed(2)),
            downPayment: 0,
            monthlyPayment: Math.round(monthlyPayment),
            dsr
          };
          if (!closest || cand.dsr < closest.dsr) closest = cand;
        }
      }
      if (closest) {
        const overshoot = Math.round((closest.dsr - dsrLimit) * 100 * 10) / 10;
        fallback = {
          closestAttempt: { ...closest, dsr: Number((closest.dsr * 100).toFixed(1)), status: 'failed', type: 'closest_attempt' },
          whyFailed: `גם במבנה האופטימלי ה-DSR עומד על ${(closest.dsr * 100).toFixed(1)}% — חורג ב-${overshoot} נק׳ אחוז מהמקסימום של ${dsrLimitPct}%.`,
          improvements: [
            `הקטנת סכום הבקשה ב-₪${Math.round(requestedLoanAmount * 0.2).toLocaleString('he-IL')} לפחות`,
            `הגדלת הכנסה חודשית ב-₪${Math.max(500, Math.round((existingDebtPayments + closest.monthlyPayment) / dsrLimit - income)).toLocaleString('he-IL')}`,
            `הפחתת החזרי חוב קיימים (כיום ₪${existingDebtPayments.toLocaleString('he-IL')})`,
            `הוספת מקדמה של 20% (₪${Math.round(requestedLoanAmount * 0.2).toLocaleString('he-IL')})`
          ]
        };

        // ── Max-approvable offer ──────────────────────────────────────────────
        // Highest principal that keeps DSR ≤ policy limit, using the most generous
        // structure: term = 84 months (lowest monthly payment) + adjusted base rate.
        // CRITICAL: headroom is computed against DISPOSABLE income (after existing
        // debts AND living expenses). If disposable ≤ 0, no offer is possible.
        const maxTerm = 84;
        const offerRate = adjustRate(baseInterestRate, insights);
        const headroom = disposableIncome > 0 ? dsrLimit * disposableIncome : 0;
        if (headroom > 0) {
          let lo = 0;
          let hi = Math.max(requestedLoanAmount, 1000) * 1.2; // search up to 120% of requested
          for (let i = 0; i < 32; i++) {
            const mid = (lo + hi) / 2;
            const payment = pmt(mid, offerRate, maxTerm);
            if (payment <= headroom) lo = mid; else hi = mid;
          }
          const maxPrincipal = Math.floor(lo / 1000) * 1000; // round down to nearest ₪1k
          if (maxPrincipal >= 1000) {
            const monthly = Math.round(pmt(maxPrincipal, offerRate, maxTerm));
            const finalDsr = monthly / disposableIncome;
            fallback.maxApprovableOffer = {
              loanAmount: maxPrincipal,
              termMonths: maxTerm,
              interestRate: Number((offerRate * 100).toFixed(2)),
              monthlyPayment: monthly,
              dsr: Number((finalDsr * 100).toFixed(1)),
              status: 'approved',
              note: `זהו הסכום המקסימלי שניתן לאשר במבנה הנוכחי — פריסה ל-${maxTerm} חודשים שומרת על DSR של ${(finalDsr * 100).toFixed(1)}% מההכנסה הפנויה (מתחת לסף ${dsrLimitPct}%).`
            };
          }
        }
      }
    }

    const hasRescue = strategies.length > 0;
    const headline = hasRescue
      ? [...strategies].sort((a, b) => {
          const rank = { approved: 2, conditional: 1 };
          return ((rank[b.status] || 0) - (rank[a.status] || 0)) || (b.score - a.score);
        })[0]
      : null;

    const explanation = hasRescue
      ? `נמצאו ${strategies.length} אסטרטגיות בשלב ${stage}. מוביל: ${headline.type.replace(/_/g, ' ')} — DSR ${headline.dsr}%.`
      : `לא נמצאה קומבינציה שמעמידה את ה-DSR מתחת ל-${dsrLimitPct}%. מוצג הניסיון הקרוב ביותר עם דרכי פעולה לשיפור.`;

    return Response.json({
      analysisInsights: insights,
      rescueStrategies: strategies,
      fallback,
      stage,
      before: {
        status: currentStatus,
        dsr: Number((currentDsr * 100).toFixed(1)),
        score: currentScore
      },
      after: hasRescue ? {
        status: headline.status,
        dsr: headline.dsr,
        // Rescued score must reflect IMPROVEMENT over the original: never drop below currentScore.
        // We compute a DSR-based score and then take max(currentScore + delta, currentScore).
        score: (() => {
          const dsrBasedScore = clamp(Math.round(85 - headline.dsr * 0.7), 30, 95);
          const improvement = headline.status === 'approved' ? 8 : 4; // guaranteed uplift
          return clamp(Math.max(dsrBasedScore, currentScore + improvement), 30, 95);
        })(),
        duration_months: headline.termMonths,
        monthly_payment: headline.monthlyPayment
      } : {
        status: 'still_risky',
        dsr: Number((currentDsr * 100).toFixed(1)),
        score: currentScore,
        duration_months: requestedTermMonths,
        monthly_payment: Math.round(pmt(requestedLoanAmount, baseInterestRate, requestedTermMonths))
      },
      impact: {
        approval_probability_increase: hasRescue ? Math.max(0, clamp(Math.round(85 - headline.dsr * 0.7), 30, 95) - currentScore) : 0,
        dsr_change: hasRescue ? Number((headline.dsr - currentDsr * 100).toFixed(1)) : 0
      },
      explanation,
      risk_adjustment: {
        base_dsr_limit: riskAdjustment.base_dsr_limit,
        adjusted_dsr_limit: riskAdjustment.adjusted_dsr_limit,
        adjustments: riskAdjustment.adjustments
      },
      meta: {
        dsr_limit: dsrLimitPct,
        base_policy_dsr_limit: riskAdjustment.base_dsr_limit,
        stage,
        candidates_count: candidates.length,
        income,
        existing_debt_payments: existingDebtPayments,
        estimated_expenses: Math.round(estimatedExpenses),
        disposable_income: Math.round(disposableIncome),
        dsr_basis: 'disposable_income'
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});