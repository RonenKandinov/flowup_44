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
  if (!transactions || transactions.length === 0) return [];

  const insights = [];
  const sortedTx = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // 1. ניתוח הוצאות חודשיות והשוואה לחודש קודם
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
        score: 80
      });
    } else if (diffPercent < -10) {
      insights.push({
        type: 'success',
        category: 'spending_trend',
        title: 'צמצום הוצאות מרשים',
        message: `הצלחת להקטין את ההוצאות ב-${Math.abs(diffPercent).toFixed(0)}% ביחס לחודש שעבר!`,
        score: 60
      });
    }
  }

  // 2. זיהוי הוצאות גדולות חריגות (Anomaly Detection)
  // מחשבים ממוצע וסטיית תקן להוצאות
  const expenses = sortedTx.filter(t => t.amount < 0).map(t => Math.abs(t.amount));
  if (expenses.length > 5) {
    const avgExpense = expenses.reduce((a, b) => a + b, 0) / expenses.length;
    // עסקאות שגדולות פי 3 מהממוצע (פשטני אבל יעיל)
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
        score: 70
      });
    }
  }

  // 3. ניתוח דפוסי מנויים (Recurring Payments)
  // מחפשים עסקאות שחוזרות על עצמן בסכום זהה
  const recurringMap = {};
  sortedTx.forEach(t => {
    if (t.amount >= 0) return;
    const key = `${t.description}-${Math.abs(t.amount)}`;
    recurringMap[key] = (recurringMap[key] || 0) + 1;
  });

  const subsCount = Object.values(recurringMap).filter(count => count >= 2).length;
  if (subsCount > 5) {
    insights.push({
      type: 'tip',
      category: 'subscriptions',
      title: 'ריבוי הוראות קבע/מנויים',
      message: `זיהינו ${subsCount} חיובים קבועים שונים. כדאי לעבור עליהם ולוודא שכולם עדיין נחוצים.`,
      score: 50
    });
  }

  // 4. תובנות תזרים עתידי (Future Flow)
  if (projectedBalance < 0) {
    insights.push({
      type: 'danger',
      category: 'forecast',
      title: 'סכנת מינוס מתקרבת',
      message: 'על פי קצב ההוצאות הנוכחי, החשבון צפוי להיכנס למינוס במהלך החודש. מומלץ לעצור הוצאות לא חיוניות.',
      score: 100 // High priority
    });
  } else if (projectedBalance > 5000 && currentBalance > 0) {
    insights.push({
      type: 'opportunity',
      category: 'investment',
      title: 'כסף פנוי להשקעה',
      message: `היתרה הצפויה שלך גבוהה (₪${projectedBalance.toLocaleString()}). זה הזמן לשקול הפקדה לפיקדון או חיסכון.`,
      score: 40
    });
  }

  // מיון לפי חשיבות (Score)
  return insights.sort((a, b) => b.score - a.score);
};