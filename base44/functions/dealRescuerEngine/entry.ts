import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getLiquidityMonths = (liquidAssets, monthlyExpenses) => {
  if (monthlyExpenses <= 0) return 0;
  return liquidAssets / monthlyExpenses;
};

const getForecastSupport = ({ projectedEomBalance, riskStatus, forecastConfidence, avgDailySpending, liquidAssets }) => {
  const normalizedRisk = String(riskStatus || '').toUpperCase();
  const confidence = Number(forecastConfidence || 0);
  const dailyBurn = Number(avgDailySpending || 0);
  const behavioralBufferDays = dailyBurn > 0 ? liquidAssets / dailyBurn : 0;
  const isSupportive = projectedEomBalance > 0 && normalizedRisk !== 'RED' && confidence >= 60 && behavioralBufferDays >= 21;

  return {
    isSupportive,
    bonus: isSupportive ? 4 : 0,
    label: isSupportive ? 'forecast_supportive' : 'forecast_not_supportive',
    behavioralBufferDays: Number(behavioralBufferDays.toFixed(1))
  };
};

const buildRiskFactors = ({ currentDsr, monthlyIncome, monthlyExpenses, liquidAssets, projectedEomBalance, riskStatus, avgDailySpending }) => {
  const riskFactors = [];
  const behavioralBufferDays = avgDailySpending > 0 ? liquidAssets / avgDailySpending : 0;
  if (currentDsr > 45) riskFactors.push('DSR גבוה');
  if (monthlyIncome - monthlyExpenses <= 0) riskFactors.push('תזרים חודשי חלש');
  if (liquidAssets < monthlyExpenses * 2) riskFactors.push('נזילות נמוכה');
  if (behavioralBufferDays > 0 && behavioralBufferDays < 21) riskFactors.push('כרית התנהגותית קצרה');
  if (projectedEomBalance < 0) riskFactors.push('תחזית יתרה שלילית');
  if (String(riskStatus || '').toUpperCase() === 'RED') riskFactors.push('סיכון תחזיתי גבוה');
  return riskFactors;
};

const calculateScenarioScore = ({ newDsr, disposableIncome, liquidityMonths, duration, requestedDuration, ratio, forecastSupport }) => {
  let score = 50;

  if (newDsr <= 35) score += 22;
  else if (newDsr <= 40) score += 14;
  else if (newDsr <= 45) score += 8;
  else if (newDsr <= 50) score -= 6;
  else score -= 18;

  if (disposableIncome >= 2500) score += 18;
  else if (disposableIncome >= 1500) score += 12;
  else if (disposableIncome >= 750) score += 6;
  else if (disposableIncome < 0) score -= 24;

  if (liquidityMonths >= 3) score += 10;
  else if (liquidityMonths >= 2) score += 6;
  else if (liquidityMonths < 1) score -= 12;

  if (ratio < 1) score += 6;
  if (duration > requestedDuration) score += 4;
  if (duration < requestedDuration) score -= 2;

  score += forecastSupport.bonus;

  return Math.round(clamp(score, 20, 92));
};

const buildStatus = ({ score, dsr, disposableIncome, liquidityMonths, forecastSupport, currentDsr }) => {
  if (dsr <= 45 && disposableIncome >= 1000 && liquidityMonths >= 2) {
    return forecastSupport.isSupportive && score >= 72 ? 'likely_approved' : 'conditionally_approved';
  }

  if (dsr <= 50 && dsr < currentDsr && disposableIncome > 0 && liquidityMonths >= 1) {
    return 'improved';
  }

  return 'still_risky';
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
    const projectedEomBalance = Number(body?.projectedEomBalance || 0);
    const riskStatus = body?.riskStatus || '';
    const forecastConfidence = Number(body?.forecastConfidence || 50);
    const avgDailySpending = Number(body?.avgDailySpending || 0);
    const riskDay = body?.riskDay || null;

    const liquidityMonths = getLiquidityMonths(liquidAssets, monthlyExpenses);
    const forecastSupport = getForecastSupport({
      projectedEomBalance,
      riskStatus,
      forecastConfidence,
      avgDailySpending,
      liquidAssets
    });

    const riskFactors = buildRiskFactors({
      currentDsr,
      monthlyIncome,
      monthlyExpenses,
      liquidAssets,
      projectedEomBalance,
      riskStatus,
      avgDailySpending
    });

    const durations = Array.from(new Set([requestedDuration, 36, 48, 60, 72, 84])).sort((a, b) => a - b);
    const amountAdjustments = [1, 0.9, 0.8];
    const scenarios = [];

    for (const duration of durations) {
      for (const ratio of amountAdjustments) {
        const adjustedAmount = Math.round(requestedAmount * ratio);
        const monthlyRate = annualRate / 12;
        const monthlyPayment = monthlyRate > 0
          ? (adjustedAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -duration))
          : adjustedAmount / duration;

        const totalObligations = monthlyExpenses + monthlyPayment;
        const newDsr = monthlyIncome > 0 ? (totalObligations / monthlyIncome) * 100 : 100;
        const disposableIncome = monthlyIncome - totalObligations;
        const score = calculateScenarioScore({
          newDsr,
          disposableIncome,
          liquidityMonths,
          duration,
          requestedDuration,
          ratio,
          forecastSupport
        });

        const status = buildStatus({
          score,
          dsr: newDsr,
          disposableIncome,
          liquidityMonths,
          forecastSupport,
          currentDsr
        });

        scenarios.push({
          adjustedAmount,
          duration,
          monthlyPayment: Math.round(monthlyPayment),
          dsr: Number(newDsr.toFixed(1)),
          score,
          disposableIncome: Math.round(disposableIncome),
          status,
          ratio
        });
      }
    }

    scenarios.sort((a, b) => {
      const rank = { likely_approved: 4, conditionally_approved: 3, improved: 2, still_risky: 1 };
      return (rank[b.status] - rank[a.status]) || (b.score - a.score) || (a.dsr - b.dsr) || (b.disposableIncome - a.disposableIncome);
    });

    const best = scenarios[0];
    const scenarioImprovesRisk = ['likely_approved', 'conditionally_approved', 'improved'].includes(best.status);
    const approvalIncrease = scenarioImprovesRisk ? Math.max(0, best.score - currentScore) : 0;

    const llmPrompt = `ענה בעברית בלבד וב-JSON בלבד.
אתה מנוע Deal Rescuer של FlowUp.
המטרה: לבחור תרחיש אחד בלבד שמגדיל את סיכוי האישור בצורה ריאלית, על בסיס נתוני חיתום + תחזית התזרים ההיברידית של FlowUp.

עקרונות מחייבים:
1. השתמש רק בנתונים המספריים שסופקו.
2. השתמש ב-forecasting רק אם הוא תומך באישור; אם הוא שלילי או חלש, אל תשתמש בו כדי להצדיק אישור אלא רק כדי לציין סיכון.
3. שלב בהסבר גם behavioral signal: כרית הישרדות יומית/דפוס שריפה, אבל בלי להמציא נתונים.
4. הסבר קצר, חד, פרקטי, עד 2 שורות בלבד.
5. אל תציע כמה אסטרטגיות. רק את הטובה ביותר.
6. אם הסיכון עדיין גבוה, כתוב זאת בצורה ברורה.

נתוני לפני:
- status: ${currentStatus}
- dsr: ${Number(currentDsr.toFixed(1))}
- score: ${currentScore}
- monthly_income: ${monthlyIncome}
- monthly_expenses: ${monthlyExpenses}
- liquid_assets: ${liquidAssets}

נתוני תחזית FlowUp:
- projected_eom_balance: ${projectedEomBalance}
- risk_status: ${riskStatus}
- forecast_confidence: ${forecastConfidence}
- avg_daily_spending: ${avgDailySpending}
- risk_day: ${riskDay || 'unknown'}
- behavioral_buffer_days: ${forecastSupport.behavioralBufferDays}

גורמי סיכון מרכזיים:
${riskFactors.join(', ') || 'ללא גורם דומיננטי אחד'}

התרחיש הנבחר:
- adjusted_loan_amount: ${best.adjustedAmount}
- duration_months: ${best.duration}
- monthly_payment: ${best.monthlyPayment}
- new_dsr: ${best.dsr}
- new_score: ${best.score}
- disposable_income: ${best.disposableIncome}
- scenario_status: ${best.status}
- liquidity_months: ${Number(liquidityMonths.toFixed(1))}
- forecast_support: ${forecastSupport.label}
- approval_probability_increase: ${approvalIncrease}
- dsr_change: ${Number((best.dsr - currentDsr).toFixed(1))}

החזר JSON בדיוק בסכמה הזו:
{
  "before": { "status": "string", "dsr": 0, "score": 0 },
  "after": { "status": "string", "dsr": 0, "score": 0, "duration_months": 0, "monthly_payment": 0 },
  "impact": { "approval_probability_increase": 0, "dsr_change": 0 },
  "explanation": "string"
}`;

    const fallbackExplanation = best.status === 'still_risky'
      ? 'גם אחרי פריסה והקטנת סכום, יחס ההחזר עדיין גבוה מדי ולכן אין כאן חילוץ אמיתי של העסקה.'
      : 'נמצא תרחיש שמפחית את לחץ ההחזר ומשפר את סיכויי האישור בצורה מדורגת.';

    const fallbackResponse = {
      before: {
        status: currentStatus,
        dsr: Number(currentDsr.toFixed(1)),
        score: currentScore
      },
      after: {
        status: best.status,
        dsr: best.dsr,
        score: best.score,
        duration_months: best.duration,
        monthly_payment: best.monthlyPayment
      },
      impact: {
        approval_probability_increase: approvalIncrease,
        dsr_change: Number((best.dsr - currentDsr).toFixed(1))
      },
      explanation: fallbackExplanation
    };

    let llmRes = fallbackResponse;

    try {
      llmRes = await base44.integrations.Core.InvokeLLM({
      prompt: llmPrompt,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          before: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              dsr: { type: 'number' },
              score: { type: 'number' }
            },
            required: ['status', 'dsr', 'score']
          },
          after: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              dsr: { type: 'number' },
              score: { type: 'number' },
              duration_months: { type: 'number' },
              monthly_payment: { type: 'number' }
            },
            required: ['status', 'dsr', 'score', 'duration_months', 'monthly_payment']
          },
          impact: {
            type: 'object',
            properties: {
              approval_probability_increase: { type: 'number' },
              dsr_change: { type: 'number' }
            },
            required: ['approval_probability_increase', 'dsr_change']
          },
          explanation: { type: 'string' }
        },
        required: ['before', 'after', 'impact', 'explanation']
      }
    });
    } catch (_) {
      llmRes = fallbackResponse;
    }

    return Response.json({
      ...llmRes,
      meta: {
        risk_factors: riskFactors,
        adjusted_amount: best.adjustedAmount,
        disposable_income: best.disposableIncome,
        projected_eom_balance: projectedEomBalance,
        risk_status: riskStatus,
        forecast_confidence: forecastConfidence,
        liquidity_months: Number(liquidityMonths.toFixed(1)),
        forecast_support: forecastSupport.label,
        behavioral_buffer_days: forecastSupport.behavioralBufferDays
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});