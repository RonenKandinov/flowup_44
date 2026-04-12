import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const buildRiskFactors = ({ currentDsr, monthlyIncome, monthlyExpenses, liquidAssets, projectedEomBalance, riskStatus }) => {
  const riskFactors = [];
  if (currentDsr > 45) riskFactors.push('DSR גבוה');
  if (monthlyIncome - monthlyExpenses <= 0) riskFactors.push('תזרים חודשי חלש');
  if (liquidAssets < monthlyExpenses * 2) riskFactors.push('נזילות נמוכה');
  if (projectedEomBalance < 0) riskFactors.push('תחזית יתרה שלילית');
  if (String(riskStatus || '').toUpperCase() === 'RED') riskFactors.push('סיכון תחזיתי גבוה');
  return riskFactors;
};

const calculateScenarioScore = ({ newDsr, disposableIncome, liquidAssets, monthlyExpenses, duration, requestedDuration, ratio, projectedEomBalance, riskStatus, forecastConfidence }) => {
  let score = 78;

  if (newDsr <= 35) score += 10;
  else if (newDsr <= 45) score += 4;
  else if (newDsr > 55) score -= 16;

  if (disposableIncome > 2500) score += 8;
  else if (disposableIncome > 1000) score += 4;
  else if (disposableIncome < 0) score -= 22;

  if (liquidAssets >= monthlyExpenses * 3) score += 4;
  else if (liquidAssets < monthlyExpenses * 2) score -= 6;

  if (projectedEomBalance > 0) score += 4;
  else score -= 8;

  if (String(riskStatus || '').toUpperCase() === 'GREEN') score += 4;
  if (String(riskStatus || '').toUpperCase() === 'RED') score -= 6;

  score += clamp((Number(forecastConfidence || 50) - 50) / 10, -3, 5);

  if (ratio < 1) score += 5;
  if (duration >= requestedDuration) score += 3;

  return Math.round(clamp(score, 35, 92));
};

const buildStatus = (score, dsr, disposableIncome, projectedEomBalance, currentScore) => {
  if (score >= 75 && dsr <= 45 && disposableIncome > 0 && projectedEomBalance >= 0) return 'likely_approved';
  if (score > currentScore && disposableIncome > 0) return 'improved';
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

    const riskFactors = buildRiskFactors({
      currentDsr,
      monthlyIncome,
      monthlyExpenses,
      liquidAssets,
      projectedEomBalance,
      riskStatus
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

        const addedLoanDsr = monthlyIncome > 0 ? (monthlyPayment / monthlyIncome) * 100 : 100;
        const newDsr = Math.max(0, currentDsr + addedLoanDsr);
        const disposableIncome = monthlyIncome - monthlyExpenses - monthlyPayment;
        const score = calculateScenarioScore({
          newDsr,
          disposableIncome,
          liquidAssets,
          monthlyExpenses,
          duration,
          requestedDuration,
          ratio,
          projectedEomBalance,
          riskStatus,
          forecastConfidence
        });

        const status = buildStatus(score, newDsr, disposableIncome, projectedEomBalance, currentScore);

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
      const rank = { likely_approved: 3, improved: 2, still_risky: 1 };
      return (rank[b.status] - rank[a.status]) || (b.score - a.score) || (a.dsr - b.dsr) || (b.disposableIncome - a.disposableIncome);
    });

    const best = scenarios[0];
    const approvalIncrease = Math.max(0, best.score - currentScore);

    const llmPrompt = `ענה בעברית בלבד וב-JSON בלבד.
אתה מנוע Deal Rescuer של FlowUp.
המטרה: לבחור תרחיש אחד בלבד שמגדיל את סיכוי האישור בצורה ריאלית, על בסיס נתוני חיתום + תחזית התזרים ההיברידית של FlowUp.

עקרונות מחייבים:
1. השתמש רק בנתונים המספריים שסופקו.
2. שלב את נתוני ה-forecasting בהיגיון: projected end of month, risk status, confidence, average daily spending, risk day.
3. הסבר קצר, חד, פרקטי, עד 2 שורות בלבד.
4. אל תציע כמה אסטרטגיות. רק את הטובה ביותר.
5. אם הסיכון עדיין גבוה, כתוב זאת בצורה ברורה.

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
- approval_probability_increase: ${approvalIncrease}
- dsr_change: ${Number((best.dsr - currentDsr).toFixed(1))}

החזר JSON בדיוק בסכמה הזו:
{
  "before": { "status": "string", "dsr": 0, "score": 0 },
  "after": { "status": "string", "dsr": 0, "score": 0, "duration_months": 0, "monthly_payment": 0 },
  "impact": { "approval_probability_increase": 0, "dsr_change": 0 },
  "explanation": "string"
}`;

    const llmRes = await base44.integrations.Core.InvokeLLM({
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

    return Response.json({
      ...llmRes,
      meta: {
        risk_factors: riskFactors,
        adjusted_amount: best.adjustedAmount,
        disposable_income: best.disposableIncome,
        projected_eom_balance: projectedEomBalance,
        risk_status: riskStatus,
        forecast_confidence: forecastConfidence
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});