import { createClientFromRequest } from 'npm:@base44/sdk';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { connectionId, psuId } = await req.json();

    // 1. Ingestion Layer: משיכת נתונים אמיתיים מהבנק
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
      // חילוץ סכום מהמבנה הספציפי של מזרחי
      const amount = tx.amount?.chargedAmount?.amount || 0;
      const category = (tx.category?.main || '').toLowerCase();
      
      // זיהוי הכנסה: סכום חיובי או סיווג כ-INCOME
      const isIncome = tx.classification?.type?.includes('INCOME') || amount > 0;

      if (isIncome) {
        income += amount;
      } else {
        const absAmt = Math.abs(amount);
        // סיווג הוצאות קבועות (משכנתא, הלוואות, ביטוח)
        const isFixed = ['housing', 'loan', 'insurance', 'transportation', 'utilities'].some(c => category.includes(c));
        
        if (isFixed) {
          fixed += absAmt;
        } else {
          lifestyle += absAmt;
        }
      }
    });

    // 3. Financial Calculation
    const dti = income > 0 ? (fixed / income) * 100 : 0;

    // 4. Return Data to React
    return Response.json({
      success: true,
      metrics: {
        totalIncome: Math.round(income),
        fixedExpenses: Math.round(fixed),
        lifestyleExpenses: Math.round(lifestyle),
        dti: parseFloat(dti.toFixed(1)), // מחזירים מספר לספידומטר
        status: dti < 40 ? 'GREEN' : dti < 60 ? 'ORANGE' : 'RED'
      },
      simulation: {
        maxLoanCapacity: Math.round((income * 0.4) - fixed) // כמה נשאר עד גבול ה-40%
      }
    });

  } catch (err) {
    console.error("Logic Error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});