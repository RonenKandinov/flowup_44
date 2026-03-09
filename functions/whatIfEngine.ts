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

        // Provide default dummy metrics for dashboard testing if not provided
        const activeMetrics = {
            ...(baseMetrics || {}),
            totalIncome: baseMetrics?.totalIncome ?? 20000,
            totalExpenses: baseMetrics?.totalExpenses ?? 15000,
            fixedExpenses: baseMetrics?.totalFixedExpenses ?? baseMetrics?.fixedExpenses ?? 10000,
            liquidAssets: baseMetrics?.liquidAssets ?? 50000,
            incomeVolatility: baseMetrics?.incomeVolatility ?? 0.1,
            runwayMonths: baseMetrics?.runwayMonths ?? 12,
            netCashFlow: (baseMetrics?.totalIncome ?? 20000) - (baseMetrics?.totalExpenses ?? 15000)
        };

        let simulatedMetrics = { ...activeMetrics };
        let message = "";
        let simulatedPayment = 0;
        let isBlocked = false;

        const loanAmount = Number(params?.loanAmount || 0);
        const annualRate = Number(params?.annualRate || 0);
        const termMonths = Number(params?.termMonths || 0);

        function calculateSpitzer(L, annualInterest, n) {
            if (L <= 0 || n <= 0) return 0;
            const i = (annualInterest / 100) / 12;
            if (i === 0) return L / n;
            return L * ((i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1));
        }

        if (scenario === 'standard_loan' || scenario === 'extended_loan') {
            simulatedPayment = calculateSpitzer(loanAmount, annualRate, termMonths);
            
            simulatedMetrics.fixedExpenses += simulatedPayment;
            simulatedMetrics.totalExpenses += simulatedPayment;
            simulatedMetrics.netCashFlow = simulatedMetrics.totalIncome - simulatedMetrics.totalExpenses;
            simulatedMetrics.runway = simulatedMetrics.totalExpenses > 0 
                ? (simulatedMetrics.liquidAssets / simulatedMetrics.totalExpenses) 
                : 12;
            
            if (simulatedMetrics.netCashFlow < 0) {
                if (simulatedMetrics.runway >= 6) {
                    message = `ההחזר (₪${Math.round(simulatedPayment)}) יוצר גירעון תזרימי (₪${Math.abs(Math.round(simulatedMetrics.netCashFlow))}-), אך קיים באפר נזילות של ${simulatedMetrics.runway.toFixed(1)} חודשים.`;
                } else {
                    message = `ההחזר (₪${Math.round(simulatedPayment)}) מכניס לסיכון תזרימי. חסר ₪${Math.abs(Math.round(simulatedMetrics.netCashFlow))} בחודש, ובאפר הנזילות נמוך (${simulatedMetrics.runway.toFixed(1)} חודשים).`;
                }
            } else {
                message = `מאושר. ההחזר החודשי (₪${Math.round(simulatedPayment)}) משאיר את הלקוח עם תזרים חיובי.`;
            }

        } else if (scenario === 'balloon_loan') {
            simulatedPayment = (loanAmount * (annualRate / 100)) / 12;
            simulatedMetrics.fixedExpenses += simulatedPayment;
            simulatedMetrics.totalExpenses += simulatedPayment;
            simulatedMetrics.netCashFlow = simulatedMetrics.totalIncome - simulatedMetrics.totalExpenses;
            
            const projectedSavings = Math.max(0, simulatedMetrics.netCashFlow) * termMonths;
            const totalAvailableAtEnd = simulatedMetrics.liquidAssets + projectedSavings;

            if (totalAvailableAtEnd < loanAmount) {
                isBlocked = true;
                message = `BLOCKED: חסר הון לכיסוי הקרן. גם עם חיסכון צפוי של ₪${Math.round(projectedSavings)} (לפי ממוצע 6 חודשים), לא תגיע ל-₪${loanAmount}.`;
            } else if (simulatedMetrics.liquidAssets < loanAmount) {
                simulatedMetrics.runway = simulatedMetrics.totalExpenses > 0 
                    ? (simulatedMetrics.liquidAssets / simulatedMetrics.totalExpenses) 
                    : 12;
                message = `APPROVED: אין מספיק הון כרגע, אך בהתבסס על היסטוריית החיסכון (6 חודשים אחרונים) תוכל לכסות את הקרן בסוף התקופה.`;
            } else {
                simulatedMetrics.runway = simulatedMetrics.totalExpenses > 0 
                    ? (simulatedMetrics.liquidAssets / simulatedMetrics.totalExpenses) 
                    : 12;
                message = `APPROVED (Smart Logic): ההחזר החודשי הוא ₪${Math.round(simulatedPayment)} בלבד, מבוסס על הון קיים.`;
            }
        }

        const { finalScore, riskStatus, dtiPerc } = calculateScore(simulatedMetrics);
        
        if (isBlocked) {
            simulatedMetrics.score = 0;
            simulatedMetrics.dti = Math.round(dtiPerc);
            return Response.json({
                success: true,
                status: "RED",
                score: 0,
                metrics: simulatedMetrics,
                message
            });
        }
        simulatedMetrics.score = finalScore;
        simulatedMetrics.dti = Math.round(dtiPerc);
        simulatedMetrics.totalFixedExpenses = Math.round(simulatedMetrics.fixedExpenses);
        simulatedMetrics.totalLifestyleExpenses = Math.round(simulatedMetrics.totalExpenses - simulatedMetrics.fixedExpenses);

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