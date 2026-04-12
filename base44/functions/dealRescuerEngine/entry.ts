import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const monthlyIncome = Number(body?.income || 0);
    const monthlyExpenses = Number(body?.fixedExpenses || 0);
    const liquidAssets = Number(body?.liquidAssets || 0);
    const requestedAmount = Number(body?.principal || 50000);
    const currentStatus = String(body?.currentStatus || 'borderline').toLowerCase();
    const currentDsr = Number(body?.dsr || (monthlyIncome > 0 ? (monthlyExpenses / monthlyIncome) * 100 : 100));
    const currentScore = Number(body?.score || Math.max(0, Math.min(100, Math.round(100 - currentDsr))));
    const requestedDuration = Number(body?.durationMonths || 48);
    const annualRate = Number(body?.baseRate || 0.09);

    const riskFactors = [];
    if (currentDsr > 45) riskFactors.push('DSR גבוה');
    if (monthlyIncome - monthlyExpenses <= 0) riskFactors.push('תזרים שלילי');
    if (monthlyExpenses > monthlyIncome * 0.85) riskFactors.push('הוצאות גבוהות');
    if (liquidAssets < monthlyExpenses * 2) riskFactors.push('נזילות נמוכה');

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

        let score = 100;
        score -= Math.max(0, newDsr - 30) * 1.6;
        if (disposableIncome < 0) score -= 35;
        if (disposableIncome >= 0 && disposableIncome < 1000) score -= 10;
        if (liquidAssets < monthlyExpenses * 2) score -= 8;
        if (ratio < 1) score += 6;
        if (duration >= requestedDuration) score += 4;
        score = Math.max(0, Math.min(100, Math.round(score)));

        const status = score >= 75 && newDsr <= 45 && disposableIncome > 0
          ? 'likely_approved'
          : score > currentScore && disposableIncome > 0
            ? 'improved'
            : 'still_risky';

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

    scenarios.sort((a, b) => {
      const rank = { likely_approved: 3, improved: 2, still_risky: 1 };
      return (rank[b.status] - rank[a.status]) || (b.score - a.score) || (a.dsr - b.dsr);
    });

    const best = scenarios[0];
    const approvalIncrease = Math.max(0, best.score - currentScore);

    const explanationBase = best.status === 'likely_approved'
      ? 'הארכת התקופה והקטנת ההחזר החודשי הורידו את הלחץ על התזרים ושיפרו משמעותית את סיכוי האישור.'
      : best.status === 'improved'
        ? 'בוצעה התאמה שמקטינה את גובה ההלוואה או פורסת אותה טוב יותר, ולכן משפרת את תוצאת החיתום.'
        : 'נבדקו תרחישי התאמה, אך גם בתרחיש הטוב ביותר רמת הסיכון נותרה גבוהה.';

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
      explanation: explanationBase,
      meta: {
        risk_factors: riskFactors,
        adjusted_amount: best.adjustedAmount,
        disposable_income: best.disposableIncome
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});