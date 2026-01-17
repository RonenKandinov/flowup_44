import { startOfMonth, subMonths, isSameMonth, parseISO } from 'date-fns';

/**
 * מנוע ניתוח פיננסי מקומי (Client-Side AI)
 * מנתח דפוסים ללא שליחת מידע לשרת
 */

// מילות מפתח לסיווג בסיסי (Heuristic Classification)
const CATEGORIES = {
  FOOD: ['שופרסל', 'רמי לוי', 'טיב טעם', 'אושר עד', 'ויקטורי', 'מגה', 'יוחננוף', 'מזון', 'סופר'],
  FUEL: ['דלק', 'פז', 'סונול', 'דור אלון', 'טן'],
  COMMUNICATION: ['פרטנר', 'סלקום', 'פלאפון', 'בזק', 'הוט', 'yes', 'נטפליקס'],
  INSURANCE: ['ביטוח', 'הראל', 'מגדל', 'כלל', 'מנורה', 'הפניקס'],
  RESTAURANTS: ['מסעדה', 'קפה', 'פיצה', 'בורגר', 'ארומה', 'ארקפה', 'wolt', 'תן ביס']
};

export const analyzeFinancialPatterns = (transactions, currentBalance, projectedBalance) => {
  const insights = [];

  // --- 1. בדיקת יציבות פיננסית (לוגיקה מ-LeverageCard) ---
  if (projectedBalance > 3000) {
    insights.push({
      type: 'stable',
      category: 'status',
      title: 'מצב פיננסי יציב',
      message: 'היתרה הצפויה שלך מעל ₪3,000 - אין צורך בהמלצות חיסכון דחופות כרגע.',
      score: 100
    });
  } else {
    // המלצות חיסכון (אם המצב לא יציב)
    const urgency = projectedBalance < 1000 ? 'high' : projectedBalance < 2000 ? 'medium' : 'low';
    
    // המלצה 1: חיסכון אוטומטי
    const saveAmount = urgency === 'high' ? 50 : urgency === 'medium' ? 100 : 200;
    insights.push({
      type: 'recommendation',
      category: 'saving',
      title: 'הגדר חיסכון אוטומטי',
      message: 'הגדר העברה אוטומטית לחשבון חיסכון בכל תחילת חודש',
      amount: saveAmount,
      impact: saveAmount * 12,
      icon: '🏦',
      score: 90
    });

    // המלצה 2: צמצום הוצאות (אם יש ירידה גדולה)
    if (currentBalance && projectedBalance) {
      const monthlyDrop = currentBalance - projectedBalance;
      if (monthlyDrop > 500) {
        const cutAmount = Math.min(Math.round(monthlyDrop * 0.2), 300);
        insights.push({
          type: 'recommendation',
          category: 'cutting',
          title: 'צמצם הוצאות חודשיות',
          message: 'זיהינו ירידה חודשית גבוהה - נסה לצמצם הוצאות לא הכרחיות',
          amount: cutAmount,
          impact: Math.round(monthlyDrop * 0.2 * 12),
          icon: '✂️',
          score: 85
        });
      }
    }

    // המלצה 3: בדיקת תוכניות
    const billSaveAmount = urgency === 'high' ? 30 : urgency === 'medium' ? 50 : 80;
    insights.push({
      type: 'recommendation',
      category: 'bills',
      title: 'בדוק תוכניות סלולר וביטוח',
      message: 'מעבר לחברת סלולר זולה יותר או ביטוח משתלם יכול לחסוך כסף רב',
      amount: billSaveAmount,
      impact: billSaveAmount * 12,
      icon: '📱',
      score: 80
    });
  }

  if (!transactions || transactions.length === 0) return insights.sort((a, b) => b.score - a.score);

  const sortedTx = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // --- 2. ניתוח הוצאות חודשיות והשוואה לחודש קודם ---
  const currentMonth = new Date();
  const lastMonth = subMonths(currentMonth, 1);
  
  const thisMonthExpenses = sortedTx.filter(t => 
    isSameMonth(new Date(t.date), currentMonth) && t.amount < 0
  ).reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const lastMonthExpenses = sortedTx.filter(t => 
    isSameMonth(new Date(t.date), lastMonth) && t.amount < 0
  ).reduce((sum, t) => sum + Math.abs(t.amount), 0);

  if (lastMonthExpenses > 0) {
    const diffPercent = ((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100;
    
    if (diffPercent > 15) {
      insights.push({
        type: 'warning',
        category: 'spending_trend',
        title: 'עלייה חריגה בהוצאות',
        message: `החודש הוצאת ${diffPercent.toFixed(0)}% יותר מאשר בחודש שעבר. שווה לבדוק על מה הלך הכסף.`,
        score: 75
      });
    } else if (diffPercent < -10) {
      insights.push({
        type: 'success',
        category: 'spending_trend',
        title: 'צמצום הוצאות מרשים',
        message: `הצלחת להקטין את ההוצאות ב-${Math.abs(diffPercent).toFixed(0)}% ביחס לחודש שעבר!`,
        score: 70
      });
    }
  }

  // --- 3. זיהוי הוצאות גדולות חריגות (Anomaly Detection) ---
  const expenses = sortedTx.filter(t => t.amount < 0).map(t => Math.abs(t.amount));
  if (expenses.length > 5) {
    const avgExpense = expenses.reduce((a, b) => a + b, 0) / expenses.length;
    const largeTransactions = sortedTx.filter(t => 
      t.amount < 0 && Math.abs(t.amount) > avgExpense * 4 && 
      isSameMonth(new Date(t.date), currentMonth)
    );

    if (largeTransactions.length > 0) {
      const topTx = largeTransactions[0];
      insights.push({
        type: 'info',
        category: 'anomaly',
        title: 'הוצאה גדולה זוהתה',
        message: `שמנו לב להוצאה חריגה של ₪${Math.abs(topTx.amount).toLocaleString()} ב"${topTx.description}". האם זה היה מתוכנן?`,
        score: 65
      });
    }
  }

  // --- 4. תובנות תזרים עתידי (Future Flow) ---
  if (projectedBalance < 0) {
    insights.push({
      type: 'danger',
      category: 'forecast',
      title: 'סכנת מינוס מתקרבת',
      message: 'על פי קצב ההוצאות הנוכחי, החשבון צפוי להיכנס למינוס במהלך החודש. מומלץ לעצור הוצאות לא חיוניות.',
      score: 95
    });
  } else if (projectedBalance > 5000 && currentBalance > 0) {
    insights.push({
      type: 'opportunity',
      category: 'investment',
      title: 'כסף פנוי להשקעה',
      message: `היתרה הצפויה שלך גבוהה (₪${projectedBalance.toLocaleString()}). זה הזמן לשקול הפקדה לפיקדון או חיסכון.`,
      score: 60
    });
  }

  // מיון לפי חשיבות (Score)
  return insights.sort((a, b) => b.score - a.score);
};