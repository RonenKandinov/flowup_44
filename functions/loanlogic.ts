import { createClientFromRequest } from 'npm:@base44/sdk@0.8.11';
import * as _ from 'npm:lodash@4.17.21';

// Keyword dictionaries for categorization
const CATEGORIES = {
    FIXED: ['rent', 'mortgage', 'loan', 'insurance', 'car', 'transport', 'utilities', 'municipal', 'tax'],
    INCOME: ['salary', 'deposit', 'transfer_in', 'bit_in', 'paybox_in']
};

export default Deno.serve(async (req) => {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    try {
        const base44 = createClientFromRequest(req);
        const { connectionId, psuId } = await req.json();

        if (!connectionId || !psuId) {
            return Response.json({ error: "Missing connectionId or psuId" }, { status: 400 });
        }

        // 1. Ingestion Layer: Fetch Raw Data via fup_live
        // We invoke fup_live securely from the backend (Service-to-Service)
        const ingestionResponse = await base44.functions.invoke('fup_live', {
            action: 'sync',
            connectionId,
            psuId
        });

        const rawData = ingestionResponse.data;
        if (rawData.error || !rawData.transactions) {
            throw new Error(rawData.error || "Failed to fetch transactions");
        }

        // 2. Logic Layer: Process & Score
        const analysis = processFinancials(rawData.transactions);

        // 3. Return Zero-Knowledge Insights (No raw transactions)
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

function processFinancials(transactions) {
    // A. Clean & Categorize
    const categorized = transactions.map(tx => {
        const amount = tx.amount ?? ((tx.credit || 0) - (tx.debit || 0));
        const desc = (tx.description || '').toLowerCase();
        
        let type = 'LIFESTYLE'; // Default to lifestyle (variable)
        
        if (amount > 0) {
            type = 'INCOME'; // Simple heuristic, can be refined
        } else {
            // Check for Fixed Expenses
            if (CATEGORIES.FIXED.some(keyword => desc.includes(keyword))) {
                type = 'FIXED';
            }
        }
        
        return { amount, type };
    });

    // B. Calculate Totals (Monthly Average Approximation - assumes data is relevant period)
    // For MVP, we sum all provided transactions. In prod, filtering by date range is needed.
    const totalIncome = _.sumBy(categorized.filter(t => t.type === 'INCOME'), 'amount');
    
    // Expenses are usually negative, we want absolute values for ratios
    const totalFixed = Math.abs(_.sumBy(categorized.filter(t => t.type === 'FIXED'), 'amount'));
    const totalLifestyle = Math.abs(_.sumBy(categorized.filter(t => t.type === 'LIFESTYLE' && t.amount < 0), 'amount'));
    const totalExpenses = totalFixed + totalLifestyle;

    // C. Calculate DTI
    // DTI = (Fixed Expenses / Total Income) * 100
    // Avoid division by zero
    const dti = totalIncome > 0 ? ((totalFixed / totalIncome) * 100) : 0;

    // D. Scoring (Traffic Light)
    let trafficLight = 'RED';
    if (dti < 30) trafficLight = 'GREEN';
    else if (dti < 45) trafficLight = 'ORANGE';

    // Net Cashflow
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
        // For UI "Future Cake"
        expenseAnalysis: {
            fixed: Math.round(totalFixed),
            flex: Math.round(totalLifestyle), // "Lifestyle" is Flex
            taxPotential: 0 // Placeholder
        },
        // For UI "Speedometer" (Mapping Traffic Light to Risk)
        riskProfile: {
            level: trafficLight === 'GREEN' ? 'LOW' : (trafficLight === 'ORANGE' ? 'MEDIUM' : 'HIGH'),
            score: trafficLight === 'GREEN' ? 850 : (trafficLight === 'ORANGE' ? 650 : 500)
        }
    };
}