/**
 * FlowUp - מסמך חוקה ותיעוד מערכת
 * ===================================
 * 
 * ## מהי FlowUp?
 * 
 * FlowUp היא מערכת ניתוח תזרים מזומנים אישי שמנתחת תנועות בנקאיות 
 * ומספקת תחזית של 30 יום קדימה.
 * 
 * ליבת המערכת:
 * - פרסור CSV מבנקים ישראליים (פועלים, לאומי, דיסקונט, מזרחי, בינלאומי)
 * - מנוע תחזיות היברידי המשלב ממוצעים ומגמות אחרונות
 * - מדד סיכון דינמי עם חישוב "יום סיכון"
 * - סימולטור What-If לתרחישים פיננסיים
 * 
 * עקרון פרטיות:
 * כל החישובים מתבצעים בדפדפן. אין חיבור API לבנק. אין שליחת נתונים לשרת.
 * 
 * ---
 * 
 * ## ארכיטקטורה
 * 
 * ### 1. שכבת העלאה ופרסור (Upload & Parser Layer)
 * קבצים: components/upload/CSVUploader.jsx, components/utils/bankParsers.jsx
 * 
 * תפקיד:
 * - קבלת קובץ CSV מהמשתמש
 * - זיהוי אוטומטי של סוג הבנק לפי כותרות הקובץ
 * - ניתוב לפרסר ייעודי לכל בנק
 * - נרמול לפורמט אחיד: {date, description, debit, credit, balance}
 * 
 * בנקים נתמכים:
 * - בנק הפועלים - parsePoalimRow
 * - בנק לאומי - parseLeumiRow
 * - בנק דיסקונט - parseDiscountRow
 * - מזרחי-טפחות - parseMizrahiRow
 * - הבינלאומי - parseBeinleumiRow
 * 
 * למה Parser Manager?
 * כל בנק משתמש בשמות עמודות שונים, סדר שונה, ומפרידים שונים (,/;). 
 * פרסר אחיד יכשל. לכן יש פרסר ייעודי לכל בנק.
 * 
 * ---
 * 
 * ### 2. מנוע תחזיות (Forecasting Engine)
 * קובץ: components/utils/forecastingLogic.jsx
 * 
 * אלגוריתם היברידי:
 * 
 * Average Daily Net = (Total Credit - Total Debit) / Unique Days
 * Recent Trend = Last Row Credit - Last Row Debit
 * Hybrid Daily = (Average Daily Net × 0.7) + (Recent Trend × 0.3)
 * 
 * חישוב תחזית עם 17% Safety Buffer:
 * 
 * Raw Forecast = Current Balance + (Hybrid Daily × 30)
 * Safe Forecast = Raw Forecast × 0.83
 * 
 * חישוב יום סיכון:
 * 
 * Days Until Risk = Current Balance / Average Daily Spending
 * Risk Date = Today + Days Until Risk
 * 
 * רמות סיכון:
 * - 🟢 ירוק: יתרה צפויה > 0 ויציבה
 * - 🟡 צהוב: יתרה צפויה < 20% מהיתרה הנוכחית
 * - 🔴 אדום: יתרה צפויה שלילית או יום סיכון קרוב
 * 
 * ---
 * 
 * ### 3. סימולטור What-If
 * תפקיד: מאפשר למשתמש לבדוק השפעת הוצאה או הכנסה עתידית על התחזית.
 * 
 * פורמולה:
 * 
 * Adjusted Balance = Current Balance + Income - Expense
 * New Safe Balance = Adjusted Balance × 0.83
 * New Risk Day = Adjusted Balance / Average Daily Spending
 * 
 * טרנד:
 * - Positive (🟢): יום הסיכון התרחק (טוב)
 * - Negative (🔴): יום הסיכון התקרב (רע)
 * - Neutral (⚪): אין שינוי משמעותי
 * 
 * ---
 * 
 * ### 4. שכבת UI
 * קבצים:
 * - pages/Dashboard.jsx - דף ראשי
 * - components/dashboard/SpeedometerGauge.jsx - מד מהירות
 * - components/dashboard/StatCard.jsx - כרטיסי סטטיסטיקה
 * - components/dashboard/RiskZoneChart.jsx - גרף תחזית
 * - components/dashboard/WhatIfSimulator.jsx - סימולטור
 * - components/dashboard/EmptyState.jsx - מסך ריק
 * - components/dashboard/Disclaimer.jsx - כתב ויתור משפטי
 * 
 * ---
 * 
 * ## תפקיד ה-AI ב-FlowUp
 * 
 * ### מה ה-AI עושה:
 * - מסביר מגמות תזרים ומקורות סיכון
 * - מזהה דפוסים התנהגותיים בהוצאות
 * - מציע התאמות תקציב כלליות ולא מחייבות
 * - תומך בהבנה באמצעות המלצות קונטקסטואליות
 * 
 * ### המלצות אפשריות:
 * - התאמת מבנה תקציב
 * - אופטימיזציה של התנהגות הוצאות
 * - שיקולי תזמון ותכנון
 * - תובנות מבוססות What-If
 * 
 * ### מה ה-AI לא עושה:
 * - ❌ לא מבצע פעולות פיננסיות (העברות, תשלומים)
 * - ❌ לא נותן ייעוץ פיננסי או השקעות אישי
 * - ❌ לא ממליץ על מוצרים פיננסיים ספציפיים
 * - ❌ לא פועל למען מונטיזציה או צדדים שלישיים
 * - ❌ לא מחליף שיקול דעת של המשתמש
 * 
 * ### עקרונות AI:
 * 1. שקיפות: כל חישוב ניתן למעקב
 * 2. נייטרליות: אין אג'נדה מסחרית
 * 3. פרטיות: אין שימוש בנתונים לצורכי אימון AI
 * 4. הסבר: כל המלצה מלווה בהסבר ברור
 * 
 * ---
 * 
 * ## מבנה קבצים
 * 
 * FlowUp/
 * ├── pages/
 * │   └── Dashboard.jsx                    # דף ראשי
 * ├── components/
 * │   ├── upload/
 * │   │   └── CSVUploader.jsx              # העלאת קבצים
 * │   ├── utils/
 * │   │   ├── bankParsers.jsx              # פרסרים לכל בנק
 * │   │   └── forecastingLogic.jsx         # מנוע תחזיות
 * │   ├── dashboard/
 * │   │   ├── SpeedometerGauge.jsx         # מד מהירות
 * │   │   ├── StatCard.jsx                 # כרטיסי מידע
 * │   │   ├── RiskZoneChart.jsx            # גרף תחזית
 * │   │   ├── WhatIfSimulator.jsx          # סימולטור תרחישים
 * │   │   ├── EmptyState.jsx               # מסך התחלתי
 * │   │   └── Disclaimer.jsx               # כתב ויתור
 * │   └── docs/
 * │       └── README.jsx                   # מסמך זה
 * └── entities/
 *     ├── Transaction.json                 # ישות תנועות
 *     └── FinancialSnapshot.json           # ישות תמונת מצב
 * 
 * ---
 * 
 * ## הוספת תמיכה בבנק נוסף
 * 
 * 1. הוסף פונקציית פרסור ב-bankParsers.jsx:
 * 
 * export const parseNewBankRow = (row, headers) => {
 *     const dateIdx = findColumn(headers, ['תאריך']);
 *     // ... לוגיקת פרסור
 *     return { date, description, debit, credit, balance };
 * };
 * 
 * 2. הוסף זיהוי ב-detectBankFromHeader:
 * 
 * if (header.includes('מילת_מפתח_ייחודית')) {
 *     return 'newbank';
 * }
 * 
 * 3. הוסף routing ב-parseCSVRow:
 * 
 * case 'newbank':
 *     return parseNewBankRow(row, headers);
 * 
 * ---
 * 
 * ## אבטחה ופרטיות
 * 
 * ### עקרונות:
 * - ✅ כל הנתונים נשארים בדפדפן המשתמש
 * - ✅ אין חיבור API לבנק
 * - ✅ אין שליחת נתונים לשרת צד שלישי
 * - ✅ המשתמש שולט מלוא השליטה על הנתונים
 * 
 * ### אחסון:
 * - נתונים נשמרים ב-Base44 database (אופציונלי)
 * - המשתמש יכול למחוק את כל הנתונים בכל עת
 * - אין שמירת סיסמאות או אישורי גישה
 * 
 * ---
 * 
 * ## כתב ויתור משפטי
 * 
 * אין ייעוץ פיננסי:
 * כל התחזיות, תאריכי הסיכון ומצבי המד מוצגים למטרות מידע בלבד 
 * ואינם מהווים ייעוץ פיננסי או המלצה לפעולה.
 * 
 * שגיאה סטטיסטית:
 * התחזיות מבוססות על מודלים סטטיסטיים ודפוסי הוצאה היסטוריים. 
 * ההתנהגות העתידית עשויה לחרוג מהתחזיות.
 * 
 * תקינות נתונים:
 * הדיוק תלוי לחלוטין בתקינות קובץ ה-CSV. 
 * FlowUp אינה אחראית לשגיאות הנובעות מקבצים חלקיים או שעברו שינוי.
 * 
 * ---
 * 
 * ## גרסה
 * 
 * FlowUp v1.0.0
 * - Client-Side MVP
 * - Hybrid SES + Seasonal Average Engine
 * - 17% Standard Deviation Safety Buffer
 * - Multi-Bank Support (5 major Israeli banks)
 */

// This file serves as documentation only
export default null;