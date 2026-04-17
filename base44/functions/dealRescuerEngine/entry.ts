import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const monthlyPaymentFor = (principal, annualRate, months) => {
  const r = annualRate / 12;
  if (r <= 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
};

const classifyScenario = ({ dsr, disposableIncome, liquidityMonths }) => {
  if (dsr <= 35 && disposableIncome >= 1500 && liquidityMonths >= 1) return 'approved';
  if (dsr <= 45 && disposableIncome >= 500) return 'conditional';
  return 'failed';
};

const scoreScenario = ({ dsr, disposableIncome, liquidityMonths }) => {
  let s = 50;
  if (dsr <= 30) s += 25; else if (dsr <= 35) s += 18; else if (dsr <= 40) s += 10; else if (dsr <= 45) s += 4; else s -= 12;
  if (disposableIncome >= 2500) s += 18; else if (disposableIncome >= 1500) s += 12; else if (disposableIncome >= 750) s += 6; else if (disposableIncome < 0) s -= 20;
  if (liquidityMonths >= 3) s += 8; else if (liquidityMonths >= 1.5) s += 4; else if (liquidityMonths < 1) s -= 8;
  return Math.round(clamp(s, 20, 95));
};

const buildStrategy = ({ type, title, principal, termMonths, annualRate, monthlyIncome, monthlyExpenses, liquidityMonths, insight, reason }) => {
  const monthlyPayment = monthlyPaymentFor(principal, annualRate, termMonths);
  const totalObligations = monthlyExpenses + monthlyPayment;
  const dsr = monthlyIncome > 0 ? (totalObligations / monthlyIncome) * 100 : 100;
  const disposableIncome = monthlyIncome - totalObligations;
  const status = classifyScenario({ dsr, disposableIncome, liquidityMonths });
  const score = scoreScenario({ dsr, disposableIncome, liquidityMonths });

  return {
    type,
    title,
    status,
    loanAmount: Math.round(principal),
    termMonths,
    interestRate: Number((annualRate * 100).toFixed(2)),
    monthlyPayment: Math.round(monthlyPayment),
    dsr: Number(dsr.toFixed(1)),
    disposableIncome: Math.round(disposableIncome),
    score,
    reason,
    basedOn: insight
  };
};

// Returns the best variant (passing or closest-to-passing) among candidates
const pickBest = (candidates) => {
  const passing = candidates.filter(c => c.status !== 'failed');
  const pool = passing.length ? passing : candidates;
  return pool.sort((a, b) => {
    const rank = { approved: 3, conditional: 2, failed: 1 };
    return (rank[b.status] - rank[a.status]) || (b.score - a.score) || (a.dsr - b.dsr);
  })[0];
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const monthlyIncome = Number(body?.income || 0);
    const monthlyExpenses = Number(body?.fixedExpenses || 0);
    const liquidAssets = Number(body?.liquidAssets || 0);
    const requestedAmount = Number(body?.principal || 50000);
    const requestedDuration = Number(body?.durationMonths || 48);
    const annualRate = Number(body?.baseRate || 0.09);
    const currentStatus = String(body?.currentStatus || 'borderline').toLowerCase();
    const currentDsr = Number(body?.dsr || (monthlyIncome > 0 ? (monthlyExpenses / monthlyIncome) * 100 : 100));
    const currentScore = Number(body?.score || clamp(Math.round(85 - currentDsr * 0.7), 30, 85));

    const insights = body?.analysisInsights || {};
    const isFalseNegative = !!insights.isFalseNegative;
    const incomeTrend = insights.incomeTrend || 'stable';
    const anomalyDetected = !!insights.anomalyDetected;
    const liquidityMonths = Number(insights.liquidityMonths ?? (monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0));
    const behavioralScore = Number(insights.behavioralScore ?? 0);
    const keyInsights = Array.isArray(insights.keyInsights) ? insights.keyInsights : [];

    // ---- Strategy 1: Cash Flow Alignment (extend term, keep amount) ----
    const cashFlowCandidates = [60, 72, 84].map(term => buildStrategy({
      type: 'cash_flow_alignment',
      title: 'התאמת תזרים',
      principal: requestedAmount,
      termMonths: term,
      annualRate,
      monthlyIncome,
      monthlyExpenses,
      liquidityMonths,
      insight: anomalyDetected
        ? 'זוהו תנודות חריגות בהוצאות — הארכת תקופה מייצבת את התזרים'
        : incomeTrend === 'negative'
          ? 'מגמת ההכנסה שלילית — הקטנת ההחזר החודשי מקנה מרווח בטחון'
          : 'הארכת תקופה מפחיתה את ההחזר החודשי ומיישרת את התזרים',
      reason: 'פריסה ארוכה יותר מקטינה את ההחזר החודשי ומשפרת את יחס ההחזר (DSR) מבלי לוותר על סכום ההלוואה.'
    }));
    const cashFlow = pickBest(cashFlowCandidates);

    // ---- Strategy 2: Exposure Reduction (lower principal) ----
    const exposureCandidates = [0.7, 0.6, 0.5, 0.4].map(ratio => buildStrategy({
      type: 'exposure_reduction',
      title: 'הפחתת חשיפה',
      principal: requestedAmount * ratio,
      termMonths: requestedDuration,
      annualRate,
      monthlyIncome,
      monthlyExpenses,
      liquidityMonths,
      insight: liquidityMonths < 1
        ? `נזילות של ${liquidityMonths.toFixed(1)} חודשים נמוכה — הקטנת סכום מקטינה סיכון`
        : 'יחס החזר גבוה — הקטנת סכום ההלוואה מורידה את הסיכון לרמה בטוחה',
      reason: 'הקטנת סכום ההלוואה מפחיתה את החשיפה הכוללת ומאפשרת אישור בתנאים רגילים.'
    }));
    const exposure = pickBest(exposureCandidates);

    // ---- Strategy 3: Behavioral Approval (small adjustment + behavioral signal) ----
    const behavioralTermBase = behavioralScore >= 0.5 || isFalseNegative ? requestedDuration + 12 : requestedDuration + 24;
    const behavioralCandidates = [behavioralTermBase, behavioralTermBase + 12].flatMap(term => (
      [0.9, 0.85].map(ratio => buildStrategy({
        type: 'behavioral_approval',
        title: 'אישור מבוסס התנהגות',
        principal: requestedAmount * ratio,
        termMonths: term,
        annualRate,
        monthlyIncome,
        monthlyExpenses,
        liquidityMonths,
        insight: isFalseNegative
          ? 'זוהה False Negative — הדחייה הטכנית לא משקפת את יכולת ההחזר'
          : `ציון התנהגותי ${behavioralScore.toFixed(2)} מצדיק שקילה מחודשת תחת תנאים מותאמים`,
        reason: 'שילוב של התאמה קלה בסכום ובתקופה יחד עם הסיגנלים ההתנהגותיים החיוביים מאפשר אישור בתנאים מיוחדים.'
      }))
    ));
    const behavioral = pickBest(behavioralCandidates);

    // Keep only non-failed strategies; if behavioral failed entirely, hide it
    const raw = [cashFlow, exposure, behavioral];
    let rescueStrategies = raw.filter(s => s && s.status !== 'failed');

    // Rules: if nothing passes, fall back to the two best non-failed strategies from cash flow + exposure
    if (rescueStrategies.length === 0) {
      rescueStrategies = raw.filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 2);
    }

    // Pick headline "after" from the strongest strategy
    const headline = [...rescueStrategies].sort((a, b) => {
      const rank = { approved: 3, conditional: 2, failed: 1 };
      return (rank[b.status] - rank[a.status]) || (b.score - a.score);
    })[0] || null;

    const hasRealRescue = !!headline && headline.status !== 'failed';
    const approvalIncrease = hasRealRescue ? Math.max(0, headline.score - currentScore) : 0;

    const explanation = hasRealRescue
      ? `נמצאו ${rescueStrategies.length} מסלולי חילוץ ריאליים. ההמלצה המובילה: ${headline.title} — יחס החזר חדש ${headline.dsr}%.`
      : 'לא נמצא מסלול שמעביר את העסקה לאישור בתנאים הנוכחיים. נדרש שיפור בהכנסה או הקטנת התחייבויות לפני בקשה חוזרת.';

    const response = {
      analysisInsights: insights,
      rescueStrategies,
      before: {
        status: currentStatus,
        dsr: Number(currentDsr.toFixed(1)),
        score: currentScore
      },
      after: hasRealRescue ? {
        status: headline.status,
        dsr: headline.dsr,
        score: headline.score,
        duration_months: headline.termMonths,
        monthly_payment: headline.monthlyPayment
      } : {
        status: 'still_risky',
        dsr: Number(currentDsr.toFixed(1)),
        score: currentScore,
        duration_months: requestedDuration,
        monthly_payment: Math.round(monthlyPaymentFor(requestedAmount, annualRate, requestedDuration))
      },
      impact: {
        approval_probability_increase: approvalIncrease,
        dsr_change: hasRealRescue ? Number((headline.dsr - currentDsr).toFixed(1)) : 0
      },
      explanation,
      meta: {
        key_insights: keyInsights,
        income_trend: incomeTrend,
        is_false_negative: isFalseNegative,
        behavioral_score: behavioralScore,
        liquidity_months: Number(liquidityMonths.toFixed(1))
      }
    };

    return Response.json(response);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});