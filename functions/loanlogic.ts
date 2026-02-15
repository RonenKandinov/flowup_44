import { createClientFromRequest } from 'npm:@base44/sdk';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { connectionId, psuId } = await req.json();

    // 1. Ingestion Layer: קריאה ישירה ל-fup_live (הצינור מהבנק)
    const ingestionResponse = await base44.functions.invoke('fup_live', {
      action: 'sync',
      connectionId,
      psuId
    });

    const transactions = ingestionResponse.data?.transactions || [];

    // 2. Logic Layer: עיבוד הנתונים האמיתיים של מזרחי
    let income = 0;
    let fixed = 0;
    let lifestyle = 0;

    transactions.forEach(tx => {
      // חילוץ סכום מדויק מהמבנה של מזרחי
      const amount = tx.amount?.chargedAmount?.amount || 0;
      const category = (tx.category?.main || '').toLowerCase();
      const isIncome = tx.classification?.type?.includes('INCOME') || amount > 0;

      if (isIncome) {
        income += amount;
      } else {
        const absAmt = Math.abs(amount);
        // סיווג הוצאות קשיחות (Fixed)
        const isFixed = ['housing', 'loan', 'insurance', 'transportation'].some(c => category.includes(c));
        if (isFixed) fixed += absAmt;
        else lifestyle += absAmt;
      }
    });

    const dti = income > 0 ? (fixed / income) * 100 : 0;

    // 3. Return Insights: התובנות שנשלחות ל-React
    return Response.json({
      success: true,
      metrics: {
        totalIncome: Math.round(income),
        fixedExpenses: Math.round(fixed),
        lifestyleExpenses: Math.round(lifestyle),
        dti: parseFloat(dti.toFixed(1)), // מחזירים מספר בשביל ה-Speedometer
        status: dti < 40 ? 'GREEN' : dti < 60 ? 'ORANGE' : 'RED'
      },
      simulation: {
        potentialSavings: Math.round(lifestyle),
        maxLoanCapacity: Math.round((income * 0.4) - fixed)
      }
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});