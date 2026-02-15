import { createClientFromRequest } from 'npm:@base44/sdk';

export default Deno.serve(async (req) => {
  try {
    // נתוני דוגמה (Mock) - ככה לא צריך להריץ API ולא לשרוף קרדיטים על תיקונים
    const mockTransactions = [
      {
        "amount": { "chargedAmount": { "amount": 10000 } },
        "category": { "main": "INCOME" },
        "classification": { "type": "PRIMARY_INCOME" },
        "description": "משכורת"
      },
      {
        "amount": { "chargedAmount": { "amount": -3500 } },
        "category": { "main": "HOUSING" },
        "classification": { "type": "FIXED_EXPENSE" },
        "description": "שכר דירה"
      },
      {
        "amount": { "chargedAmount": { "amount": -1200 } },
        "category": { "main": "LOAN" },
        "classification": { "type": "FIXED_EXPENSE" },
        "description": "החזר הלוואה רכב"
      },
      {
        "amount": { "chargedAmount": { "amount": -800 } },
        "category": { "main": "ENTERTAINMENT" },
        "classification": { "type": "LIFESTYLE" },
        "description": "Wolt & Netflix"
      }
    ];

    let income = 0;
    let fixed = 0;
    let lifestyle = 0;

    mockTransactions.forEach(tx => {
      const val = tx.amount.chargedAmount.amount;
      const cat = tx.category.main.toLowerCase();
      
      if (val > 0) {
        income += val;
      } else {
        const absVal = Math.abs(val);
        // בדיקה אם ההוצאה היא קשיחה (Fixed)
        if (['housing', 'loan', 'insurance', 'transportation'].includes(cat)) {
          fixed += absVal;
        } else {
          lifestyle += absVal;
        }
      }
    });

    const dti = income > 0 ? (fixed / income) * 100 : 0;

    return Response.json({
      success: true,
      metrics: {
        totalIncome: income,
        fixedExpenses: fixed,
        lifestyleExpenses: lifestyle,
        dti: dti.toFixed(1),
        status: dti < 40 ? 'GREEN' : dti < 60 ? 'ORANGE' : 'RED'
      }
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});