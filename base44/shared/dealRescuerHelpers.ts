// Shared math/pricing primitives for the Deal Rescuer engine — pure functions with
// no side effects, extracted out of entry.ts to remove duplication and keep the
// function file smaller. No behavior change from the original inline versions.

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// PMT calculation (standard amortization)
export const pmt = (principal, annualRate, months) => {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRate / 12;
  if (r <= 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
};

// Internal stress-test scenarios — run silently inside the engine and can downgrade
// a strategy's status. Not exposed to the UI as separate data.
const STRESS_SCENARIOS = [
  { incomeShock: 0.05, rateShock: 0.005 }, // mild: -5% income, +0.5% rate
  { incomeShock: 0.10, rateShock: 0.010 }  // moderate: -10% income, +1.0% rate
];

// High-exposure guard — large principals must survive stricter stress before approval.
export const HIGH_EXPOSURE_THRESHOLD = 200000; // ILS
export const VERY_HIGH_EXPOSURE_THRESHOLD = 400000;

export const runStressTest = ({ candidate, income, existingDebtPayments, estimatedExpenses, dsrLimit, requestedLoanAmount }) => {
  if (!income || income <= 0) return candidate.status;

  const principal = candidate.loanAmount;
  const rateDecimal = candidate.interestRate / 100;
  const isHighExposure = principal >= HIGH_EXPOSURE_THRESHOLD;
  const isVeryHighExposure = principal >= VERY_HIGH_EXPOSURE_THRESHOLD;

  const stressCeiling = isVeryHighExposure ? dsrLimit - 0.03
                      : isHighExposure ? dsrLimit
                      : dsrLimit + 0.05;

  let failures = 0;
  let severeFailure = false;

  for (const scenario of STRESS_SCENARIOS) {
    const stressedIncome = income * (1 - scenario.incomeShock);
    const stressedRate = Math.min(0.12, rateDecimal + scenario.rateShock);
    const stressedPayment = pmt(principal, stressedRate, candidate.termMonths);
    const stressedDisposable = stressedIncome - estimatedExpenses;
    if (stressedDisposable <= 0) { failures += 1; severeFailure = true; continue; }
    const stressedDsr = stressedPayment / stressedDisposable;

    if (stressedDsr > stressCeiling) failures += 1;
    if (stressedDsr > dsrLimit + 0.10) severeFailure = true;
  }

  if (isVeryHighExposure && failures > 0) {
    return severeFailure ? 'rejected' : 'conditional';
  }

  if (isHighExposure && failures > 0) {
    if (candidate.status === 'approved') return 'conditional';
    if (candidate.status === 'conditional' || severeFailure) return 'rejected';
  }

  if (severeFailure) {
    if (candidate.status === 'approved') return 'conditional';
    if (candidate.status === 'conditional') return 'rejected';
  } else if (failures >= STRESS_SCENARIOS.length) {
    if (candidate.status === 'approved') return 'conditional';
  }

  return candidate.status;
};

// ─── Profit Engine: PD · Risk Premium · Expected Value ─────────────────────────
// PD model — LINEAR & EXPLAINABLE, bounded ∈ [pd0, 0.55].
export const computePD = ({ dsr, trust, flagCount, runwayMonths, volatilityHigh, pdCoeffs }) => {
  const pd0 = Number(pdCoeffs.base ?? 0.02);
  const alpha = Number(pdCoeffs.dsrCoeff ?? 0.5);
  const beta = Number(pdCoeffs.trustCoeff ?? 0.3);
  const gamma = Number(pdCoeffs.flagsCoeff ?? 0.05);
  const delta = Number(pdCoeffs.runwayCoeff ?? 0.04);
  const epsilon = Number(pdCoeffs.volatilityCoeff ?? 0.04);

  const trustGap = clamp(1 - clamp(Number(trust ?? 0.5), 0, 1), 0, 1);
  const runwayPenalty = (Number.isFinite(runwayMonths) && runwayMonths < 3)
    ? clamp((3 - runwayMonths) / 3, 0, 1)
    : 0;
  const volatilityPenalty = volatilityHigh ? 1 : 0;

  const pd = pd0
    + alpha * clamp(dsr, 0, 1)
    + beta * trustGap
    + gamma * Math.max(0, flagCount)
    + delta * runwayPenalty
    + epsilon * volatilityPenalty;

  return clamp(pd, pd0, 0.55);
};

// Expected Value of a loan over its full term.
export const computeExpectedValue = ({ principal, monthlyPayment, termMonths, pd, lgd }) => {
  const totalRevenue = monthlyPayment * termMonths - principal;
  const expectedLoss = pd * principal * lgd;
  const survivalProbability = 1 - pd;
  return survivalProbability * totalRevenue - expectedLoss;
};

// Risk Premium — extra rate needed above base to compensate the lender for expected loss.
export const computeRiskPremium = ({ pd, lgd }) => {
  if (pd >= 0.99) return 0.5; // saturated
  return clamp((pd * lgd) / (1 - pd), 0, 0.5);
};

// Shared risk-signal extraction — used identically by both the standard grid search
// and the aggressive-approval search so the PD model always sees the same inputs.
export const extractRiskSignals = (insights) => ({
  trust: clamp(Number(insights?.cashFlowTrustScore ?? 0.5), 0, 1),
  flagCount: Array.isArray(insights?.riskFlags) ? insights.riskFlags.length : 0,
  volatilityHigh: !!insights?.incomeVolatility?.isHigh
});

// Shared profit-engine bundle (PD, EV, revenue/loss, risk premium, profit thresholds).
export const computeProfitMetrics = ({ netLoan, monthlyPayment, termMonths, dsr, trust, flagCount, runwayMonths, volatilityHigh, pdCoeffs, lgd, minExpectedProfitMargin }) => {
  const pd = computePD({ dsr, trust, flagCount, runwayMonths, volatilityHigh, pdCoeffs });
  const ev = computeExpectedValue({ principal: netLoan, monthlyPayment, termMonths, pd, lgd });
  const totalRevenue = monthlyPayment * termMonths - netLoan;
  const expectedLoss = pd * netLoan * lgd;
  const riskPremium = computeRiskPremium({ pd, lgd });
  const minProfit = netLoan * minExpectedProfitMargin;
  const evRejectThreshold = -netLoan * 0.05;
  return { pd, ev, totalRevenue, expectedLoss, riskPremium, minProfit, evRejectThreshold };
};

// Stage 3 — dynamic rate adjustment from analysisInsights.
export const adjustRate = (baseRate, insights, pricingCoeffs = {}, riskCtx = null) => {
  if (!insights) return baseRate;
  let rate = baseRate;
  const riskLevel = String(insights.riskLevel || '').toLowerCase();
  if (riskLevel === 'high') rate += 0.015;
  if (riskLevel === 'low') rate -= 0.005;
  if (Number(insights.liquidityMonths) > 3) rate -= 0.005;
  if (Number(insights.behavioralScore) >= 0.6) rate -= 0.005;

  const k1 = Number(pricingCoeffs.k1 ?? 0.02);
  const k2 = Number(pricingCoeffs.k2 ?? 0.005);
  const trust = clamp(Number(insights.cashFlowTrustScore ?? 0), 0, 1);
  const flagCount = Array.isArray(insights.riskFlags) ? insights.riskFlags.length : 0;
  rate = rate - k1 * trust + k2 * flagCount;

  if (riskCtx && Number.isFinite(riskCtx.pd) && Number.isFinite(riskCtx.lgd)) {
    const premium = computeRiskPremium({ pd: riskCtx.pd, lgd: riskCtx.lgd });
    rate = Math.max(rate, baseRate + premium * 0.5);
  }

  return clamp(rate, 0.05, 0.18);
};

// ─── β calibration — realistic "belt-tightening" model ────────────────────────
export const calibrateBeta = ({ trustScore, confidence, incomeVolatilityHigh, guardrails }) => {
  const trust = clamp(Number(trustScore ?? 0.5), 0, 1);
  let beta = 0.15 + 0.20 * trust;

  if (incomeVolatilityHigh) beta *= 0.7;

  const conf = clamp(Number(confidence ?? 1), 0, 1);
  beta = beta * (0.5 + 0.5 * conf);

  const minCut = Number(guardrails?.min ?? 0.20);
  const maxCut = Number(guardrails?.max ?? 0.70);
  return clamp(beta, minCut, maxCut);
};

// ─── Behavioral ramp factor — gradual adoption over months 1-3 ────────────────
export const computeRampFactor = () => {
  const monthlyRamp = [0.3, 0.6, 1.0];
  return monthlyRamp.reduce((a, b) => a + b, 0) / monthlyRamp.length; // = 0.633
};

// ─── Tiered discretionary cut — easy/medium/hard elasticity buckets ───────────
export const applyTieredCut = (breakdown, totalDiscretionary, beta) => {
  if (!breakdown || (breakdown.easy === 0 && breakdown.medium === 0 && breakdown.hard === 0)) {
    return {
      adjustedDiscretionary: totalDiscretionary * (1 - beta),
      tiers: null
    };
  }
  const easy = Number(breakdown.easy ?? 0);
  const medium = Number(breakdown.medium ?? 0);
  const hard = Number(breakdown.hard ?? 0);
  const adjusted =
    easy * (1 - beta) +
    medium * (1 - beta * 0.6) +
    hard * (1 - beta * 0.3);
  return {
    adjustedDiscretionary: adjusted,
    tiers: {
      easy: { original: Math.round(easy), adjusted: Math.round(easy * (1 - beta)), cut_pct: Number((beta * 100).toFixed(1)) },
      medium: { original: Math.round(medium), adjusted: Math.round(medium * (1 - beta * 0.6)), cut_pct: Number((beta * 60).toFixed(1)) },
      hard: { original: Math.round(hard), adjusted: Math.round(hard * (1 - beta * 0.3)), cut_pct: Number((beta * 30).toFixed(1)) }
    }
  };
};

// ─── DSR-Based Pricing Tiers ────────────────────────────────────────────────────
export const tierForDsr = (dsr, tiers) => {
  if (dsr <= tiers.A.maxDsr) return 'A';
  if (dsr <= tiers.B.maxDsr) return 'B';
  if (dsr <= tiers.C.maxDsr) return 'C';
  return 'D';
};

// Quality factor (0..1): 0 = best client (tier-min rate), 1 = worst client (tier-max rate).
export const qualityFactor = (insights) => {
  if (!insights) return 0.5;
  let score = 0.5;

  const trust = clamp(Number(insights.cashFlowTrustScore ?? 0.5), 0, 1);
  score -= (trust - 0.5) * 0.6;

  const flagCount = Array.isArray(insights.riskFlags) ? insights.riskFlags.length : 0;
  score += Math.min(0.3, flagCount * 0.1);

  const anchorCount = Array.isArray(insights.stabilityAnchors) ? insights.stabilityAnchors.length : 0;
  score -= Math.min(0.2, anchorCount * 0.05);

  const liquidity = Number(insights.liquidityMonths);
  if (Number.isFinite(liquidity)) {
    if (liquidity >= 3) score -= 0.1;
    else if (liquidity < 1) score += 0.1;
  }

  return clamp(score, 0, 1);
};

// Map a (tier, qualityFactor) pair to an actual interest rate.
export const rateForTier = (tier, qf, tiers) => {
  if (tier === 'D') return null;
  const band = tiers[tier];
  return band.minRate + (band.maxRate - band.minRate) * qf;
};

// ─── Dynamic Risk-Adjustment Layer ─────────────────────────────────────────────
// Adjusts the DSR ceiling around the company policy threshold based on applicant
// quality signals. The company policy itself is NEVER overridden.
export const computeAdjustedDsrLimit = (basePolicyLimit, insights) => {
  const baseDsrLimitPct = Math.round(basePolicyLimit * 1000) / 10;
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

  const riskLevel = String(insights.riskLevel || '').toLowerCase();
  if (riskLevel === 'low') {
    adjustedPct += 2;
    adjustments.push('risk level +2%');
  } else if (riskLevel === 'high') {
    adjustedPct -= 5;
    adjustments.push('risk level -5%');
  }

  const cashFlowTrust = Number(insights.cashFlowTrustScore);
  if (Number.isFinite(cashFlowTrust)) {
    if (cashFlowTrust >= 0.75) {
      adjustedPct += 4;
      adjustments.push('cash-flow trust +4%');
    } else if (cashFlowTrust >= 0.55) {
      adjustedPct += 2;
      adjustments.push('cash-flow trust +2%');
    } else if (cashFlowTrust < 0.30) {
      adjustedPct -= 4;
      adjustments.push('cash-flow trust -4%');
    }
  }

  const anchorCount = Array.isArray(insights.stabilityAnchors) ? insights.stabilityAnchors.length : 0;
  if (anchorCount > 0) {
    const anchorBonus = Math.min(5, anchorCount * 1.5);
    adjustedPct += anchorBonus;
    adjustments.push(`stability anchors +${anchorBonus.toFixed(1)}% (${anchorCount} anchors)`);
  }

  const flagCount = Array.isArray(insights.riskFlags) ? insights.riskFlags.length : 0;
  if (flagCount > 0) {
    const flagPenalty = Math.min(8, flagCount * 3);
    adjustedPct -= flagPenalty;
    adjustments.push(`risk flags -${flagPenalty.toFixed(1)}% (${flagCount} flags)`);
  }

  adjustedPct = Math.min(65, Math.max(30, adjustedPct));

  return {
    adjustedLimit: adjustedPct / 100,
    base_dsr_limit: baseDsrLimitPct,
    adjusted_dsr_limit: Number(adjustedPct.toFixed(1)),
    adjustments
  };
};

// ─── Frontloaded amortization schedule ───────────────────────────────────────
export const buildFrontloadedSchedule = (principal, annualRatePct, termMonths, { boostMonths = 6, boostPct = 0.30 } = {}) => {
  if (!principal || principal <= 0 || !termMonths || termMonths < 2) return null;
  const r = (annualRatePct / 100) / 12;
  const flat = pmt(principal, annualRatePct / 100, termMonths);
  const boost = Math.round(flat * (1 + boostPct));

  let bal = principal;
  const schedule = [];
  const boostN = Math.min(boostMonths, Math.max(1, Math.floor(termMonths / 2)));

  for (let m = 1; m <= boostN; m++) {
    const interest = bal * r;
    const principalPaid = Math.max(0, boost - interest);
    bal = Math.max(0, bal - principalPaid);
    schedule.push({ month: m, payment: boost, interest: Math.round(interest), principal: Math.round(principalPaid), balance: Math.round(bal) });
    if (bal <= 0) break;
  }

  const remainingMonths = termMonths - schedule.length;
  if (remainingMonths > 0 && bal > 0) {
    const flatTail = Math.round(pmt(bal, annualRatePct / 100, remainingMonths));
    for (let m = schedule.length + 1; m <= termMonths; m++) {
      const interest = bal * r;
      const principalPaid = Math.max(0, flatTail - interest);
      bal = Math.max(0, bal - principalPaid);
      schedule.push({ month: m, payment: flatTail, interest: Math.round(interest), principal: Math.round(principalPaid), balance: Math.round(bal) });
      if (bal <= 0) break;
    }
  }

  return {
    boost_months: boostN,
    boost_pct: boostPct,
    boost_payment: boost,
    tail_payment: schedule[schedule.length - 1]?.payment ?? flat,
    flat_equivalent: Math.round(flat),
    total_paid: schedule.reduce((s, x) => s + x.payment, 0),
    months_to_half_principal: (() => {
      const target = principal * 0.5;
      let cum = 0;
      for (const row of schedule) {
        cum += row.principal;
        if (cum >= target) return row.month;
      }
      return schedule.length;
    })(),
    schedule_preview: schedule.slice(0, 12)
  };
};

// ─── Liquidity Runway gate ────────────────────────────────────────────────────
export const applyLiquidityRunwayGate = (strategies, runwayMonths, minRunway) => {
  if (!Number.isFinite(runwayMonths) || runwayMonths >= minRunway) return { strategies, gated: false };
  return {
    strategies: strategies.map(s => ({
      ...s,
      status: s.status === 'approved' ? 'conditional' : s.status
    })),
    gated: true
  };
};

// Load the full underwriting policy from UnderwritingRule. Returns DSR limit,
// β guardrails, liquidity-runway floor, pricing coefficients, DSR tiers,
// and stretch-offer policy — with safe defaults.
export const loadPolicy = async (base44) => {
  const defaults = {
    dsrLimit: 0.4,
    betaGuardrails: { min: 0.20, max: 0.70 },
    minLiquidityRunwayMonths: 3,
    pricingCoeffs: { k1: 0.02, k2: 0.005 },
    tiers: {
      A: { maxDsr: 45, minRate: 7,  maxRate: 9  },
      B: { maxDsr: 55, minRate: 9,  maxRate: 12 },
      C: { maxDsr: 65, minRate: 12, maxRate: 16 }
    },
    stretch: { enabled: true, minTrust: 0.4, minRunway: 2, maxFlags: 2 },
    pdCoeffs: { base: 0.02, dsrCoeff: 0.5, trustCoeff: 0.3, flagsCoeff: 0.05, runwayCoeff: 0.04, volatilityCoeff: 0.04 },
    lgd: 0.6,
    minExpectedProfitMargin: 0.02,
    aggressive: { enabled: true, maxDsr: 70, minRate: 14, maxRate: 18 }
  };
  try {
    const rules = await base44.asServiceRole.entities.UnderwritingRule.list();
    const r = rules?.[0];
    if (!r) return defaults;
    const max = Number(r.max_dti_approve);
    const num = (v, dflt) => Number.isFinite(Number(v)) ? Number(v) : dflt;
    return {
      dsrLimit: Number.isFinite(max) && max > 0 && max < 100 ? max / 100 : defaults.dsrLimit,
      betaGuardrails: {
        min: num(r.min_discretionary_cut_pct, defaults.betaGuardrails.min * 100) / 100,
        max: num(r.max_discretionary_cut_pct, defaults.betaGuardrails.max * 100) / 100
      },
      minLiquidityRunwayMonths: num(r.min_liquidity_runway_months, defaults.minLiquidityRunwayMonths),
      pricingCoeffs: {
        k1: num(r.pricing_trust_discount_k1, defaults.pricingCoeffs.k1),
        k2: num(r.pricing_risk_premium_k2, defaults.pricingCoeffs.k2)
      },
      tiers: {
        A: {
          maxDsr:  num(r.pricing_tier_a_max_dsr,  defaults.tiers.A.maxDsr),
          minRate: num(r.pricing_tier_a_min_rate, defaults.tiers.A.minRate),
          maxRate: num(r.pricing_tier_a_max_rate, defaults.tiers.A.maxRate)
        },
        B: {
          maxDsr:  num(r.pricing_tier_b_max_dsr,  defaults.tiers.B.maxDsr),
          minRate: num(r.pricing_tier_b_min_rate, defaults.tiers.B.minRate),
          maxRate: num(r.pricing_tier_b_max_rate, defaults.tiers.B.maxRate)
        },
        C: {
          maxDsr:  num(r.pricing_tier_c_max_dsr,  defaults.tiers.C.maxDsr),
          minRate: num(r.pricing_tier_c_min_rate, defaults.tiers.C.minRate),
          maxRate: num(r.pricing_tier_c_max_rate, defaults.tiers.C.maxRate)
        }
      },
      stretch: {
        enabled: r.enable_stretch_offer !== false,
        minTrust: num(r.stretch_min_trust_score, defaults.stretch.minTrust),
        minRunway: num(r.stretch_min_runway_months, defaults.stretch.minRunway),
        maxFlags: num(r.stretch_max_risk_flags, defaults.stretch.maxFlags)
      },
      pdCoeffs: {
        base:           num(r.pd_base,                  defaults.pdCoeffs.base),
        dsrCoeff:       num(r.pd_dsr_coefficient,       defaults.pdCoeffs.dsrCoeff),
        trustCoeff:     num(r.pd_trust_coefficient,     defaults.pdCoeffs.trustCoeff),
        flagsCoeff:     num(r.pd_flags_coefficient,     defaults.pdCoeffs.flagsCoeff),
        runwayCoeff:    num(r.pd_runway_coefficient,    defaults.pdCoeffs.runwayCoeff),
        volatilityCoeff: num(r.pd_volatility_coefficient, defaults.pdCoeffs.volatilityCoeff)
      },
      lgd: num(r.lgd, defaults.lgd),
      minExpectedProfitMargin: num(r.min_expected_profit_margin, defaults.minExpectedProfitMargin),
      aggressive: {
        enabled: r.enable_aggressive_approval !== false,
        maxDsr:  num(r.aggressive_max_dsr,  defaults.aggressive.maxDsr),
        minRate: num(r.aggressive_min_rate, defaults.aggressive.minRate),
        maxRate: num(r.aggressive_max_rate, defaults.aggressive.maxRate)
      }
    };
  } catch (e) {
    console.warn('dealRescuerEngine: could not load UnderwritingRule, using defaults', e);
    return defaults;
  }
};