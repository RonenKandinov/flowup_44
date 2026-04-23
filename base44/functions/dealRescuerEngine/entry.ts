import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// PMT calculation (standard amortization)
const pmt = (principal, annualRate, months) => {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRate / 12;
  if (r <= 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
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
const gridSearch = ({ income, existingDebtPayments, requestedLoanAmount, baseInterestRate, insights, maxDownPayment, stage, dsrLimit }) => {
  const adjustedBase = adjustRate(baseInterestRate, insights);
  const DSR_LIMIT = dsrLimit;
  const DSR_NEAR = dsrLimit + 0.05; // 5pp above the policy threshold = "קרוב מאוד" לסף
  const behavioralFlex = insights?.isFalseNegative || Number(insights?.behavioralScore) >= 0.6;

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
          const dsr = income > 0 ? (existingDebtPayments + monthlyPayment) / income : 1;

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
const pickStrategies = (candidates, requestedLoanAmount, insights, dsrLimit) => {
  if (candidates.length === 0) return [];

  const withScore = candidates.map(c => ({ ...c, score: compositeScore(c, requestedLoanAmount, dsrLimit) }));

  const bestFor = (type) => {
    const ranked = [...withScore]
      .map(c => ({ c, s: strategyScore(type, c, requestedLoanAmount, insights, dsrLimit) }))
      .sort((a, b) => b.s - a.s);
    return ranked[0]?.c || null;
  };

  const primary = {
    cash_flow_alignment: bestFor('cash_flow_alignment'),
    exposure_reduction: bestFor('exposure_reduction'),
    behavioral_approval: bestFor('behavioral_approval')
  };

  // Distinctness: require meaningful differences between picks.
  const tooSimilar = (a, b) => {
    if (!a || !b) return false;
    const amountDiff = Math.abs(a.grossAmount - b.grossAmount) / Math.max(1, requestedLoanAmount);
    const termDiff = Math.abs(a.termMonths - b.termMonths);
    const rateDiff = Math.abs(a.interestRate - b.interestRate);
    const dpDiff = Math.abs(a.downPayment - b.downPayment) / Math.max(1, requestedLoanAmount);
    return amountDiff < 0.05 && termDiff < 12 && rateDiff < 0.5 && dpDiff < 0.05;
  };

  const order = ['cash_flow_alignment', 'exposure_reduction', 'behavioral_approval'];
  const chosen = {};
  for (const type of order) {
    let pick = primary[type];
    // If this pick is too similar to a previously-chosen one, find an alternative
    // that still maximizes this strategy's objective but is distinct.
    const ranked = [...withScore]
      .map(c => ({ c, s: strategyScore(type, c, requestedLoanAmount, insights, dsrLimit) }))
      .sort((a, b) => b.s - a.s);
    for (const { c } of ranked) {
      const conflict = Object.values(chosen).some(existing => tooSimilar(existing, c));
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

    // Load policy DSR threshold from UnderwritingRule — makes the engine responsive to Underwriting Settings.
    const dsrLimit = await loadPolicyDsrLimit(base44);
    const dsrLimitPct = Math.round(dsrLimit * 1000) / 10; // e.g. 0.4 → 40.0

    const currentDsr = income > 0 ? (existingDebtPayments / income) : 1;
    const currentScore = Number(body?.score || clamp(Math.round(85 - currentDsr * 100 * 0.7), 20, 85));
    const currentStatus = String(body?.currentStatus || (currentDsr <= dsrLimit ? 'approved' : currentDsr <= dsrLimit + 0.1 ? 'borderline' : 'rejected'));

    // Multi-stage search
    const { candidates, stage } = multiStageSearch({
      income,
      existingDebtPayments,
      requestedLoanAmount,
      baseInterestRate,
      insights,
      maxDownPayment,
      dsrLimit
    });

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
          const dsr = income > 0 ? (existingDebtPayments + monthlyPayment) / income : 1;
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
      meta: {
        dsr_limit: dsrLimitPct,
        stage,
        candidates_count: candidates.length,
        income,
        existing_debt_payments: existingDebtPayments
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});