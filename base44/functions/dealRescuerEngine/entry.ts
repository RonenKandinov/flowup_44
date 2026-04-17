import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// PMT calculation (standard amortization)
const pmt = (principal, annualRate, months) => {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRate / 12;
  if (r <= 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
};

// Dynamic rate adjustment based on analysisInsights
const adjustRate = (baseRate, insights) => {
  if (!insights) return baseRate;
  let rate = baseRate;
  const riskLevel = String(insights.riskLevel || '').toLowerCase();
  if (riskLevel === 'high') rate += 0.015;
  if (Number(insights.liquidityMonths) > 3) rate -= 0.005;
  if (Number(insights.behavioralScore) >= 0.6) rate -= 0.005;
  return clamp(rate, 0.05, 0.12);
};

// Grid search for all passing combinations (DSR <= 0.4)
const gridSearch = ({ income, existingDebtPayments, requestedLoanAmount, requestedTermMonths, baseInterestRate, insights, maxDownPayment }) => {
  const adjustedBase = adjustRate(baseInterestRate, insights);
  const DSR_LIMIT = 0.4;
  const DSR_CONDITIONAL = 0.45;

  const terms = [24, 36, 48, 60, 72, 84];
  const amountRatios = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5];
  const downPaymentRatios = [0, 0.05, 0.1, 0.15, 0.2, 0.25];
  // Explore rates around the adjusted base (±2.5%) with finer granularity
  const rateDeltas = [-0.025, -0.015, -0.01, -0.005, 0, 0.005, 0.01, 0.015, 0.025];

  // Hard cap on down payment: 50% of checking balance (enforced by caller via maxDownPayment)
  const dpCap = Number.isFinite(maxDownPayment) && maxDownPayment > 0 ? maxDownPayment : Infinity;

  const allCandidates = [];

  for (const term of terms) {
    for (const ratio of amountRatios) {
      for (const dp of downPaymentRatios) {
        for (const delta of rateDeltas) {
          const grossAmount = requestedLoanAmount * ratio;
          let downPayment = Math.round(requestedLoanAmount * ratio * dp);
          if (downPayment > dpCap) downPayment = Math.floor(dpCap);
          const netLoan = grossAmount - downPayment;
          if (netLoan <= 0) continue;

          const rate = clamp(adjustedBase + delta, 0.05, 0.12);
          const monthlyPayment = pmt(netLoan, rate, term);
          const dsr = income > 0 ? (existingDebtPayments + monthlyPayment) / income : 1;

          let status = 'failed';
          if (dsr <= DSR_LIMIT) status = 'approved';
          else if (dsr <= DSR_CONDITIONAL && insights?.isFalseNegative) status = 'conditional';

          allCandidates.push({
            loanAmount: Math.round(netLoan),
            termMonths: term,
            interestRate: Number((rate * 100).toFixed(2)),
            downPayment,
            monthlyPayment: Math.round(monthlyPayment),
            dsr: Number(dsr.toFixed(3)),
            status,
            amountRatio: ratio,
            termDistance: Math.abs(term - requestedTermMonths)
          });
        }
      }
    }
  }

  return allCandidates;
};

// Pick best candidate for a given strategy flavor.
// Each strategy uses a distinct scoring profile so interest rate and down payment
// come out differently — reflecting the actual risk/structure tradeoff.
const pickStrategy = (candidates, type, insights) => {
  const passing = candidates.filter(c => c.status === 'approved' || c.status === 'conditional');
  if (passing.length === 0) return null;

  const score = (c) => {
    if (type === 'cash_flow_alignment') {
      // Long term + mild rate premium for term risk, prefer NO down payment (ease cash flow)
      return (84 - c.termMonths) * 2
           + (c.interestRate - 7) * 1.5
           + c.downPayment / 500
           + c.dsr * 100 * 0.5;
    }
    if (type === 'exposure_reduction') {
      // Reward: smaller loan + larger down payment + lower rate (lower exposure = better pricing)
      return (c.amountRatio) * 40
           + (c.interestRate - 6) * 2
           - (c.downPayment / 250)
           + c.dsr * 100 * 0.3;
    }
    // behavioral_approval: keep structure close to original request; rate reflects behavioral discount
    return c.termDistance * 3
         + (1 - c.amountRatio) * 40
         + (c.interestRate - 6.5) * 1.2
         + c.downPayment / 400
         + c.dsr * 100 * 0.4;
  };

  return [...passing].sort((a, b) => score(a) - score(b))[0];
};

const reasonFor = (type, candidate, insights) => {
  const dsrPct = (candidate.dsr * 100).toFixed(1);
  if (type === 'cash_flow_alignment') {
    return `פריסה ל-${candidate.termMonths} חודשים מורידה את ההחזר ל-₪${candidate.monthlyPayment.toLocaleString('he-IL')} ומיישרת את ה-DSR ל-${dsrPct}%.`;
  }
  if (type === 'exposure_reduction') {
    const dpTxt = candidate.downPayment > 0 ? ` ומקדמה של ₪${candidate.downPayment.toLocaleString('he-IL')}` : '';
    return `הקטנת ההלוואה ל-₪${candidate.loanAmount.toLocaleString('he-IL')}${dpTxt} מורידה את החשיפה ומביאה ל-DSR של ${dsrPct}%.`;
  }
  return `שמירה על מבנה קרוב לבקשה המקורית (₪${candidate.loanAmount.toLocaleString('he-IL')} ל-${candidate.termMonths} חודשים) מאפשרת אישור תוך ניצול הפרופיל ההתנהגותי, עם DSR של ${dsrPct}%.`;
};

const basedOnFor = (type, insights) => {
  if (!insights) return 'חוקי חיתום סטנדרטיים';
  if (type === 'cash_flow_alignment') {
    if (insights.incomeTrend === 'negative') return 'incomeTrend=negative — נדרשת הקלה תזרימית';
    if (insights.anomalyDetected) return 'anomalyDetected=true — תנודתיות בהוצאות';
    return `liquidityMonths=${insights.liquidityMonths}`;
  }
  if (type === 'exposure_reduction') {
    if (Number(insights.liquidityMonths) < 1.5) return `liquidityMonths=${insights.liquidityMonths} — נזילות נמוכה`;
    return 'מטרה: הקטנת חשיפה כוללת';
  }
  if (insights.isFalseNegative) return 'isFalseNegative=true — דחייה טכנית על חשבון יכולת אמיתית';
  return `behavioralScore=${insights.behavioralScore}`;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // New contract inputs
    const income = Number(body?.income || 0);
    const existingDebtPayments = Number(
      body?.existingDebtPayments ?? body?.existing_debt_payments ?? body?.debtPayments ?? 0
    );
    const requestedLoanAmount = Number(body?.requestedLoanAmount ?? body?.principal ?? 50000);
    const requestedTermMonths = Number(body?.requestedTermMonths ?? body?.durationMonths ?? 48);
    const baseInterestRate = Number(body?.baseInterestRate ?? body?.baseRate ?? 0.09);
    const maxDownPayment = Number(body?.maxDownPayment ?? Infinity);
    const insights = body?.analysisInsights || null;

    // Current DSR (based on existing debt only, per spec)
    const currentDsr = income > 0 ? (existingDebtPayments / income) : 1;
    const currentScore = Number(body?.score || clamp(Math.round(85 - currentDsr * 100 * 0.7), 20, 85));
    const currentStatus = String(body?.currentStatus || (currentDsr <= 0.4 ? 'approved' : currentDsr <= 0.5 ? 'borderline' : 'rejected'));

    // Run grid search
    const candidates = gridSearch({
      income,
      existingDebtPayments,
      requestedLoanAmount,
      requestedTermMonths,
      baseInterestRate,
      insights,
      maxDownPayment
    });

    const strategies = [];
    const seen = new Set();
    for (const type of ['cash_flow_alignment', 'exposure_reduction', 'behavioral_approval']) {
      const pick = pickStrategy(candidates, type, insights);
      if (!pick) continue;
      const key = `${pick.loanAmount}-${pick.termMonths}-${pick.interestRate}-${pick.downPayment}`;
      if (seen.has(key)) continue;
      seen.add(key);
      strategies.push({
        type,
        status: pick.status,
        loanAmount: pick.loanAmount,
        termMonths: pick.termMonths,
        interestRate: pick.interestRate,
        downPayment: pick.downPayment,
        monthlyPayment: pick.monthlyPayment,
        dsr: Number((pick.dsr * 100).toFixed(1)),
        reason: reasonFor(type, pick, insights),
        basedOn: basedOnFor(type, insights)
      });
    }

    // Fallback: no passing combos → expose closest attempt + improvement paths
    let fallback = null;
    if (strategies.length === 0 && candidates.length > 0) {
      const closest = [...candidates].sort((a, b) => a.dsr - b.dsr)[0];
      const overshoot = Math.round((closest.dsr - 0.4) * 100 * 10) / 10;
      fallback = {
        closestAttempt: {
          type: 'closest_attempt',
          status: 'failed',
          loanAmount: closest.loanAmount,
          termMonths: closest.termMonths,
          interestRate: closest.interestRate,
          downPayment: closest.downPayment,
          monthlyPayment: closest.monthlyPayment,
          dsr: Number((closest.dsr * 100).toFixed(1))
        },
        whyFailed: `גם במבנה האופטימלי ה-DSR עומד על ${(closest.dsr * 100).toFixed(1)}% — חורג ב-${overshoot} נק׳ אחוז מהמקסימום של 40%.`,
        improvements: [
          `הקטנת סכום הבקשה ב-₪${Math.round(requestedLoanAmount * 0.2).toLocaleString('he-IL')} לפחות`,
          `הגדלת הכנסה חודשית ב-₪${Math.max(500, Math.round((existingDebtPayments + closest.monthlyPayment) / 0.4 - income)).toLocaleString('he-IL')}`,
          `הפחתת החזרי חוב קיימים (כיום ₪${existingDebtPayments.toLocaleString('he-IL')})`,
          `הוספת מקדמה של 20% (₪${Math.round(requestedLoanAmount * 0.2).toLocaleString('he-IL')})`
        ]
      };
    }

    const hasRescue = strategies.length > 0;
    const headline = hasRescue
      ? [...strategies].sort((a, b) => {
          const rank = { approved: 2, conditional: 1, failed: 0 };
          return (rank[b.status] - rank[a.status]) || (a.dsr - b.dsr);
        })[0]
      : null;

    const explanation = hasRescue
      ? `נמצאו ${strategies.length} אסטרטגיות שעומדות ב-DSR ≤ 40%. מוביל: ${headline.type.replace(/_/g, ' ')} — DSR ${headline.dsr}%.`
      : 'לא נמצאה קומבינציה שמעמידה את ה-DSR מתחת ל-40%. מוצג הניסיון הקרוב ביותר עם דרכי פעולה לשיפור.';

    return Response.json({
      analysisInsights: insights,
      rescueStrategies: strategies,
      fallback,
      before: {
        status: currentStatus,
        dsr: Number((currentDsr * 100).toFixed(1)),
        score: currentScore
      },
      after: hasRescue ? {
        status: headline.status,
        dsr: headline.dsr,
        score: clamp(Math.round(85 - headline.dsr * 0.7), 30, 95),
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
        dsr_limit: 40,
        grid_size: candidates.length,
        passing_count: candidates.filter(c => c.status !== 'failed').length,
        income,
        existing_debt_payments: existingDebtPayments
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});