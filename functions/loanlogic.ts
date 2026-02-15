import { createClientFromRequest } from 'npm:@base44/sdk';

export default Deno.serve(async (req) => {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json();
        const { connectionId, psuId } = body;

        // קריאה לצינור הנתונים
        const ingestionResponse = await base44.functions.invoke('fup_live', {
            action: 'sync',
            connectionId,
            psuId
        });

        const transactions = ingestionResponse.data?.transactions || [];

        // חישוב לוגיקה על ה-JSON של מזרחי (בלי lodash)
        let totalIncome = 0;
        let totalFixed = 0;
        let totalLifestyle = 0;

        transactions.forEach(tx => {
            const amount = tx.amount?.chargedAmount?.amount || 0;
            const category = (tx.category?.main || '').toLowerCase();
            const isIncome = tx.classification?.type?.includes('INCOME');

            if (isIncome) {
                totalIncome += amount;
            } else {
                const absAmt = Math.abs(amount);
                const isFixed = ['housing', 'loans', 'insurance', 'transportation'].some(c => category.includes(c));
                if (isFixed) totalFixed += absAmt;
                else totalLifestyle += absAmt;
            }
        });

        const dti = totalIncome > 0 ? (totalFixed / totalIncome) * 100 : 0;

        return Response.json({
            success: true,
            metrics: {
                income: Math.round(totalIncome),
                fixed: Math.round(totalFixed),
                lifestyle: Math.round(totalLifestyle),
                dti: dti.toFixed(1),
                status: dti < 40 ? 'GREEN' : dti < 60 ? 'ORANGE' : 'RED'
            }
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});