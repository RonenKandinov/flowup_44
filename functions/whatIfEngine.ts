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
        termMonths: z.union([z.number(), z.string()]).optional()
    }).passthrough().optional()
}).passthrough();

const SCORING_WEIGHTS = {
    STABILITY: 0.35,
    SERVICEABILITY: 0.25,
    LIQUIDITY: 0.25,
    VOLATILITY: 0.15
};

/**
 * Core scoring function.
 * Returns score=0 immediately if DTI > 100% (income cannot cover fixed obligations).
 */
function calculateScore(metrics) {
    const { totalIncome, totalExpenses, fixedExpenses, liquidAssets, incomeVolatility = 0 } = metrics;
    
    const DTI = totalIncome > 0 ? fixedExpenses / totalIncome : 1;
    const dtiPerc = DTI * 100;

    // Hard floor: if fixed obligations exceed income, repayment is impossible → score = 0
    if (dtiPerc >= 100) {
        return { finalScore: 0, riskStatus: "RED", dtiPerc };
    }

    let scoreServiceability = 0;
    if (dtiPerc <= 40) scoreServiceability = 80 + (40 - dtiPerc) * 0.5;
    else if (dtiPerc <= 57) scoreServiceability = 55 + (57 - dtiPerc) * (24 / 17);
    else scoreServiceability = Math.max(0, 54 - (dtiPerc - 57));

    const scoreStability = 100;
    const scoreLiquidity = Math.min(((liquidAssets / (totalExpenses || 1)) / 6) * 100, 100);
    const scoreVolatility = Math.max(0, 100 - (incomeVolatility * 100));

    let finalScore = Math.round(
        (SCORING_WEIGHTS.STABILITY * scoreStability) +
        (SCORING_WEIGHTS.SERVICEABILITY * scoreServiceability) +
        (SCORING_WEIGHTS.LIQUIDITY * scoreLiquidity) +
        (SCORING_WEIGHTS.VOLATILITY * scoreVolatility)
    );

    // Clamp to [0, 100]
    finalScore = Math.max(0, Math.min(100, finalScore));

    let riskStatus = "ORANGE";
    if (finalScore >= 80) riskStatus = "GREEN";
    else if (finalScore < 55) riskStatus = "RED";

    return { finalScore, riskStatus, dtiPerc };
}

// --- Unit Tests (run on cold start) ---
function runTests() {
    const cases = [
        {
            name: "DTI > 100% → score must be 0",
            metrics: { totalIncome: 1636, totalExpenses: 41809, fixedExpenses: 39390, liquidAssets: 3102 },
            expect: { score: 0, status: "RED" }
        },
        {
            name: "Healthy profile → score >= 80",
            metrics: { totalIncome: 20000, totalExpenses: 8000, fixedExpenses: 5000, liquidAssets: 60000 },
            expect: { score: 80, status: "GREEN", gte: true }
        },
        {
            name: "Borderline DTI 45% → not GREEN",
            metrics: { totalIncome: 10000, totalExpenses: 6000, fixedExpenses: 4500, liquidAssets: 500 },
            expect: { status: "ORANGE" }
        }
    ];

    let passed = 0;
    cases.forEach(tc => {
        const { finalScore, riskStatus } = calculateScore(tc.metrics);
        let ok = true;
        if (tc.expect.score !== undefined) {
            ok = tc.expect.gte ? finalScore >= tc.expect.score : finalScore === tc.expect.score;
        }
        if (tc.expect.status) ok = ok && riskStatus === tc.expect.status;
        if (ok) {
            passed++;
            console.log(`[WhatIfEngine Test ✓] ${tc.name} → score=${finalScore}, status=${riskStatus}`);
        } else {
            console.error(`[WhatIfEngine Test ✗] ${tc.name} → got score=${finalScore}, status=${riskStatus}, expected`, tc.expect);
        }
    });
    console.log(`[WhatIfEngine Tests] ${passed}/${cases.length} passed`);
}
runTests();

Deno.serve(withValidation(whatIfSchema, async (req) => {
    try {
        const body = await req.json().catch(() => ({}));
        const { baseMetrics, scenario, params } = body;

        const activeMetrics = {
            ...(baseMetrics || {}),
            totalIncome: baseMetrics?.totalIncome ?? 20000,
            totalExpenses: baseMetrics?.totalExpenses ?? 15000,
            fixedExpenses: baseMetrics?.totalFixedExpenses ?? baseMetrics?.fixedExpenses ?? 10000,
            liquidAssets: baseMetrics?.liquidAssets ?? 50000,
            incomeVolatility: baseMetrics?.incomeVolatility ?? 0.1,
        };
        activeMetrics.netCashFlow = activeMetrics.totalIncome - activeMetrics.totalExpenses;

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
                ? simulatedMetrics.liquidAssets / simulatedMetrics.totalExpenses
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
                message = `BLOCKED: חסר הון לכיסוי הקרן. גם עם חיסכון צפוי של ₪${Math.round(projectedSavings)}, לא תגיע ל-₪${loanAmount}.`;
            } else if (simulatedMetrics.liquidAssets < loanAmount) {
                simulatedMetrics.runway = simulatedMetrics.totalExpenses > 0
                    ? simulatedMetrics.liquidAssets / simulatedMetrics.totalExpenses
                    : 12;
                message = `APPROVED: בהתבסס על היסטוריית החיסכון תוכל לכסות את הקרן בסוף התקופה.`;
            } else {
                simulatedMetrics.runway = simulatedMetrics.totalExpenses > 0
                    ? simulatedMetrics.liquidAssets / simulatedMetrics.totalExpenses
                    : 12;
                message = `APPROVED (Smart Logic): ההחזר החודשי הוא ₪${Math.round(simulatedPayment)} בלבד, מבוסס על הון קיים.`;
            }
        }

        if (isBlocked) {
            return Response.json({
                success: true,
                status: "RED",
                score: 0,
                metrics: { ...simulatedMetrics, score: 0, dti: 9999 },
                message
            });
        }

        const { finalScore, riskStatus, dtiPerc } = calculateScore(simulatedMetrics);

        // Apply negative cash-flow penalty on top of score
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

        simulatedMetrics.score = finalScoreValue;
        simulatedMetrics.dti = Math.round(dtiPerc);
        simulatedMetrics.totalFixedExpenses = Math.round(simulatedMetrics.fixedExpenses);
        simulatedMetrics.totalLifestyleExpenses = Math.round(simulatedMetrics.totalExpenses - simulatedMetrics.fixedExpenses);

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