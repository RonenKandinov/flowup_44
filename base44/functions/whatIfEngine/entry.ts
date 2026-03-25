import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';
import { z } from 'npm:zod';

function withValidation(schema, handler) {
    return async (req) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            try {
                const body = await req.clone().json();
                const validation = schema.safeParse(body);
                if (!validation.success) {
                    return Response.json({ 
                        success: false, 
                        error: "Payload validation failed", 
                        details: validation.error.issues 
                    }, { status: 400 });
                }
            } catch (e) {
                // Ignore empty bodies
            }
        }
        return handler(req);
    };
}

const whatIfSchema = z.object({
    baseMetrics: z.object({
        totalIncome: z.number().optional(),
        totalExpenses: z.number().optional(),
        liquidAssets: z.number().optional()
    }).passthrough().optional(),
    scenario: z.string().optional(),
    params: z.object({
        loanAmount: z.union([z.number(), z.string()]).optional(),
        annualRate: z.union([z.number(), z.string()]).optional(),
        termMonths: z.union([z.number(), z.string()]).optional(),
        incomeReduction: z.union([z.number(), z.string()]).optional(),
        expenseIncrease: z.union([z.number(), z.string()]).optional(),
        assetReduction: z.union([z.number(), z.string()]).optional()
    }).passthrough().optional()
}).passthrough();

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

    // --- EXTREME RISK CLAMP LAYER ---
    const isHighRiskDTI = dtiPerc > 120;
    const isHighRiskCashFlow = totalIncome > 0 ? (totalExpenses > totalIncome * 1.2) : (totalExpenses > 0);
    if (isHighRiskDTI || isHighRiskCashFlow) {
        finalScore = Math.min(finalScore, 45); // Medium range
    }

    const isExtremeDTI = dtiPerc > 150;
    const isExtremeCashFlow = totalIncome > 0 ? (totalExpenses > totalIncome * 1.5) : (totalExpenses > 0);
    if (isExtremeDTI || isExtremeCashFlow) {
        finalScore = Math.min(finalScore, 25);
        const isVeryExtreme = dtiPerc > 200 || (totalIncome > 0 && totalExpenses > totalIncome * 2.0);
        if (isVeryExtreme) finalScore = Math.min(finalScore, 5);
    }
    // --------------------------------

    let riskStatus = "ORANGE";
    if (finalScore >= 80) riskStatus = "GREEN";
    else if (finalScore < 55) riskStatus = "RED";

    return { finalScore, riskStatus, dtiPerc };
}

Deno.serve(withValidation(whatIfSchema, async (req) => {
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
        
        // Stress Test Params
        const incomeReduction = Number(params?.incomeReduction || 0);
        const expenseIncrease = Number(params?.expenseIncrease || 0);
        const assetReduction = Number(params?.assetReduction || 0);

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
        } else if (scenario === 'stress_test') {
            // Apply Stress Factors
            simulatedMetrics.totalIncome = simulatedMetrics.totalIncome * (1 - (incomeReduction / 100));
            simulatedMetrics.totalExpenses = simulatedMetrics.totalExpenses * (1 + (expenseIncrease / 100));
            simulatedMetrics.fixedExpenses = simulatedMetrics.fixedExpenses * (1 + (expenseIncrease / 100));
            simulatedMetrics.liquidAssets = simulatedMetrics.liquidAssets * (1 - (assetReduction / 100));
            
            simulatedMetrics.netCashFlow = simulatedMetrics.totalIncome - simulatedMetrics.totalExpenses;
            simulatedMetrics.runway = simulatedMetrics.totalExpenses > 0 
                ? (simulatedMetrics.liquidAssets / simulatedMetrics.totalExpenses) 
                : 12;

            // Recalculate DTI with stressed numbers
            const stressedDTI = simulatedMetrics.totalIncome > 0 ? (simulatedMetrics.fixedExpenses / simulatedMetrics.totalIncome) * 100 : 100;
            
            let violations = [];
            if (stressedDTI > 45) violations.push(`DTI חורג (${stressedDTI.toFixed(1)}%)`);
            if (simulatedMetrics.netCashFlow < 0) violations.push(`תזרים שלילי (₪${Math.round(simulatedMetrics.netCashFlow)})`);
            if (simulatedMetrics.runway < 3) violations.push(`נזילות נמוכה (${simulatedMetrics.runway.toFixed(1)} חודשים)`);

            if (violations.length > 0) {
                message = `נכשל במבחן לחץ: ${violations.join(', ')}.`;
                isBlocked = true; 
            } else {
                message = `עבר בהצלחה: הלקוח עומד בתרחיש הקיצון. DTI: ${stressedDTI.toFixed(1)}%, נזילות: ${simulatedMetrics.runway.toFixed(1)} חודשים.`;
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

        let finalRiskStatus = riskStatus;
        let finalScoreValue = finalScore;

       if (simulatedMetrics.netCashFlow < 0) {
            if (simulatedMetrics.runway >= 6) {
                finalRiskStatus = riskStatus === "GREEN" ? "ORANGE" : riskStatus;
                finalScoreValue = Math.max(0, finalScore - 10);
            } else {
                finalRiskStatus = "RED";
                finalScoreValue = Math.max(0, finalScore - 30);
            }
        }
        return Response.json({
            success: true,
            status: finalRiskStatus,
            score: finalScoreValue,
            metrics: simulatedMetrics,
            message
        });

    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}));