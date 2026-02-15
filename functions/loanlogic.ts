import { createClientFromRequest } from 'npm:@base44/sdk';

// Keyword dictionaries for categorization mapping
const FIXED_CATEGORIES = ['housing', 'loans', 'transportation', 'insurance', 'tax', 'utilities'];

export default Deno.serve(async (req) => {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    try {
        const base44 = createClientFromRequest(req);
        const { connectionId, psuId } = await req.json();

        if (!connectionId || !psuId) {
            return Response.json({ error: "Missing connectionId or psuId" }, { status: 400 });
        }

        // 1. Ingestion Layer: Fetch Raw Data via fup_live
        const ingestionResponse = await base44.functions.invoke('fup_live', {
            action: 'sync',
            connectionId,
            psuId
        });

        const rawData = ingestionResponse.data;
        if (rawData.error || !rawData.transactions) {
            throw new Error(rawData.error || "Failed to fetch transactions");
        }

        // 2. Logic Layer: Process & Score (Mizrahi Specific)
        const analysis = processMizrahiFinancials(rawData.transactions);

        // 3. Return Zero-Knowledge Insights
        return Response.json({
            success: true,
            timestamp: new Date().toISOString(),
            ...analysis
        });

    } catch (error) {
        console.error("LoanLogic Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

function processMizrahiFinancials(transactions) {
    // A. Clean & Categorize using Mizrahi Structure
    const categorized = transactions.map(tx => {
        // Extract Amount: amount.chargedAmount.amount
        const rawAmount = tx.amount?.chargedAmount?.amount ?? 0;
        const amount = parseFloat(rawAmount);

        // Identify Type: classification.type
        const rawType = (tx.classification?.type || '').toUpperCase(); // EXPECTED: 'INCOME' or 'EXPENSE' (or similar)
        
        // Map Category: category.main
        const rawCategory = (tx.category?.main || '').toLowerCase();
        
        let finalType = 'LIFESTYLE'; // Default to variable expense
        
        if (rawType === 'INCOME' || (rawType !== 'EXPENSE' && amount > 0)) {
            finalType = 'INCOME';
        } else {
            // It's an expense, check if Fixed or Lifestyle
            if (FIXED_CATEGORIES.some(c => rawCategory.includes(c))) {
                finalType = 'FIXED';
            }
        }
        
        return { amount: Math.abs(amount), type: finalType, rawType };
    });

    // B. Calculate Totals
    const totalIncome = _.sumBy(categorized.filter(t => t.type === 'INCOME'), 'amount');
    const totalFixed = _.sumBy(categorized.filter(t => t.type === 'FIXED'), 'amount');
    const totalLifestyle = _.sumBy(categorized.filter(t => t.type === 'LIFESTYLE'), 'amount');
    const totalExpenses = totalFixed + totalLifestyle;

    // C. Calculate DTI = (Fixed Expenses / Total Income) * 100
    const dti = totalIncome > 0 ? ((totalFixed / totalIncome) * 100) : 0;

    // D. Scoring (Traffic Light)
    // Green: DTI < 30%
    // Orange: 30% <= DTI < 45%
    // Red: DTI >= 45%
    let trafficLight = 'RED';
    if (dti < 30) trafficLight = 'GREEN';
    else if (dti < 45) trafficLight = 'ORANGE';

    const netCashflow = totalIncome - totalExpenses;

    return {
        metrics: {
            totalIncome: Math.round(totalIncome),
            totalFixedExpenses: Math.round(totalFixed),
            totalLifestyleExpenses: Math.round(totalLifestyle),
            totalExpenses: Math.round(totalExpenses),
            netCashflow: Math.round(netCashflow),
            dti: parseFloat(dti.toFixed(1)),
            trafficLight
        },
        expenseAnalysis: {
            fixed: Math.round(totalFixed),
            flex: Math.round(totalLifestyle),
            taxPotential: 0
        },
        riskProfile: {
            level: trafficLight === 'GREEN' ? 'LOW' : (trafficLight === 'ORANGE' ? 'MEDIUM' : 'HIGH'),
            score: trafficLight === 'GREEN' ? 850 : (trafficLight === 'ORANGE' ? 650 : 500)
        }
    };
}