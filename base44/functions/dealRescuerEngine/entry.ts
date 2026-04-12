import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const monthlyIncome = Number(body?.income || 0);
    const monthlyExpenses = Number(body?.fixedExpenses || 0);
    const liquidAssets = Number(body?.liquidAssets || 0);
    const requestedAmount = Number(body?.principal || 50000);
    const currentStatus = String(body?.currentStatus || 'borderline').toLowerCase();
    const currentDsr = Number(body?.dsr || (monthlyIncome > 0 ? (monthlyExpenses / monthlyIncome) * 100 : 100));
    const currentScore = Number(body?.score || Math.max(30, Math.min(85, Math.round(85 - currentDsr * 0.7))));
    const requestedDuration = Number(body?.durationMonths || 48);
    const annualRate = Number(body?.baseRate || 0.09);

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

        let score = 75;

        if (newDsr < 30) score += 10;
        else if (newDsr < 40) score += 5;
        else if (newDsr > 50) score -= 15;

        if (disposableIncome > 1500) score += 8;
        else if (disposableIncome < 0) score -= 25;

        if (liquidAssets < monthlyExpenses * 2) score -= 5;

        if (ratio < 1) score += 4;
        if (duration >= requestedDuration) score += 3;

        score = Math.max(40, Math.min(88, Math.round(score))); // 👈 אין יותר 100

        const status =
          score >= 75 && newDsr <= 45 && disposableIncome > 0
            ? 'ניתן לאישור'
            : score > currentScore && disposableIncome > 0
              ? 'שופר אך עדיין בסיכון'
              : 'בסיכון גבוה';

        scenarios.push({
          adjustedAmount,
          duration,
          monthlyPayment: Math.round(monthlyPayment),
          dsr: Number(newDsr.toFixed(1)),
          score,
          disposableIncome: Math.round(disposableIncome),
          status
        });
      }
    }

    scenarios.sort((a, b) => b.score - a.score);
    const best = scenarios[0];

    const approvalIncrease = Math.max(0, best.score - currentScore);

    // 🔥 AI PROMPT
    const aiPrompt = `
ענה בעברית בלבד.

אתה חתם אשראי בכיר.

נתונים לפני:
סטטוס: ${currentStatus}
DSR: ${currentDsr}%
ציון: ${currentScore}

נתונים אחרי:
סטטוס: ${best.status}
DSR: ${best.dsr}%
ציון: ${best.score}
פריסה: ${best.duration} חודשים
החזר חודשי: ${best.monthlyPayment} ₪
תזרים פנוי: ${best.disposableIncome} ₪

כתוב פסקה אחת מקצועית שמסבירה למה המבנה החדש משפר את סיכוי האישור.
התייחס ל-DSR, תזרים ורמת סיכון.
אל תהיה כללי.
`;

    const aiRes = await base44.integrations.Core.InvokeLLM({
      prompt: aiPrompt,
      model: "gemini_3_flash"
    });

    return Response.json({
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
      ai_explanation: aiRes?.output || aiRes,
      meta: {
        adjusted_amount: best.adjustedAmount,
        disposable_income: best.disposableIncome
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});