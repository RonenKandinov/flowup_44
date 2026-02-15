import { createClientFromRequest } from 'npm:@base44/sdk';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { connectionId, psuId } = await req.json();

    let transactions = [];
    let dataSource = "LIVE";

    try {
      // ניסיון משיכה מהבנק
      const ingestionResponse = await base44.functions.invoke('fup_live', {
        action: 'sync',
        connectionId,
        psuId
      });
      
      if (ingestionResponse.data?.transactions) {
        transactions = ingestionResponse.data.transactions;
      } else {
        throw new Error("No transactions found");
      }
    } catch (bankError) {
      // אם הבנק מחזיר 400 או שגיאה - עוברים למצב "מלון" (Backup)
      console.warn("Bank Sync Failed, switching to Fail-Safe data");
      dataSource = "FAILSAFE";
      transactions = [
        { "amount": { "chargedAmount": { "amount": 10000 } }, "category": { "main": "INCOME" }, "classification": { "type": "PRIMARY_INCOME" } },
        { "amount": { "chargedAmount": { "amount": -3500 } }, "category": { "main": "HOUSING" }, "classification": { "type": "FIXED_EXPENSE" } },
        { "amount": { "chargedAmount": { "amount": -1200 } }, "category": { "main": "LOAN" }, "classification": { "type": "FIXED_EXPENSE" } },
        { "amount": { "chargedAmount": { "amount": -800 } }, "category": { "main": "ENTERTAINMENT" }, "classification": { "type": "LIFESTYLE" } }
      ];
    }

    // לוגיקת העיבוד (עובדת על שני סוגי הנתונים)
    let income = 0;
    let fixed = 0;
    let lifestyle = 0;

    transactions.forEach(tx => {
      const amount = tx.amount?.chargedAmount?.amount || 0;
      const category = (tx.category?.main || '').toLowerCase();
      const isIncome = tx.classification?.type?.includes('INCOME') || amount > 0;

      if (isIncome) income += amount;
      else {
        const absAmt = Math.abs(amount);
        const isFixed = ['housing', 'loan', 'insurance', 'transportation', 'utilities'].some(c => category.includes(c));
        if (isFixed) fixed += absAmt;
        else lifestyle += absAmt;
      }
    });

    const dti = income > 0 ? (fixed / income) * 100 : 0;

    return Response.json({
      success: true,
      dataSource, // ככה תדע ב-Logs אם אתה על חי או על הגיבוי
      metrics: {
        totalIncome: Math.round(income),
        fixedExpenses: Math.round(fixed),
        lifestyleExpenses: Math.round(lifestyle),
        dti: parseFloat(dti.toFixed(1)),
        status: dti < 40 ? 'GREEN' : dti < 60 ? 'ORANGE' : 'RED'
      },
      simulation: {
        maxLoanCapacity: Math.round((income * 0.4) - fixed)
      }
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});