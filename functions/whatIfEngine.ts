import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

const SCORING_WEIGHTS = {
    STABILITY: 0.35,
    SERVICEABILITY: 0.25,
    LIQUIDITY: 0.25,
    VOLATILITY: 0.15
};

function calculateScore(metrics) {
    const { totalIncome, totalExpenses, fixedExpenses, liquidAssets, incomeVolatility = 0, runwayMonths = 12 } = metrics;
    
    const avgIncome = totalIncome;
    const avgFixedExpenses = fixedExpenses;
    const DTI = avgIncome > 0 ? avgFixedExpenses / avgIncome : 1;
    let scoreServiceability = 0;
    const dtiPerc = DTI * 100;
    
    if (dtiPerc <= 40) scoreServiceability = 80 + (40 - dtiPerc) * 0.5;
    else if (dtiPerc <= 57) scoreServiceability = 55 + (57 - dtiPerc) * (24 / 17);
    else scoreServiceability = Math.max(0, 54 - (dtiPerc - 57));

    // For simplicity, we assume stability and volatility remain constant during WhatIf
    const scoreStability = 100; // Assuming positive history for simulation
    const scoreLiquidity = Math.min(((liquidAssets / (totalExpenses || 1)) / 6) * 100, 100);
    const scoreVolatility = Math.max(0, 100 - (incomeVolatility * 100));

    let finalScore = Math.round(
        (SCORING_WEIGHTS.STABILITY * scoreStability) +
        (SCORING_WEIGHTS.SERVICEABILITY * scoreServiceability) +
        (SCORING_WEIGHTS.LIQUIDITY * scoreLiquidity) +
        (SCORING_WEIGHTS.VOLATILITY * scoreVolatility)
    );

    let riskStatus = "ORANGE";
    if (finalScore >= 80) riskStatus = "GREEN";
    else if (finalScore < 55) riskStatus = "RED";

    return { finalScore, riskStatus, dtiPerc };
}

Deno.serve(async (req) => {
    try {
        const body = await req.json().catch(() => ({}));
        const { baseMetrics, scenario, params } = body;

        if (!baseMetrics) throw new Error("Missing baseMetrics payload");

        let simulatedMetrics = { ...baseMetrics };
        let message = "";

        if (scenario === 'standard_loan') {
            const loanPayment = Number(params?.loanPayment || 0);
            simulatedMetrics.fixedExpenses += loanPayment;
            simulatedMetrics.totalExpenses += loanPayment;
            simulatedMetrics.netCashFlow = simulatedMetrics.totalIncome - simulatedMetrics.totalExpenses;
            simulatedMetrics.runway = simulatedMetrics.totalExpenses > 0 
                ? (simulatedMetrics.liquidAssets / simulatedMetrics.totalExpenses) 
                : 12;
            
            message = simulatedMetrics.netCashFlow < 0 
                ? `החזר רגיל מכניס את הלקוח לסיכון תזרימי. חסר ${Math.abs(Math.round(simulatedMetrics.netCashFlow))} ₪ בחודש.`
                : "הלקוח עומד בהחזר בהצלחה לאורך כל החודש.";

        } else if (scenario === 'lifestyle_pivot') {
            const reductionPercentage = Number(params?.reductionPercentage || 0);
            const flexibleExpenses = baseMetrics.totalExpenses - baseMetrics.fixedExpenses;
            const reductionAmount = flexibleExpenses * (reductionPercentage / 100);
            const loanPayment = Number(params?.loanPayment || 0);

            simulatedMetrics.totalExpenses = baseMetrics.totalExpenses - reductionAmount + loanPayment;
            simulatedMetrics.fixedExpenses += loanPayment;
            simulatedMetrics.lifestyleExpenses = flexibleExpenses - reductionAmount;
            simulatedMetrics.netCashFlow = simulatedMetrics.totalIncome - simulatedMetrics.totalExpenses;
            simulatedMetrics.runway = simulatedMetrics.totalExpenses > 0 
                ? (simulatedMetrics.liquidAssets / simulatedMetrics.totalExpenses) 
                : 12;

            if (simulatedMetrics.netCashFlow >= 0) {
                message = `בצמצום מבוקר של ${reductionPercentage}% מהוצאות הפנאי, הלקוח עומד בהחזר ההלוואה בביטחון של 90%.`;
            } else {
                message = `גם לאחר צמצום של ${reductionPercentage}%, עדיין קיים פער תזרימי.`;
            }

        } else if (scenario === 'closing_tool') {
            const monthlyPayment = Number(params?.monthlyPayment || 0);
            const futureSavings = Number(params?.futureSavings || 0);
            
            simulatedMetrics.fixedExpenses += monthlyPayment;
            simulatedMetrics.totalExpenses += monthlyPayment;
            simulatedMetrics.liquidAssets += futureSavings;
            simulatedMetrics.netCashFlow = simulatedMetrics.totalIncome - simulatedMetrics.totalExpenses;
            simulatedMetrics.runway = simulatedMetrics.totalExpenses > 0 
                ? (simulatedMetrics.liquidAssets / simulatedMetrics.totalExpenses) 
                : 12;

            if (simulatedMetrics.netCashFlow >= 0 || simulatedMetrics.runway >= 36) {
                 message = `מקור הכסף לסגירה מכסה את הבלון. יתרת המזומנים נשמרת יציבה לאורך התקופה.`;
            } else {
                 message = `זהירות: הזרמת ההון העתידית לא מספיקה לייצוב התזרים לאורך זמן.`;
            }
        }

        const { finalScore, riskStatus, dtiPerc } = calculateScore(simulatedMetrics);
        simulatedMetrics.score = finalScore;
        simulatedMetrics.dti = Math.round(dtiPerc);

        // if there's negative net cash flow, status forces to RED (for the sake of the WhatIf logic)
        const finalRiskStatus = simulatedMetrics.netCashFlow < 0 ? "RED" : riskStatus;

        return Response.json({
            success: true,
            status: finalRiskStatus,
            score: finalRiskStatus === "RED" ? Math.min(finalScore, 40) : finalScore,
            metrics: simulatedMetrics,
            message
        });

    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});