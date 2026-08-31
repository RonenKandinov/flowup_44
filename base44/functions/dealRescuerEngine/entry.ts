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
    const stressedDisposable = stressedIncome - estimatedExpenses;
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

// ─── Profit Engine: PD · Risk Premium · Expected Value ─────────────────────────
// The non-bank lender's core question is NOT "is this customer safe?" — it's
// "is this loan PROFITABLE in expectation?". We model:
//
//   PD (Probability of Default) = pd0 + α·DSR + β·(1−trust) + γ·#flags + δ·runway_penalty
//   Total Interest = monthlyPayment × term − principal
//   Expected Loss  = PD × principal × LGD
//   Expected Value = (1 − PD) × Total Interest − PD × principal × LGD
//
// A loan is APPROVED only if EV > min_expected_profit (a small positive margin).
// This is what lets us approve a high-DSR customer at high rate (Tier C / aggressive)
// while REJECTING a low-DSR customer at low rate when the math doesn't work.

// PD model — LINEAR & EXPLAINABLE, bounded ∈ [pd0, 0.55].
// Each component contributes additively so a credit officer can read the breakdown.
//
//   pd = pd0 + α·DSR + β·(1−trust) + γ·#flags + δ·runway_penalty + ε·volatility
//
// We KEEP it linear (not logarithmic) on purpose:
//   ✓ explainable to humans and auditors
//   ✓ stable (small input change → small PD change)
//   ✓ tunable via UnderwritingRule coefficients
const computePD = ({ dsr, trust, flagCount, runwayMonths, volatilityHigh, pdCoeffs }) => {
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
// Returns positive number = expected profit, negative = expected loss.
const computeExpectedValue = ({ principal, monthlyPayment, termMonths, pd, lgd }) => {
  const totalRevenue = monthlyPayment * termMonths - principal;     // pure interest income
  const expectedLoss = pd * principal * lgd;                        // expected default loss
  const survivalProbability = 1 - pd;
  return survivalProbability * totalRevenue - expectedLoss;
};

// Risk Premium — what extra rate is needed ABOVE base to compensate the lender
// for the expected loss. Used as a transparency metric in XAI output.
//   premium ≈ PD × LGD / (1 − PD)   (annualized, simplified)
const computeRiskPremium = ({ pd, lgd }) => {
  if (pd >= 0.99) return 0.5; // saturated
  return clamp((pd * lgd) / (1 - pd), 0, 0.5);
};

// Stage 3 — dynamic rate adjustment from analysisInsights
// Combines:
//   1. Qualitative signals (risk level, liquidity, behavior)
//   2. Risk-based pricing:  rate = base − k1·trust + k2·#flags
//   3. Risk Premium floor:  rate must cover (PD × LGD) margin
const adjustRate = (baseRate, insights, pricingCoeffs = {}, riskCtx = null) => {
  if (!insights) return baseRate;
  let rate = baseRate;
  const riskLevel = String(insights.riskLevel || '').toLowerCase();
  if (riskLevel === 'high') rate += 0.015;
  if (riskLevel === 'low') rate -= 0.005;
  if (Number(insights.liquidityMonths) > 3) rate -= 0.005;
  if (Number(insights.behavioralScore) >= 0.6) rate -= 0.005;

  // Risk-based pricing component
  const k1 = Number(pricingCoeffs.k1 ?? 0.02);   // trust discount
  const k2 = Number(pricingCoeffs.k2 ?? 0.005);  // per-flag premium
  const trust = clamp(Number(insights.cashFlowTrustScore ?? 0), 0, 1);
  const flagCount = Array.isArray(insights.riskFlags) ? insights.riskFlags.length : 0;
  rate = rate - k1 * trust + k2 * flagCount;

  // Risk Premium floor — the rate must AT LEAST cover the expected loss
  // when riskCtx is provided (i.e., we know the candidate's PD).
  if (riskCtx && Number.isFinite(riskCtx.pd) && Number.isFinite(riskCtx.lgd)) {
    const premium = computeRiskPremium({ pd: riskCtx.pd, lgd: riskCtx.lgd });
    rate = Math.max(rate, baseRate + premium * 0.5); // half the premium is added as floor
  }

  return clamp(rate, 0.05, 0.18); // widened ceiling: aggressive tier can reach 18%
};

// ─── β calibration ────────────────────────────────────────────────────────────
// Realistic "belt-tightening" model: a borrower applying for a loan can cut
// roughly 25% of variable/discretionary spending — that's the empirical sweet
// spot between "no real change" and "starvation budget".
//
// Mapping:  β = 0.15 + 0.20 × trust   (then clamped to [min_cut, max_cut])
//   trust = 0   → β = 15%   (low trust, conservative cut)
//   trust = 0.5 → β = 25%   (typical applicant baseline)
//   trust = 1.0 → β = 35%   (high-trust upper bound before guardrails)
//
// Volatility & low-confidence both PENALISE β.
const calibrateBeta = ({ trustScore, confidence, incomeVolatilityHigh, guardrails }) => {
  const trust = clamp(Number(trustScore ?? 0.5), 0, 1);
  let beta = 0.15 + 0.20 * trust;

  // Volatility penalty — unstable income means we cannot rely on the borrower
  // to actually execute the cut consistently.
  if (incomeVolatilityHigh) beta *= 0.7;

  // Confidence scaling — sparse data → squeeze β toward the lower guardrail.
  const conf = clamp(Number(confidence ?? 1), 0, 1);
  beta = beta * (0.5 + 0.5 * conf); // confidence=0 → β halved; confidence=1 → β intact

  // Guardrails — hard floor & ceiling from policy.
  const minCut = Number(guardrails?.min ?? 0.20);
  const maxCut = Number(guardrails?.max ?? 0.70);
  return clamp(beta, minCut, maxCut);
};

// ─── Behavioral ramp factor ──────────────────────────────────────────────────
// Real borrowers don't change spending overnight. We model gradual adoption:
//   month 1 → 30% of β  ;  month 2 → 60%  ;  month 3+ → 100%
// For the UNDERWRITING decision we average the ramp over the loan's first
// 3 months — that's the period where default risk is concentrated.
const computeRampFactor = () => {
  const monthlyRamp = [0.3, 0.6, 1.0];
  return monthlyRamp.reduce((a, b) => a + b, 0) / monthlyRamp.length; // = 0.633
};

// ─── Tiered discretionary cut ────────────────────────────────────────────────
// Different categories have different elasticity:
//   • easy   (subscriptions, streaming) → can cut up to β
//   • medium (dining, shopping)         → can cut up to 0.6β
//   • hard   (fuel, transport, pharmacy)→ can cut up to 0.3β
// If we don't have a breakdown, fall back to single-bucket β.
const applyTieredCut = (breakdown, totalDiscretionary, beta) => {
  if (!breakdown || (breakdown.easy === 0 && breakdown.medium === 0 && breakdown.hard === 0)) {
    // No breakdown → uniform β
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

// ─── DSR-Based Pricing Tiers ───────────────────────────────────────────────────
// Non-bank approach: DSR is NOT a binary gate, it's a PRICING ENGINE.
// Each DSR band maps to a different (Tier, rate range) — letting us approve
// borderline customers at higher rates instead of rejecting them outright.
//
//   Tier A (Prime)     → DSR ≤ 45%   → 7-9%
//   Tier B (Near Prime) → DSR ≤ 55%   → 9-12%
//   Tier C (Subprime)  → DSR ≤ 65%   → 12-16%   ← Stretch zone
//   Tier D (Reject)    → DSR > 65%   → reject
//
// Customer-quality signals (trust, anchors, flags) shift the rate WITHIN
// each tier's band — best clients pay tier-min, worst pay tier-max.
const tierForDsr = (dsr, tiers) => {
  if (dsr <= tiers.A.maxDsr) return 'A';
  if (dsr <= tiers.B.maxDsr) return 'B';
  if (dsr <= tiers.C.maxDsr) return 'C';
  return 'D';
};

// Compute a quality factor (0..1) used to position the rate within the tier band.
// 0 = best client (trust high, no flags) → tier-min rate
// 1 = worst client                       → tier-max rate
const qualityFactor = (insights) => {
  if (!insights) return 0.5;
  let score = 0.5; // neutral starting point

  const trust = clamp(Number(insights.cashFlowTrustScore ?? 0.5), 0, 1);
  // Trust above 0.6 reduces score (better rate); below 0.4 increases it
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
const rateForTier = (tier, qf, tiers) => {
  if (tier === 'D') return null; // reject — no rate
  const band = tiers[tier];
  // qf=0 → min rate, qf=1 → max rate
  return band.minRate + (band.maxRate - band.minRate) * qf;
};

// Stage 2 — Grid search within stage constraints
// NOW USES DSR-BASED PRICING + EXPECTED VALUE FILTER:
//   1. rate is determined by the DSR band (Tier A/B/C)
//   2. each candidate's PD is computed from DSR + trust + flags + runway
//   3. candidates with EV < min_expected_profit are FILTERED OUT
// This is the core of the Profit Engine — we approve based on profitability,
// not just on capacity.
const gridSearch = ({ income, existingDebtPayments, estimatedExpenses, requestedLoanAmount, baseInterestRate, insights, maxDownPayment, stage, dsrLimit, pricingCoeffs, tiers, pdCoeffs, lgd, minExpectedProfitMargin, runwayMonths }) => {
  const DSR_LIMIT = dsrLimit;
  // Widened "approval zone" — non-bank lenders accept up to +15pp above policy
  // when the client falls into a higher pricing tier. This is what unlocks
  // the +20-40% approval boost — but pricing rises in step with risk.
  const DSR_NEAR = Math.min(dsrLimit + 0.15, tiers.C.maxDsr);
  const behavioralFlex = insights?.isFalseNegative || Number(insights?.behavioralScore) >= 0.6;
  const qf = qualityFactor(insights);

  // CRITICAL: DSR is computed against DISPOSABLE income (income − living expenses).
  // Existing debt payments are already included inside estimatedExpenses (they come
  // from loanLogicV2's totalExpenses, which classifies loan repayments as fixed expenses) —
  // subtracting existingDebtPayments again here double-counted the same debt.
  // If disposable is non-positive, the client cannot service ANY new debt — short-circuit.
  const disposableIncome = income - estimatedExpenses;
  if (disposableIncome <= 0) return [];

  // Stage-bound term and amount ratios
  const allTerms = [24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84];
  const terms = allTerms.filter(t => t <= stage.maxTerm);
  const amountRatios = [1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5]
    .filter(r => r >= stage.minAmountRatio);
  const downPaymentRatios = [0, 0.05, 0.1, 0.15, 0.2];

  const dpCap = Number.isFinite(maxDownPayment) && maxDownPayment > 0 ? maxDownPayment : Infinity;
  const trust = clamp(Number(insights?.cashFlowTrustScore ?? 0.5), 0, 1);
  const flagCount = Array.isArray(insights?.riskFlags) ? insights.riskFlags.length : 0;
  const volatilityHigh = !!insights?.incomeVolatility?.isHigh;
  const candidates = [];

  for (const term of terms) {
    for (const ratio of amountRatios) {
      for (const dp of downPaymentRatios) {
        const grossAmount = requestedLoanAmount * ratio;
        let downPayment = Math.round(grossAmount * dp);
        if (downPayment > dpCap) downPayment = Math.floor(dpCap);
        const netLoan = grossAmount - downPayment;
        if (netLoan <= 0) continue;

        // Two-pass: estimate DSR with a mid-tier rate, then derive final tier+rate.
        // We iterate once because tier depends on DSR which depends on rate.
        let estRate = (tiers.B.minRate + tiers.B.maxRate) / 2 / 100;
        let estPayment = pmt(netLoan, estRate, term);
        let estDsr = estPayment / disposableIncome;
        let tier = tierForDsr(estDsr * 100, tiers);
        if (tier === 'D') continue; // out of approval band

        let rate = rateForTier(tier, qf, tiers) / 100;
        let monthlyPayment = pmt(netLoan, rate, term);
        let dsr = monthlyPayment / disposableIncome;

        // Re-check tier with the actual rate — if the rate moved DSR into a new band,
        // recompute once. This converges fast since rate range per tier is ~3%.
        const finalTier = tierForDsr(dsr * 100, tiers);
        if (finalTier !== tier && finalTier !== 'D') {
          tier = finalTier;
          rate = rateForTier(tier, qf, tiers) / 100;
          monthlyPayment = pmt(netLoan, rate, term);
          dsr = monthlyPayment / disposableIncome;
        }
        if (tierForDsr(dsr * 100, tiers) === 'D') continue;

        // ─── PROFIT ENGINE — EV is a RANKING signal, not a hard filter ────
        // Old approach (rejected by CTO):  if (EV < minProfit) skip
        // New approach: EV influences STATUS, not existence.
        //   • EV ≥ minProfit  → keep tier-based status (approved / conditional)
        //   • 0 ≤ EV < minProfit → downgrade approved → conditional (marginal profit)
        //   • EV_REJECT_THRESHOLD < EV < 0 → conditional (small expected loss, may still write)
        //   • EV ≤ EV_REJECT_THRESHOLD → REJECT (deep expected loss — uneconomic)
        //
        // The threshold scales with principal so a -₪500 EV on a ₪10K loan
        // is treated more strictly than a -₪500 EV on a ₪200K loan.
        const pd = computePD({ dsr, trust, flagCount, runwayMonths, volatilityHigh, pdCoeffs });
        const ev = computeExpectedValue({
          principal: netLoan,
          monthlyPayment,
          termMonths: term,
          pd,
          lgd
        });
        const minProfit = netLoan * minExpectedProfitMargin;
        const evRejectThreshold = -netLoan * 0.05; // 5% of principal — deep loss line

        if (ev <= evRejectThreshold) continue; // deep expected loss — uneconomic

        // Tier-based status FIRST, then profit signal can downgrade (never upgrade).
        let status;
        if (dsr <= DSR_LIMIT) {
          status = 'approved';
        } else if (dsr <= DSR_NEAR && (behavioralFlex || tier === 'C')) {
          status = 'conditional';
        } else {
          continue;
        }
        // Profit-aware downgrade: marginal/negative EV → conditional, BUT only when
        // DSR is actually close to the policy ceiling. When DSR is comfortably below
        // the limit (≥ 10pp of headroom), the loan is structurally safe and the
        // status should remain 'approved' regardless of marginal EV — profit concerns
        // are surfaced via the XAI panel and pricing engine, not via UI status.
        const dsrHeadroom = DSR_LIMIT - dsr;
        if (ev < minProfit && status === 'approved' && dsrHeadroom < 0.10) {
          status = 'conditional';
        }

        const totalRevenue = monthlyPayment * term - netLoan;
        const expectedLoss = pd * netLoan * lgd;
        const riskPremium = computeRiskPremium({ pd, lgd });

        candidates.push({
          loanAmount: Math.round(netLoan),
          grossAmount: Math.round(grossAmount),
          termMonths: term,
          interestRate: Number((rate * 100).toFixed(2)),
          downPayment,
          monthlyPayment: Math.round(monthlyPayment),
          dsr: Number(dsr.toFixed(4)),
          status,
          tier,
          amountRatio: ratio,
          // Profit Engine fields:
          pd: Number(pd.toFixed(4)),
          expectedValue: Math.round(ev),
          totalRevenue: Math.round(totalRevenue),
          expectedLoss: Math.round(expectedLoss),
          riskPremium: Number((riskPremium * 100).toFixed(2)),
          profitMargin: Number((ev / netLoan).toFixed(4))
        });
      }
    }
  }
  return candidates;
};

// Multi-stage search: run stages in order, stop when we have PROFITABLE candidates
// (gridSearch internally filters out EV-negative candidates).
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

// ─── Aggressive Approval Search (formerly Stretch) ──────────────────────────────
// "aggressive_approval" = a high-rate, high-DSR product for clients who would be
// REJECTED under standard tiers but generate POSITIVE EXPECTED VALUE at premium
// rates. This is the key differentiator of non-bank lenders: the willingness to
// price risk explicitly when the math says it's profitable.
//
// Eligibility (still gated by reality — we don't lend to the fragile):
//   • Sufficient cash-flow trust (≥ stretch_min_trust_score)
//   • Sufficient liquidity runway (≥ stretch_min_runway_months)
//   • Few risk flags (≤ stretch_max_risk_flags)
//   • Loan must clear EV > min_profit_margin × principal
//
// Differs from standard tiers by:
//   • Searching ABOVE requested amount (up to 120%)
//   • Using EXTENDED DSR ceiling (up to aggressive_max_dsr, default 70%)
//   • Pricing in the [aggressive_min_rate, aggressive_max_rate] band (14-18%)
//   • Status is always 'conditional' — never auto-approved
const isEligibleForStretch = ({ insights, runwayMonths, stretchPolicy }) => {
  if (!stretchPolicy.enabled) return false;
  const trust = Number(insights?.cashFlowTrustScore ?? 0);
  if (trust < stretchPolicy.minTrust) return false;

  const flagCount = Array.isArray(insights?.riskFlags) ? insights.riskFlags.length : 0;
  if (flagCount > stretchPolicy.maxFlags) return false;

  // Runway is critical — aggressive cannot be offered to fragile borrowers
  if (Number.isFinite(runwayMonths) && runwayMonths < stretchPolicy.minRunway) return false;

  return true;
};

const aggressiveApprovalSearch = ({ income, existingDebtPayments, estimatedExpenses, requestedLoanAmount, insights, maxDownPayment, aggressivePolicy, pdCoeffs, lgd, minExpectedProfitMargin, runwayMonths }) => {
  if (!aggressivePolicy.enabled) return null;
  // Existing debt is already inside estimatedExpenses — see gridSearch comment above.
  const disposableIncome = income - estimatedExpenses;
  if (disposableIncome <= 0) return null;

  const qf = qualityFactor(insights);
  const trust = clamp(Number(insights?.cashFlowTrustScore ?? 0.5), 0, 1);
  const flagCount = Array.isArray(insights?.riskFlags) ? insights.riskFlags.length : 0;
  const volatilityHigh = !!insights?.incomeVolatility?.isHigh;

  // Rate is positioned in the aggressive band based on quality factor
  const aggressiveRate = (aggressivePolicy.minRate + (aggressivePolicy.maxRate - aggressivePolicy.minRate) * qf) / 100;
  const dsrCeiling = aggressivePolicy.maxDsr / 100;

  // ── Risk-based STRUCTURE adjustment (not just rate) ──
  // CTO direction: a true non-bank lender hedges risk via term + amount + DP, not only price.
  // High-risk profile (low trust OR ≥2 flags OR short runway) → extend term, shrink amount.
  const isHighRisk = trust < 0.5 || flagCount >= 2 || (Number.isFinite(runwayMonths) && runwayMonths < 3);
  const baseTerms = [60, 72, 84];
  const terms = isHighRisk ? [72, 84, 96] : baseTerms; // +12 months in high-risk
  // CTO direction: the engine may only offer AT MOST the requested amount — never more.
  // Ratios stay ≤ 1.0; high-risk profiles shrink the amount further.
  const baseRatios = [1.0, 0.95, 0.9, 0.85, 0.8];
  const ratios = isHighRisk ? baseRatios.map(r => r * 0.9) : baseRatios; // shrink amount by 10%
  const dpCap = Number.isFinite(maxDownPayment) && maxDownPayment > 0 ? maxDownPayment : Infinity;

  const candidates = [];
  for (const term of terms) {
    for (const ratio of ratios) {
      const grossAmount = requestedLoanAmount * ratio;
      const downPayment = 0; // aggressive product has no down payment
      const netLoan = grossAmount - downPayment;
      if (netLoan <= 0 || downPayment > dpCap) continue;

      const monthlyPayment = pmt(netLoan, aggressiveRate, term);
      const dsr = monthlyPayment / disposableIncome;

      if (dsr > dsrCeiling) continue; // beyond approval ceiling

      // PROFIT ENGINE — EV as ranking, not filter.
      // Aggressive product still rejects on DEEP expected loss, but allows
      // small/marginal losses (small EV < 0) to keep the dealflow alive.
      const pd = computePD({ dsr, trust, flagCount, runwayMonths, volatilityHigh, pdCoeffs });
      const ev = computeExpectedValue({
        principal: netLoan,
        monthlyPayment,
        termMonths: term,
        pd,
        lgd
      });
      const minProfit = netLoan * minExpectedProfitMargin;
      const evRejectThreshold = -netLoan * 0.05;
      if (ev <= evRejectThreshold) continue; // deep loss only

      const totalRevenue = monthlyPayment * term - netLoan;
      const expectedLoss = pd * netLoan * lgd;
      const riskPremium = computeRiskPremium({ pd, lgd });

      candidates.push({
        loanAmount: Math.round(netLoan),
        grossAmount: Math.round(grossAmount),
        termMonths: term,
        interestRate: Number((aggressiveRate * 100).toFixed(2)),
        downPayment: 0,
        monthlyPayment: Math.round(monthlyPayment),
        dsr: Number(dsr.toFixed(4)),
        status: 'conditional', // always conditional — credit officer review required
        tier: 'C',
        amountRatio: ratio,
        isStretch: true,
        isAggressive: true,
        pd: Number(pd.toFixed(4)),
        expectedValue: Math.round(ev),
        totalRevenue: Math.round(totalRevenue),
        expectedLoss: Math.round(expectedLoss),
        riskPremium: Number((riskPremium * 100).toFixed(2)),
        profitMargin: Number((ev / netLoan).toFixed(4))
      });
    }
  }

  if (candidates.length === 0) return null;
  // Pick the aggressive offer with HIGHEST EXPECTED VALUE — pure profit maximization
  candidates.sort((a, b) => b.expectedValue - a.expectedValue);
  return candidates[0];
};

// ─── Liquidity Runway gate ────────────────────────────────────────────────────
// Even if DSR is healthy, a borrower with <minRunway months of survival before
// running out of cash is fragile. We DOWNGRADE every approved strategy in this
// case — ensures that "clean DSR but 1-month buffer" applicants don't slip through.
const applyLiquidityRunwayGate = (strategies, runwayMonths, minRunway) => {
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
const loadPolicy = async (base44) => {
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

  // ── Cash-flow trust adjustment (granular OpenFinance signal) ────
  // Higher trust score = stronger evidence of real repayment capacity from
  // recurring income/savings/utility payments. This widens the band for clients
  // with verifiable financial discipline, and tightens it for those with overdraft flags.
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

  // ── Stability anchors bonus ────
  // Each verified anchor (recurring rent, utilities, savings, salary) adds
  // a small bonus — capped at +5% so it cannot dominate.
  const anchorCount = Array.isArray(insights.stabilityAnchors) ? insights.stabilityAnchors.length : 0;
  if (anchorCount > 0) {
    const anchorBonus = Math.min(5, anchorCount * 1.5);
    adjustedPct += anchorBonus;
    adjustments.push(`stability anchors +${anchorBonus.toFixed(1)}% (${anchorCount} anchors)`);
  }

  // ── Risk flags penalty ────
  const flagCount = Array.isArray(insights.riskFlags) ? insights.riskFlags.length : 0;
  if (flagCount > 0) {
    const flagPenalty = Math.min(8, flagCount * 3);
    adjustedPct -= flagPenalty;
    adjustments.push(`risk flags -${flagPenalty.toFixed(1)}% (${flagCount} flags)`);
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

// Stage 4 — composite score (higher = better).
// CTO direction: we are a non-bank lender, NOT a bank underwriter — our goal is to
// MINIMIZE exposure time. Therefore "shorter term" gets a MUCH bigger weight (40%)
// than in classic bank underwriting (20%), at the expense of "closeness to requested
// amount". DSR safety remains the top priority (40%).
const compositeScore = (c, requestedLoanAmount, dsrLimit) => {
  // Net closeness — the amount the customer actually receives (gross minus down
  // payment) — so the overall headline pick doesn't favor a needless down payment.
  const closeness = clamp(c.loanAmount / requestedLoanAmount, 0, 1);
  const dsrRatio = clamp(c.dsr / dsrLimit, 0, 1.5);
  const termShortness = 1 - c.termMonths / 84;
  return (1 - dsrRatio) * 0.4 + termShortness * 0.4 + closeness * 0.2;
};

// ─── Frontloaded amortization schedule ───────────────────────────────────────
// Generates a payment schedule where the FIRST `boostMonths` payments are inflated
// by `boostPct` (e.g. +30%), bringing the outstanding balance down faster and
// shrinking the lender's exposure. After the boost period, remaining balance is
// re-amortized over the residual term at a flat payment.
//
// Used when the caller passes `frontload: true` (Deal Rescuer default for non-bank
// lender mode) or when `loanSegment === 'business'` (business loans always
// frontload — companies have stronger early cash and we want to de-risk fast).
const buildFrontloadedSchedule = (principal, annualRatePct, termMonths, { boostMonths = 6, boostPct = 0.30 } = {}) => {
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
    // Months until 50% of principal is repaid — KEY exposure metric for the lender.
    months_to_half_principal: (() => {
      const target = principal * 0.5;
      let cum = 0;
      for (const row of schedule) {
        cum += row.principal;
        if (cum >= target) return row.month;
      }
      return schedule.length;
    })(),
    schedule_preview: schedule.slice(0, 12) // first year only — UI/API payload size
  };
};

// Per-strategy scoring — each strategy optimizes a DIFFERENT objective
// so the three results are meaningfully distinct.
const strategyScore = (type, c, requestedLoanAmount, insights, dsrLimit) => {
  const closeness = clamp(c.grossAmount / requestedLoanAmount, 0, 1);
  // Net closeness = how much of the requested amount the customer actually RECEIVES
  // (gross minus any down payment). Lanes whose goal is "stay close to the request"
  // must be scored on this — otherwise a needless down payment scores just as well
  // as a full disbursal simply because it lowers the monthly payment.
  const netCloseness = clamp(c.loanAmount / requestedLoanAmount, 0, 1);
  const dsrHeadroom = clamp((dsrLimit - c.dsr) / dsrLimit, -0.5, 1); // how far below policy threshold
  const termRatio = c.termMonths / 84;
  const dpRatio = c.downPayment / Math.max(1, c.grossAmount);
  const statusBonus = c.status === 'approved' ? 0.1 : 0;

  if (type === 'cash_flow_alignment') {
    // Goal: comfortable monthly payment via the longest term — amount is secondary to
    // burden here, which is what leaves behavioral_approval (netCloseness-driven) as
    // the usually-stronger offer in terms of loan amount.
    const monthlyBurden = c.monthlyPayment / Math.max(1, requestedLoanAmount / 48);
    return (1 - clamp(monthlyBurden, 0, 2) / 2) * 0.45 + termRatio * 0.35 + netCloseness * 0.2 + statusBonus;
  }
  if (type === 'exposure_reduction') {
    // Goal: reduce exposure — smaller principal and/or higher down payment.
    // Reward: low amount + high DP + large DSR headroom + shorter term.
    return (1 - closeness) * 0.4 + dpRatio * 0.25 + dsrHeadroom * 0.25 + (1 - termRatio) * 0.1 + statusBonus;
  }
  // behavioral_approval — Goal: closest to the original request, leveraging behavioral flexibility.
  // Net closeness is the DOMINANT factor — this lane exists specifically to bring the
  // customer as close to the full requested amount as possible, so a small DSR-positioning
  // gain must never outweigh giving less money than a candidate that offers more.
  const behavioralBoost = (insights?.isFalseNegative || Number(insights?.behavioralScore) >= 0.6) ? 0.1 : 0;
  // Encourage using the flexibility band (dsr closer to limit) only as a minor tiebreaker.
  const nearLimit = 1 - clamp(Math.abs(c.dsr - (dsrLimit - 0.02)) / 0.1, 0, 1);
  return netCloseness * 0.8 + nearLimit * 0.05 + (1 - termRatio) * 0.05 + behavioralBoost + statusBonus;
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
    const rawInsights = body?.analysisInsights || null;
    const cashFlowProfile = body?.cashFlowProfile || null;
    // CTO direction (non-bank lender mode):
    //   • loanSegment 'business' → always frontload to minimize exposure window
    //   • loanSegment 'personal' → frontload only if explicitly requested
    const loanSegment = String(body?.loanSegment || 'business').toLowerCase();
    const frontload = body?.frontload === true || loanSegment === 'business';

    // Load full underwriting policy (DSR limit, β guardrails, runway floor, pricing coeffs).
    const policy = await loadPolicy(base44);
    const basePolicyDsrLimit = policy.dsrLimit;

    // Merge cash-flow profile into insights so the risk-adjustment layer can use it.
    // Cash-flow profile is the AUTHORITATIVE source when available (granular OpenFinance data).
    const insights = (rawInsights || cashFlowProfile) ? {
      ...(rawInsights || {}),
      ...(cashFlowProfile ? {
        cashFlowTrustScore: cashFlowProfile.cashFlowTrustScore,
        stabilityAnchors: cashFlowProfile.stabilityAnchors || [],
        riskFlags: cashFlowProfile.riskFlags || [],
        confidence: cashFlowProfile.confidence,
        incomeVolatility: cashFlowProfile.incomeVolatility,
        liquidityForecast: cashFlowProfile.liquidityForecast
      } : {})
    } : null;

    // ── Behavioral Credit Engine v2: Calibrated · Tiered · Ramped ─────────────
    // Personalized "real change" model with FIVE refinements over the baseline:
    //   1. β is calibrated NON-LINEARLY:  β = 0.2 + 0.5·trust  (clamped by guardrails)
    //   2. Volatility penalty:            high income variance shrinks β by 30%
    //   3. Confidence scaling:            sparse data shrinks β toward minimum
    //   4. Behavioral ramp factor:        averages adoption over months 1–3 (≈0.633)
    //   5. Tiered cut by elasticity:      easy=β · medium=0.6β · hard=0.3β
    //
    // Result: a fundamentally personalized, regulation-safe disposable-income figure.
    let estimatedExpenses;
    let disposableIncome;
    let dsrBasis;
    let adaptiveCutMeta = null;

    if (cashFlowProfile && cashFlowProfile.expenses) {
      // Income/expense TOTALS are always sourced from loanLogicV2 (the same numbers
      // shown on the dashboard stat cards) — cashFlowProfile is used ONLY for
      // qualitative signals (trust score, discretionary tier ratios) so the two
      // screens never diverge (previously: income from loanLogicV2 mixed with
      // expenses from cashFlowIntelligence's 90-day window → mismatched figures).
      const fixedExpensesFromLoanLogic = Number(body?.fixedExpenses ?? rawInsights?.fixedExpenses ?? 0);
      const totalExpensesFromLoanLogic = Number(
        body?.estimatedExpenses ??
        rawInsights?.estimatedExpenses ??
        (income * 0.7)
      );
      // Fixed can never exceed total (see disposable_income_variable_cut path for rationale).
      const fixedExpenses = Math.min(fixedExpensesFromLoanLogic, totalExpensesFromLoanLogic);
      const discretionary = Math.max(0, totalExpensesFromLoanLogic - fixedExpenses);

      // Discretionary TIER RATIOS (easy/medium/hard) still come from cashFlowProfile —
      // it's the only source with a transaction-level breakdown — but rescaled onto
      // loanLogicV2's discretionary total so the absolute ₪ figures stay correlated.
      const rawBreakdown = cashFlowProfile.expenses.discretionaryBreakdown || null;
      const rawBreakdownSum = rawBreakdown ? (Number(rawBreakdown.easy ?? 0) + Number(rawBreakdown.medium ?? 0) + Number(rawBreakdown.hard ?? 0)) : 0;
      const breakdown = (rawBreakdown && rawBreakdownSum > 0) ? {
        easy: discretionary * (Number(rawBreakdown.easy ?? 0) / rawBreakdownSum),
        medium: discretionary * (Number(rawBreakdown.medium ?? 0) / rawBreakdownSum),
        hard: discretionary * (Number(rawBreakdown.hard ?? 0) / rawBreakdownSum)
      } : null;

      // 1. Calibrate β
      const calibratedBeta = calibrateBeta({
        trustScore: cashFlowProfile.cashFlowTrustScore,
        confidence: cashFlowProfile.confidence?.score,
        incomeVolatilityHigh: !!cashFlowProfile.incomeVolatility?.isHigh,
        guardrails: policy.betaGuardrails
      });

      // 2. Apply behavioral ramp — borrower changes habits gradually
      const rampFactor = computeRampFactor();
      const effectiveBeta = calibratedBeta * rampFactor;

      // Aggressive variable-expense offset — applied to ALL paths (not just fallback).
      // Once a loan is on the table, assume the borrower can trim ~12% of discretionary
      // spend BEFORE the adaptive β cut is layered on top.
      const VARIABLE_EXPENSE_CUT = 0.12;
      const preCutDiscretionary = discretionary * (1 - VARIABLE_EXPENSE_CUT);

      // 3. Tiered cut (or uniform fallback if no breakdown available)
      const { adjustedDiscretionary, tiers } = applyTieredCut(breakdown, preCutDiscretionary, effectiveBeta);

      // Existing debt is already inside estimatedExpenses via loanLogicV2's fixedExpenses
      // (loan repayments are classified as fixed) — do not subtract existingDebtPayments again.
      estimatedExpenses = fixedExpenses + adjustedDiscretionary;
      disposableIncome = Math.max(0, income - estimatedExpenses);
      dsrBasis = 'adaptive_discretionary_cut_v2';
      adaptiveCutMeta = {
        fixed_expenses: Math.round(fixedExpenses),
        original_discretionary: Math.round(discretionary),
        adjusted_discretionary: Math.round(adjustedDiscretionary),
        raw_trust_score: Number(Number(cashFlowProfile.cashFlowTrustScore ?? 0).toFixed(2)),
        calibrated_beta: Number(calibratedBeta.toFixed(2)),
        ramp_factor: Number(rampFactor.toFixed(2)),
        effective_beta: Number(effectiveBeta.toFixed(2)),
        confidence: Number(cashFlowProfile.confidence?.score ?? 0).toFixed(2),
        volatility_penalty_applied: !!cashFlowProfile.incomeVolatility?.isHigh,
        tiers,
        guardrails: { min_pct: policy.betaGuardrails.min * 100, max_pct: policy.betaGuardrails.max * 100 }
      };
    } else {
      const fixedExpensesInput = Number(body?.fixedExpenses ?? rawInsights?.fixedExpenses ?? 0);
      const totalExpensesInput = Number(
        body?.estimatedExpenses ??
        rawInsights?.estimatedExpenses ??
        (income * 0.7)
      );
      // Fixed expenses must be a SUBSET of total expenses. Upstream metrics (loanLogicV2)
      // compute "fixed" and "total" independently, and can report fixed > total — if we used
      // fixedExpensesInput as-is, estimatedExpenses would balloon ABOVE the real, known total
      // expenses shown elsewhere in the UI (e.g. the dashboard's expense stat card), breaking
      // the correlation between the two screens. Clamp fixed to total so that never happens.
      const clampedFixedExpenses = Math.min(fixedExpensesInput, totalExpensesInput);
      // Aggressive variable-expense offset: once a loan is on the table, assume the
      // borrower can trim ~12% of their VARIABLE (non-fixed) monthly spend — within
      // the 10-15% aggressive band. Only applied when we actually know the fixed/variable
      // split (otherwise we don't know how much of the total is even cuttable).
      const VARIABLE_EXPENSE_CUT = 0.12;
      const variableExpenses = Math.max(0, totalExpensesInput - clampedFixedExpenses);
      const adjustedVariable = clampedFixedExpenses > 0
        ? variableExpenses * (1 - VARIABLE_EXPENSE_CUT)
        : variableExpenses;
      estimatedExpenses = clampedFixedExpenses + adjustedVariable;
      // Existing debt is already inside estimatedExpenses (clampedFixedExpenses) — no double count.
      disposableIncome = income - estimatedExpenses;
      dsrBasis = clampedFixedExpenses > 0 ? 'disposable_income_variable_cut' : 'disposable_income';
    }

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

    // Pre-compute runway for the Profit Engine (PD model uses it)
    const preRunwayMonths = cashFlowProfile?.liquidityForecast?.worstCaseRunwayMonths;

    // Multi-stage search — DSR computed on disposable income inside.
    // Now uses DSR-based pricing tiers (A/B/C) + Profit Engine (PD/EV filter).
    const { candidates: rawCandidates, stage } = multiStageSearch({
      income,
      existingDebtPayments,
      estimatedExpenses,
      requestedLoanAmount,
      baseInterestRate,
      insights,
      maxDownPayment,
      dsrLimit,
      pricingCoeffs: policy.pricingCoeffs,
      tiers: policy.tiers,
      pdCoeffs: policy.pdCoeffs,
      lgd: policy.lgd,
      minExpectedProfitMargin: policy.minExpectedProfitMargin,
      runwayMonths: preRunwayMonths
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
    // ── Per-lane rate differentiation ────────────────────────────────────────────
    // Within the same tier, each strategy lane represents a DIFFERENT risk profile
    // for the lender, and pricing should reflect that:
    //   • exposure_reduction  → lowest rate (smaller principal + DP = less exposure)
    //   • behavioral_approval → middle rate (close to requested, leverages soft signals)
    //   • cash_flow_alignment → highest rate (longest term = higher duration risk)
    // The offset is small (±0.4pp) and clamped inside the candidate's tier band so
    // the pricing stays internally consistent with the tier policy.
    const laneRateOffset = {
      exposure_reduction: -0.4,
      behavioral_approval: 0.0,
      cash_flow_alignment: +0.4
    };

    let strategies = picks.map(({ type, c }) => {
      const tier = c.tier || tierForDsr(c.dsr * 100, policy.tiers);
      const tierBand = policy.tiers[tier];
      const offset = laneRateOffset[type] ?? 0;
      // Apply the lane offset, clamped within the tier's [minRate, maxRate] band.
      const adjustedRatePct = tierBand
        ? clamp(c.interestRate + offset, tierBand.minRate, tierBand.maxRate)
        : c.interestRate;
      // Recompute monthly payment & DSR using the differentiated rate.
      const adjustedMonthly = pmt(c.loanAmount, adjustedRatePct / 100, c.termMonths);
      const adjustedDisposable = income - existingDebtPayments - estimatedExpenses;
      const adjustedDsr = adjustedDisposable > 0 ? (adjustedMonthly / adjustedDisposable) : c.dsr;

      return {
        type,
        status: c.status,
        loanAmount: c.loanAmount,
        termMonths: c.termMonths,
        interestRate: Number(adjustedRatePct.toFixed(2)),
        downPayment: c.downPayment,
        monthlyPayment: Math.round(adjustedMonthly),
        dsr: Number((adjustedDsr * 100).toFixed(1)),
        tier,
        score: Number(c.score.toFixed(3)),
        reason: reasonFor(type, { ...c, monthlyPayment: Math.round(adjustedMonthly), dsr: adjustedDsr }),
        // ─── Profit Engine fields (kept from original candidate — internal use only) ───
        pd: c.pd ?? null,
        expectedValue: c.expectedValue ?? null,
        totalRevenue: c.totalRevenue ?? null,
        expectedLoss: c.expectedLoss ?? null,
        riskPremium: c.riskPremium ?? null,
        profitMargin: c.profitMargin ?? null
      };
    });

    // ── Liquidity Runway gate ──
    // Even if DSR is healthy, downgrade approvals when survival runway < policy floor.
    const runwayMonths = preRunwayMonths;
    const runwayGate = applyLiquidityRunwayGate(strategies, runwayMonths, policy.minLiquidityRunwayMonths);
    strategies = runwayGate.strategies;

    // Order strategies by actual quality (approval status, then composite score) so
    // the UI always shows the objectively best option first — not just insertion
    // order of the fixed ['cash_flow_alignment','exposure_reduction','behavioral_approval'] list.
    strategies = [...strategies].sort((a, b) => {
      const rank = { approved: 2, conditional: 1 };
      return ((rank[b.status] || 0) - (rank[a.status] || 0)) || (b.score - a.score);
    });

    // ── Aggressive Approval — SEPARATE PRODUCT (not a strategy) ──
    // CTO direction: aggressive_approval is a distinct PRODUCT with its own
    // pricing rules and DSR ceiling — not one more "strategy" in the menu.
    // It's surfaced under `aggressiveProduct` at the top level so the UI
    // can render it as a separate offer card with its own framing.
    const stretchEligible = isEligibleForStretch({
      insights,
      runwayMonths,
      stretchPolicy: policy.stretch
    });
    let aggressiveProduct = null;
    if (stretchEligible) {
      const aggressiveCandidate = aggressiveApprovalSearch({
        income,
        existingDebtPayments,
        estimatedExpenses,
        requestedLoanAmount,
        insights,
        maxDownPayment,
        aggressivePolicy: policy.aggressive,
        pdCoeffs: policy.pdCoeffs,
        lgd: policy.lgd,
        minExpectedProfitMargin: policy.minExpectedProfitMargin,
        runwayMonths
      });
      if (aggressiveCandidate) {
        const dsrPct = (aggressiveCandidate.dsr * 100).toFixed(1);
        aggressiveProduct = {
          productKey: 'aggressive_approval',
          productLabel: 'מוצר אישור אגרסיבי',
          status: aggressiveCandidate.status,
          loanAmount: aggressiveCandidate.loanAmount,
          termMonths: aggressiveCandidate.termMonths,
          interestRate: aggressiveCandidate.interestRate,
          downPayment: aggressiveCandidate.downPayment,
          monthlyPayment: aggressiveCandidate.monthlyPayment,
          dsr: Number(dsrPct),
          tier: 'C',
          reason: `מוצר נפרד בתנאים אגרסיביים — סכום ₪${aggressiveCandidate.loanAmount.toLocaleString('he-IL')} ל-${aggressiveCandidate.termMonths} חודשים בריבית ${aggressiveCandidate.interestRate}%. DSR ${dsrPct}% — מחוץ לתנאי האישור הסטנדרטיים, מאושר בזכות תמחור סיכון גבוה.`,
          // ─── Profit Engine fields ───
          pd: aggressiveCandidate.pd,
          expectedValue: aggressiveCandidate.expectedValue,
          totalRevenue: aggressiveCandidate.totalRevenue,
          expectedLoss: aggressiveCandidate.expectedLoss,
          riskPremium: aggressiveCandidate.riskPremium,
          profitMargin: aggressiveCandidate.profitMargin
        };
      }
    }

    // Fallback: no passing combos in any stage
    let fallback = null;
    if (strategies.length === 0) {
      // Run a broad scan with no DSR filter to find the closest attempt
      const broadBase = adjustRate(baseInterestRate, insights, policy.pricingCoeffs);
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
        // disposableIncome ≤ 0 means the client's expenses already meet or exceed income
        // BEFORE any new loan — there's no room for any structure, not "a very high DSR".
        // We flag this explicitly (noCapacity) instead of showing a fake 999% number.
        const noCapacity = disposableIncome <= 0;
        const overshoot = Math.round((closest.dsr - dsrLimit) * 100 * 10) / 10;
        fallback = {
          noCapacity,
          closestAttempt: { ...closest, dsr: Number((closest.dsr * 100).toFixed(1)), status: 'failed', type: 'closest_attempt' },
          whyFailed: noCapacity
            ? `להכנסה הפנויה של הלקוח אין יתרה לכיסוי החזר חדש כלל — ההוצאות (₪${Math.round(estimatedExpenses).toLocaleString('he-IL')}) גבוהות מההכנסה (₪${Math.round(income).toLocaleString('he-IL')}) עוד לפני בדיקת ההלוואה המבוקשת.`
            : `גם במבנה האופטימלי ה-DSR עומד על ${(closest.dsr * 100).toFixed(1)}% — חורג ב-${overshoot} נק׳ אחוז מהמקסימום של ${dsrLimitPct}%.`,
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
        const offerRate = adjustRate(baseInterestRate, insights, policy.pricingCoeffs);
        const headroom = disposableIncome > 0 ? dsrLimit * disposableIncome : 0;
        if (headroom > 0) {
          let lo = 0;
          // Never search above the requested amount — the max-approvable offer
          // can only be equal to or less than what the customer asked for.
          let hi = Math.max(requestedLoanAmount, 1000);
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

    // ── Frontloaded payment schedule for the HEADLINE strategy ──
    // Same loan total, restructured payments — heavier in the first 6 months
    // so the lender's exposure drops fast. Reported as a separate field, the
    // monthly figure already shown stays as the *flat-equivalent* baseline.
    const headlinePaymentSchedule = (hasRescue && frontload && headline?.loanAmount)
      ? buildFrontloadedSchedule(headline.loanAmount, headline.interestRate, headline.termMonths)
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
      // ── XAI factors: explainable breakdown of what drove the decision ──
      // Surfaced to the UI/credit officer so they understand WHY a borderline
      // applicant got approved or rejected — beyond the raw numbers.
      xai_factors: {
        positive: [
          ...(Array.isArray(insights?.stabilityAnchors) ? insights.stabilityAnchors.map(a => ({
            key: a.key, label: a.label, detail: a.detail, impact: 'positive'
          })) : []),
          ...(Number(insights?.cashFlowTrustScore) >= 0.6 ? [{
            key: 'cash_flow_trust',
            label: 'אמון תזרימי גבוה',
            detail: `ציון אמון תזרים מזומנים ${(insights.cashFlowTrustScore * 100).toFixed(0)}% — דפוסי הוצאה והכנסה צפויים`,
            impact: 'positive'
          }] : []),
          ...(Number(insights?.confidence?.score) >= 0.7 ? [{
            key: 'high_data_confidence',
            label: 'איכות נתונים גבוהה',
            detail: `${insights.confidence.dataPoints} תנועות לאורך ${insights.confidence.monthsCovered} חודשים — בסיס איתן לחיזוי`,
            impact: 'positive'
          }] : []),
          ...(Number(insights?.liquidityMonths) >= 3 ? [{
            key: 'liquidity_strong',
            label: 'נזילות חזקה',
            detail: `${insights.liquidityMonths} חודשי הוצאות ברזרבה`,
            impact: 'positive'
          }] : []),
          ...(Number(insights?.behavioralScore) >= 0.7 ? [{
            key: 'behavioral_strong',
            label: 'התנהגות פיננסית חזקה',
            detail: `ציון התנהגות ${(insights.behavioralScore * 100).toFixed(0)}%`,
            impact: 'positive'
          }] : []),
          ...(stretchEligible ? [{
            key: 'stretch_eligible',
            label: 'זכאי להצעת Stretch',
            detail: `הפרופיל עומד בתנאי Tier C — סכום מוגדל בריבית גבוהה יותר זמין כאופציה נוספת`,
            impact: 'positive'
          }] : []),
          // EV → categorical label (CTO direction: don't surface raw ₪ figures —
          // it reads like a casino). We translate the math to credit-officer language.
          ...((() => {
            if (!headline || !Number.isFinite(headline.expectedValue) || !Number.isFinite(headline.profitMargin)) return [];
            const margin = headline.profitMargin;
            if (margin >= 0.05) {
              return [{
                key: 'profitability_high',
                label: 'רווחיות גבוהה',
                detail: 'מחיר ההלוואה מכסה את הסיכון בנדיבות — מרווח רווח חזק מעל סף המדיניות',
                impact: 'positive'
              }];
            }
            if (margin >= 0.02) {
              return [{
                key: 'profitability_normal',
                label: 'רווחיות תקינה',
                detail: 'התמחור מאוזן מול הסיכון — המוצר עומד ברף הרווחיות הנדרש',
                impact: 'positive'
              }];
            }
            return []; // marginal/negative goes to the negative panel below
          })())
        ],
        negative: [
          ...(Array.isArray(insights?.riskFlags) ? insights.riskFlags.map(f => ({
            key: f.key, label: f.label, detail: f.detail, impact: 'negative'
          })) : []),
          ...(Number(insights?.cashFlowTrustScore) < 0.3 ? [{
            key: 'low_cash_flow_trust',
            label: 'אמון תזרימי נמוך',
            detail: 'דפוסי הוצאה לא יציבים או חוסר נתונים',
            impact: 'negative'
          }] : []),
          ...(Number(insights?.confidence?.score) < 0.5 ? [{
            key: 'low_data_confidence',
            label: 'איכות נתונים נמוכה',
            detail: `רק ${insights.confidence?.dataPoints || 0} תנועות לאורך ${insights.confidence?.monthsCovered || 0} חודשים — חיזוי שמרני`,
            impact: 'negative'
          }] : []),
          ...(insights?.incomeVolatility?.isHigh ? [{
            key: 'income_volatility_high',
            label: 'תנודתיות הכנסה',
            detail: `מקדם שונות ${((insights.incomeVolatility.coefficient || 0) * 100).toFixed(0)}% — קשה לסמוך על ממוצע ההכנסה`,
            impact: 'negative'
          }] : []),
          ...(runwayGate.gated ? [{
            key: 'liquidity_runway_short',
            label: 'חודשי הישרדות מתחת לסף',
            detail: `${runwayMonths || 0} חודשים בלבד עד אזילת מזומן (סף מדיניות ${policy.minLiquidityRunwayMonths}). האסטרטגיות שודרגו ל-תנאי`,
            impact: 'negative'
          }] : []),
          // Profitability concerns surfaced as words (not ₪ figures).
          ...((() => {
            if (!headline || !Number.isFinite(headline.profitMargin)) return [];
            const margin = headline.profitMargin;
            if (margin < 0) {
              return [{
                key: 'profitability_negative',
                label: 'סיכון גבוה ביחס לרווח',
                detail: 'התמחור הנוכחי לא מכסה את ההפסד הצפוי במלואו — דורש תיקון מחיר או תנאים',
                impact: 'negative'
              }];
            }
            if (margin < 0.02) {
              return [{
                key: 'profitability_marginal',
                label: 'רווחיות גבולית',
                detail: 'מרווח הרווח מתחת לסף המדיניות — מומלץ לבחון העלאת ריבית או הקטנת חשיפה',
                impact: 'negative'
              }];
            }
            return [];
          })())
        ]
      },
      // ── Credit Tier (A/B/C/D) ──
      // Internal classification used for pricing/risk decisions only.
      // The Dashboard UI continues to use risk_tier (Red/Orange/Green) — this
      // is an additional, more granular field for non-bank lender semantics.
      credit_tier: hasRescue
        ? (headline.tier || tierForDsr(headline.dsr, policy.tiers))
        : 'D',
      stretch_offer_eligible: stretchEligible,
      // ── Lender-side optimization output ──
      loan_segment: loanSegment,
      payment_schedule: headlinePaymentSchedule,
      // Aggressive Approval surfaced as a SEPARATE PRODUCT (not a strategy).
      // null when the client isn't eligible OR no profitable structure exists.
      aggressiveProduct,
      // ── Profit Engine summary (top-level for easy UI access) ──
      profit_engine: hasRescue ? {
        headline_pd: headline.pd ?? null,
        headline_expected_value: headline.expectedValue ?? null,
        headline_profit_margin: headline.profitMargin ?? null,
        headline_risk_premium_pct: headline.riskPremium ?? null,
        // Portfolio-level: sum of EVs across all offered strategies (if customer takes one)
        max_expected_value: Math.max(...strategies.map(s => s.expectedValue ?? 0), 0),
        // The most profitable strategy across the menu
        most_profitable_strategy: strategies.reduce(
          (best, s) => (s.expectedValue ?? -Infinity) > (best.expectedValue ?? -Infinity) ? s : best,
          { expectedValue: -Infinity }
        )?.type ?? null
      } : null,
      meta: {
        dsr_limit: dsrLimitPct,
        base_policy_dsr_limit: riskAdjustment.base_dsr_limit,
        stage,
        candidates_count: candidates.length,
        income,
        existing_debt_payments: existingDebtPayments,
        estimated_expenses: Math.round(estimatedExpenses),
        disposable_income: Math.round(disposableIncome),
        dsr_basis: dsrBasis,
        cash_flow_profile_used: !!cashFlowProfile,
        adaptive_cut: adaptiveCutMeta,
        liquidity_runway: {
          months: runwayMonths ?? null,
          floor: policy.minLiquidityRunwayMonths,
          gated: runwayGate.gated
        },
        pricing: {
          base_rate_pct: Number((baseInterestRate * 100).toFixed(2)),
          adjusted_rate_pct: Number((adjustRate(baseInterestRate, insights, policy.pricingCoeffs) * 100).toFixed(2)),
          k1_trust_discount: policy.pricingCoeffs.k1,
          k2_risk_premium: policy.pricingCoeffs.k2,
          trust_score: Number(insights?.cashFlowTrustScore ?? 0).toFixed(2),
          risk_flags_count: Array.isArray(insights?.riskFlags) ? insights.riskFlags.length : 0,
          quality_factor: Number(qualityFactor(insights).toFixed(2)),
          tiers: {
            A: { max_dsr_pct: policy.tiers.A.maxDsr, rate_range_pct: [policy.tiers.A.minRate, policy.tiers.A.maxRate] },
            B: { max_dsr_pct: policy.tiers.B.maxDsr, rate_range_pct: [policy.tiers.B.minRate, policy.tiers.B.maxRate] },
            C: { max_dsr_pct: policy.tiers.C.maxDsr, rate_range_pct: [policy.tiers.C.minRate, policy.tiers.C.maxRate] }
          }
        },
        policy: {
          beta_guardrails_pct: { min: policy.betaGuardrails.min * 100, max: policy.betaGuardrails.max * 100 },
          min_runway_months: policy.minLiquidityRunwayMonths,
          stretch_offer: {
            enabled: policy.stretch.enabled,
            min_trust: policy.stretch.minTrust,
            min_runway_months: policy.stretch.minRunway,
            max_flags: policy.stretch.maxFlags
          },
          profit_engine: {
            pd_coefficients: policy.pdCoeffs,
            lgd: policy.lgd,
            min_expected_profit_margin: policy.minExpectedProfitMargin,
            aggressive_approval: policy.aggressive
          }
        }
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});