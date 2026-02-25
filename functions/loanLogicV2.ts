import { createClientFromRequest } from 'npm:@base44/sdk@0.8.11';
import * as _ from 'npm:lodash@4.17.21';

// --- SHADOW VECTOR LOGIC (Replicated from Protocol) ---
const PRECISION_SCALE = 1000;
const ENTROPY_FACTOR = 1000000;

function toShadow(amount, userKeyFactor) {
    const normalized = amount / PRECISION_SCALE;
    const theta = (userKeyFactor * ENTROPY_FACTOR) % (2 * Math.PI);
    return {
        m: normalized * Math.cos(theta), // Magnitude
        p: normalized * Math.sin(theta)  // Phantom
    };
}

function fromShadow(m, p, userKeyFactor) {
    const theta = (userKeyFactor * ENTROPY_FACTOR) % (2 * Math.PI);
    // x = m*cos + p*sin
    const normalized = (m * Math.cos(theta)) + (p * Math.sin(theta));
    return normalized * PRECISION_SCALE;
}

// --- CORE LOGIC ---
export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { userId } = await req.json();

        // 1. Ingest Raw Data (Service-to-Service)
        const fupResponse = await base44.functions.invoke('fup_live', { userId });
        const rawTransactions = fupResponse.data?.transactions?.data || [];
        
        if (!rawTransactions.length) {
             return Response.json({ error: "No data available for analysis" });
        }

        // 2. Initialize Shadow Protocol (Ephemeral Session Key)
        // We use a random key so even we don't know the projection angle across sessions
        const SESSION_KEY = Math.random() * 1000; 

        // 3. Transform to Shadow Realm (Vector Space)
        const vectors = rawTransactions.map(t => {
            const amount = t.amount?.chargedAmount?.amount || 0;
            const vec = toShadow(amount, SESSION_KEY);
            return {
                ...vec,
                date: new Date(t.date),
                type: amount > 0 ? 'income' : 'expense'
            };
        });

        // 4. Build DNA Profile (Vector Aggregation)
        // Identify Assets & Flows in Vector Space
        const dnaProfile = analyzeDNA(vectors, SESSION_KEY);

        // 5. Monte Carlo Simulation (500 Iterations, 45 Days)
        const simulation = runMonteCarlo(vectors, dnaProfile, SESSION_KEY);

        // 6. Risk Assessment
        const riskAssessment = assessRisk(simulation);

        return Response.json({
            success: true,
            riskProfile: riskAssessment,
            dnaProfile: {
                // Return safe, aggregated stats only
                volatility: dnaProfile.volatility,
                resilienceScore: dnaProfile.resilienceScore
            },
            simulation: {
                survivalProbability: simulation.survivalRate,
                failurePoints: simulation.failureDays
            }
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});

function analyzeDNA(vectors, key) {
    // Calculate Volatility (Standard Deviation of Daily Vectors)
    // We can do this in vector space: StdDev(Mag), StdDev(Phan)
    const dailyChange = vectors.map(v => Math.sqrt(v.m**2 + v.p**2)); // Amplitude
    const mean = _.mean(dailyChange);
    const variance = _.mean(dailyChange.map(x => (x - mean)**2));
    const volatility = Math.sqrt(variance);

    // Identify "Assets" (Positive Flows) -> Resilience Buffer
    // Sum of all positive vectors (Income) over the period
    const incomeVectors = vectors.filter(v => v.type === 'income');
    const totalIncomeM = _.sumBy(incomeVectors, 'm');
    const totalIncomeP = _.sumBy(incomeVectors, 'p');
    
    // Virtual Asset Buffer (e.g. 10% of flow is liquidable)
    const assetBuffer = {
        m: totalIncomeM * 0.1, 
        p: totalIncomeP * 0.1
    };

    return {
        volatility,
        assetBuffer,
        resilienceScore: Math.min((incomeVectors.length / 5) * 100, 100) // Rough score
    };
}

function runMonteCarlo(historyVectors, dna, key) {
    const ITERATIONS = 500;
    const HORIZON = 45;
    
    // Starting Position (Current Balance Vector)
    // For simulation, we need a starting point. 
    // We sum ALL history to get "Current Balance" in vector space
    const startM = _.sumBy(historyVectors, 'm');
    const startP = _.sumBy(historyVectors, 'p');

    let failures = 0;
    const failureDays = {};

    // Weighted SES Factors
    const ALPHA_TREND = 0.7; // Annual
    const ALPHA_VOLATILITY = 0.3; // Recent

    for (let i = 0; i < ITERATIONS; i++) {
        let currentM = startM + dna.assetBuffer.m; // Inject Asset Buffer
        let currentP = startP + dna.assetBuffer.p;

        for (let day = 1; day <= HORIZON; day++) {
            // Predict Daily Flow (Vector)
            // Random walk based on DNA Volatility
            const shock = (Math.random() - 0.5) * dna.volatility; // Simplified vector shock
            
            // Apply Forecast (Simplified SES logic for simulation step)
            // In a full implementation, we'd project trend vectors. 
            // Here we assume mean reversion + shock.
            
            currentM += (shock / PRECISION_SCALE) * Math.cos(key); 
            currentP += (shock / PRECISION_SCALE) * Math.sin(key);

            // Check Failure (Reconstruct to check sign)
            const balance = fromShadow(currentM, currentP, key);
            
            if (balance < 0) {
                failures++;
                failureDays[day] = (failureDays[day] || 0) + 1;
                break; // Bust
            }
        }
    }

    return {
        survivalRate: ((ITERATIONS - failures) / ITERATIONS) * 100,
        failureDays
    };
}

function assessRisk(sim) {
    const survival = sim.survivalRate;
    let status = 'RED';
    let confidence = 'LOW';

    if (survival > 95) {
        status = 'GREEN';
        confidence = 'HIGH';
    } else if (survival > 75) {
        status = 'ORANGE';
        confidence = 'MEDIUM';
    }

    // Find most common failure day
    const riskDayOffset = Object.entries(sim.failureDays)
        .sort((a,b) => b[1] - a[1])[0]?.[0];

    const riskDay = riskDayOffset 
        ? new Date(Date.now() + (parseInt(riskDayOffset) * 86400000)).toISOString()
        : null;

    return {
        riskStatus: status,
        confidence,
        riskDay
    };
}