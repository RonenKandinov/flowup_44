import { createClientFromRequest } from 'npm:@base44/sdk';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // קריאת הנתונים מהבקשה (Payload)
    const { connectionId, psuId } = await req.json();

    // 1. קריאה ישירה לפונקציית ה-Ingestion שמביאה נתונים מהבנק
    const ingestionResponse = await base44.functions.invoke('fup_live', {
      action: 'sync',
      connectionId,
      psuId
    });

    // בדיקה אם הבנק החזיר נתונים
    const transactions = ingestionResponse.data?.transactions || [];
    
    if (transactions.length === 0) {
      return Response.json({ 
        success: false, 
        message: "לא נמצאו תנועות בחשבון הבנק. וודא שהחיבור תקין." 
      }, { status: 400 });
    }

    let income = 0;
    let fixed = 0;
    let lifestyle = 0;

    // 2. עיבוד הנתונים האמיתיים מהבנק
    transactions.forEach(tx => {
      const amount = tx.amount?.chargedAmount?.amount || 0;
      const category = (tx.category?.main || '').toLowerCase();
      
      // זיהוי הכנסה (הפקדות חיוביות)
      const isIncome = tx.classification?.type?.includes('INCOME') || amount > 0;

      if (isIncome) {
        income += amount;
      } else {
        const absAmt = Math.abs(amount);
        // סיווג הוצאות קבועות מול משתנות
        const isFixed = ['housing', 'loan', 'insurance', 'transportation', 'utilities'].some(c => category.includes(c));
        
        if (isFixed) {
          fixed += absAmt;
        } else {
          lifestyle += absAmt;
        }
      }
    });

    // 3. חישוב ה-DTI (יחס החזר)
    const dti = income > 0 ? (fixed / income) * 100 : 0;

    // 4. החזרת התוצאה הסופית ל-Frontend
    return Response.json({
      success: true,
      metrics: {
        totalIncome: Math.round(income),
        fixedExpenses: Math.round(fixed),
        lifestyleExpenses: Math.round(lifestyle),
        dti: parseFloat(dti.toFixed(1)), // מחזיר מספר לספידומטר
        status: dti < 40 ? 'GREEN' : dti < 60 ? 'ORANGE' : 'RED'
      },
      simulation: {
        maxLoanCapacity: Math.round((income * 0.4) - fixed)
      }
    });

  } catch (err) {
    // החזרת השגיאה המדויקת כדי שנדע אם ה-ConnectionId פג תוקף
    return Response.json({ 
      error: "Bank Connection Failed", 
      details: err.message 
    }, { status: 400 });
  }
});