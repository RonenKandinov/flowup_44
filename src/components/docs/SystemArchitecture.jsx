/**
 * FlowUp - חוקת המערכת וארכיטקטורה
 * ====================================
 * 
 * ## מהי FlowUp?
 * 
 * מערכת ניתוח תזרים מזומנים אישי שמנתחת תנועות בנקאיות ומספקת תחזית 30 יום קדימה.
 * 
 * **ליבת המערכת:**
 * - פרסור CSV מבנקים ישראליים (פועלים, לאומי, דיסקונט, מזרחי, בינלאומי)
 * - מנוע תחזיות היברידי המשלב ממוצעים ומגמות
 * - מדד סיכון דינמי עם חישוב "יום סיכון"
 * - סימולטור What-If לתרחישים פיננסיים
 * 
 * **עקרון פרטיות:**
 * כל החישובים בדפדפן. אין חיבור API לבנק. אין שליחת נתונים לשרת.
 * 
 * ---
 * 
 * ## ארכיטקטורה - זרימת נתונים
 * 
 * ```
 * 1. User uploads CSV
 *         ↓
 * 2. CSVUploader.jsx
 *    - Read (ISO-8859-8 encoding)
 *    - Detect delimiter (,/;)
 *         ↓
 * 3. bankParsers.jsx
 *    - detectBankFromHeader()
 *    - Returns: hapoalim/leumi/discount/mizrahi/beinleumi
 *         ↓
 * 4. Parser Router
 *    - parseCSVRow(row, headers, bank)
 *    - Calls specific parser
 *         ↓
 * 5. Normalized Output
 *    { date, description, debit, credit, balance }
 *         ↓
 * 6. forecastingLogic.jsx
 *    - processAndForecast(csvText)
 *    - Hybrid Algorithm
 *         ↓
 * 7. Forecast Result
 *    { projectedEOM, riskStatus, riskDay, graphPoints }
 *         ↓
 * 8. Save to Database (Base44)
 *    - FinancialSnapshot entity
 *    - Transaction entities (first 100)
 *         ↓
 * 9. Update Dashboard UI
 *    - SpeedometerGauge
 *    - StatCards
 *    - RiskZoneChart
 *    - WhatIfSimulator
 * ```
 * 
 * ---
 * 
 * ## שכבת Parser (Upload & Parser Layer)
 * 
 * **קבצים:**
 * - components/upload/CSVUploader.jsx
 * - components/utils/bankParsers.jsx
 * 
 * **תפקיד:**
 * - קבלת קובץ CSV מהמשתמש
 * - זיהוי אוטומטי של סוג הבנק לפי כותרות
 * - ניתוב לפרסר ייעודי
 * - נרמול לפורמט אחיד
 * 
 * **בנקים נתמכים:**
 * - בנק הפועלים → parsePoalimRow
 * - בנק לאומי → parseLeumiRow
 * - בנק דיסקונט → parseDiscountRow
 * - מזרחי-טפחות → parseMizrahiRow
 * - הבינלאומי → parseBeinleumiRow
 * 
 * **למה Parser Manager?**
 * כל בנק משתמש בשמות עמודות שונים, סדר שונה, מפרידים שונים. פרסר אחיד יכשל.
 * 
 * ---
 * 
 * ## מנוע תחזיות (Forecasting Engine)
 * 
 * **קובץ:** components/utils/forecastingLogic.jsx
 * 
 * ### אלגוריתם היברידי
 * 
 * ```
 * Average Daily Net = (Total Credit - Total Debit) / Unique Days
 * Recent Trend = Last Row Credit - Last Row Debit
 * Hybrid Daily = (Average Daily Net × 0.7) + (Recent Trend × 0.3)
 * ```
 * 
 * **הסבר משקלים:**
 * - 70% ממוצע → דפוס ארוך טווח
 * - 30% מגמה → התאמה להתנהגות אחרונה
 * 
 * ### תחזית בטוחה + Safety Buffer
 * 
 * ```
 * Raw Forecast = Current Balance + (Hybrid Daily × 30)
 * Safe Forecast = Raw Forecast × 0.83
 * ```
 * 
 * **למה 0.83?**
 * - מייצג סטיית תקן של 17%
 * - מבטיח תחזית שמרנית
 * - מפחית false positives בירוק
 * 
 * ### חישוב יום סיכון
 * 
 * ```
 * Days Until Risk = Current Balance / Average Daily Spending
 * Risk Date = Today + Days Until Risk
 * ```
 * 
 * ### רמות סיכון
 * 
 * - 🟢 **ירוק:** יתרה צפויה > 0 ויציבה
 * - 🟡 **צהוב:** יתרה צפויה < 20% מהיתרה הנוכחית
 * - 🔴 **אדום:** יתרה צפויה שלילית או יום סיכון קרוב
 * 
 * ---
 * 
 * ## סימולטור What-If
 * 
 * **תפקיד:** בדיקת השפעת הוצאה/הכנסה עתידית על התחזית
 * 
 * ### פורמולה
 * 
 * ```
 * Adjusted Balance = Current Balance + Income - Expense
 * New Safe Balance = Adjusted Balance × 0.83
 * New Risk Day = Adjusted Balance / Average Daily Spending
 * ```
 * 
 * ### חישוב Trend
 * 
 * ```
 * originalDays = currentBalance / avgDailySpending
 * newDays = adjustedBalance / avgDailySpending
 * 
 * if (newDays < originalDays) → trend = "negative" (🔴 רע)
 * if (newDays > originalDays) → trend = "positive" (🟢 טוב)
 * if (newDays === originalDays) → trend = "neutral" (⚪)
 * ```
 * 
 * ---
 * 
 * ## שכבת UI
 * 
 * ### קבצים עיקריים
 * 
 * - **pages/Dashboard.jsx** - דף ראשי
 * - **components/dashboard/SpeedometerGauge.jsx** - מד מהירות
 * - **components/dashboard/StatCard.jsx** - כרטיסי סטטיסטיקה
 * - **components/dashboard/RiskZoneChart.jsx** - גרף תחזית
 * - **components/dashboard/WhatIfSimulator.jsx** - סימולטור
 * - **components/dashboard/EmptyState.jsx** - מסך ריק
 * - **components/dashboard/Disclaimer.jsx** - כתב ויתור
 * 
 * ### היררכיית קומפוננטות
 * 
 * ```
 * Dashboard.jsx
 * ├── Header (כותרת + כפתורים)
 * ├── StatCards (Grid)
 * │   ├── יתרה נוכחית
 * │   ├── הכנסות
 * │   └── הוצאות
 * ├── Main Grid
 * │   ├── SpeedometerGauge
 * │   │   ├── SVG Arc (ירוק/צהוב/אדום)
 * │   │   ├── מחוג מונפש
 * │   │   └── תצוגת יתרה
 * │   └── Right Column
 * │       ├── RiskZoneChart (Recharts)
 * │       └── WhatIfSimulator
 * │           ├── Tabs (הוצאה/הכנסה)
 * │           └── שדות קלט
 * └── Disclaimer (מתקפל)
 * 
 * Modals:
 * └── CSVUploader
 *     ├── Drag & Drop
 *     ├── Status (Idle/Loading/Success/Error)
 *     └── Bank Detection Badge
 * ```
 * 
 * ---
 * 
 * ## תפקיד ה-AI ב-FlowUp
 * 
 * ### מה ה-AI עושה
 * 
 * - מסביר מגמות תזרים ומקורות סיכון
 * - מזהה דפוסים התנהגותיים בהוצאות
 * - מציע התאמות תקציב כלליות ולא מחייבות
 * - תומך בהבנה באמצעות המלצות קונטקסטואליות
 * 
 * ### המלצות אפשריות
 * 
 * - התאמת מבנה תקציב
 * - אופטימיזציה של התנהגות הוצאות
 * - שיקולי תזמון ותכנון
 * - תובנות מבוססות What-If
 * 
 * ### עקרונות AI
 * 
 * 1. **שקיפות** - כל חישוב ניתן למעקב
 * 2. **נייטרליות** - אין אג'נדה מסחרית
 * 3. **פרטיות** - אין שימוש בנתונים לאימון AI
 * 4. **הסבר** - כל המלצה מלווה בהסבר ברור
 * 
 * ---
 * 
 * ## מבנה קבצים
 * 
 * ```
 * FlowUp/
 * ├── pages/
 * │   └── Dashboard.jsx
 * ├── components/
 * │   ├── upload/
 * │   │   └── CSVUploader.jsx
 * │   ├── utils/
 * │   │   ├── bankParsers.jsx
 * │   │   └── forecastingLogic.jsx
 * │   ├── dashboard/
 * │   │   ├── SpeedometerGauge.jsx
 * │   │   ├── StatCard.jsx
 * │   │   ├── RiskZoneChart.jsx
 * │   │   ├── WhatIfSimulator.jsx
 * │   │   ├── EmptyState.jsx
 * │   │   └── Disclaimer.jsx
 * │   ├── ui/
 * │   │   └── [shadcn components]
 * │   └── docs/
 * │       ├── UIGuide.jsx
 * │       └── SystemArchitecture.jsx (מסמך זה)
 * └── entities/
 *     ├── Transaction.json
 *     └── FinancialSnapshot.json
 * ```
 * 
 * ---
 * 
 * ## הוספת תמיכה בבנק נוסף
 * 
 * ### שלב 1: פונקציית פרסור
 * ```javascript
 * // ב-bankParsers.jsx
 * export const parseNewBankRow = (row, headers) => {
 *     const dateIdx = findColumn(headers, ['תאריך']);
 *     const descIdx = findColumn(headers, ['תיאור']);
 *     const debitIdx = findColumn(headers, ['חובה']);
 *     const creditIdx = findColumn(headers, ['זכות']);
 *     const balanceIdx = findColumn(headers, ['יתרה']);
 *     
 *     return {
 *         date: row[dateIdx],
 *         description: row[descIdx],
 *         debit: toNum(row[debitIdx]),
 *         credit: toNum(row[creditIdx]),
 *         balance: toNum(row[balanceIdx])
 *     };
 * };
 * ```
 * 
 * ### שלב 2: זיהוי
 * ```javascript
 * // ב-detectBankFromHeader
 * if (header.includes('מילת_מפתח_ייחודית')) {
 *     return 'newbank';
 * }
 * ```
 * 
 * ### שלב 3: Routing
 * ```javascript
 * // ב-parseCSVRow
 * case 'newbank':
 *     return parseNewBankRow(row, headers);
 * ```
 * 
 * ### שלב 4: Display Name
 * ```javascript
 * // ב-getBankDisplayName
 * const names = {
 *     newbank: 'שם הבנק החדש'
 * };
 * ```
 * 
 * ---
 * 
 * ## אבטחה ופרטיות
 * 
 * ### עקרונות
 * 
 * - כל הנתונים נשארים בדפדפן המשתמש
 * - אין חיבור API לבנק
 * - אין שליחת נתונים לשרת צד שלישי
 * - המשתמש שולט מלוא השליטה על הנתונים
 * 
 * ### אחסון
 * 
 * - נתונים נשמרים ב-Base44 database (אופציונלי)
 * - המשתמש יכול למחוק את כל הנתונים בכל עת
 * - אין שמירת סיסמאות או אישורי גישה
 * 
 * ### CSV Injection Prevention
 * 
 * - Sanitization של תוכן cells
 * - אין evaluation של formulas
 * - רק קריאה - אין כתיבה חזרה לקובץ
 * 
 * ### XSS Prevention
 * 
 * - React auto-escapes text content
 * - אין dangerouslySetInnerHTML
 * 
 * ---
 * 
 * ## ביצועים (Performance)
 * 
 * ### Lazy Calculation
 * - חישוב תחזית רק בעת העלאת קובץ חדש
 * - useMemo לחישובים כבדים
 * 
 * ### Batch Database Operations
 * ```javascript
 * // ✅ טוב
 * base44.entities.Transaction.bulkCreate(transactions.slice(0, 100))
 * 
 * // ❌ רע
 * transactions.forEach(t => base44.entities.Transaction.create(t))
 * ```
 * 
 * ### Query Caching
 * ```javascript
 * useQuery({
 *     queryKey: ['financial-snapshots'],
 *     staleTime: 5 * 60 * 1000,  // 5 דקות
 *     cacheTime: 10 * 60 * 1000  // 10 דקות
 * })
 * ```
 * 
 * ### Optimistic Updates
 * ```javascript
 * useMutation({
 *     onSuccess: () => {
 *         queryClient.invalidateQueries(['financial-snapshots'])
 *     }
 * })
 * ```
 * 
 * ---
 * 
 * ## State Management
 * 
 * ### Local State (useState)
 * - showUploader - האם modal העלאה פתוח
 * - whatIfAmount - סכום בסימולטור
 * - localData - נתונים זמניים לפני שמירה
 * 
 * ### Server State (TanStack Query)
 * - financial-snapshots - תמונות מצב שמורות
 * - transactions - רשימת תנועות
 * 
 * ### Derived State (useMemo)
 * - forecastData - נקודות גרף מחושבות
 * - hasData - האם יש נתונים להצגה
 * 
 * ---
 * 
 * ## כתב ויתור משפטי
 * 
 * ### אין ייעוץ פיננסי
 * כל התחזיות, תאריכי הסיכון ומצבי המד מוצגים למטרות מידע בלבד 
 * ואינם מהווים ייעוץ פיננסי או המלצה לפעולה.
 * 
 * ### שגיאה סטטיסטית
 * התחזיות מבוססות על מודלים סטטיסטיים ודפוסי הוצאה היסטוריים. 
 * ההתנהגות העתידית עשויה לחרוג מהתחזיות.
 * 
 * ### תקינות נתונים
 * הדיוק תלוי לחלוטין בתקינות קובץ ה-CSV. 
 * FlowUp אינה אחראית לשגיאות הנובעות מקבצים חלקיים או שעברו שינוי.
 * 
 * ---
 * 
 * ## תשתית טכנולוגית
 * 
 * ### Frontend Stack
 * - React 18
 * - Tailwind CSS
 * - Framer Motion
 * - shadcn/ui + Radix UI
 * - Base44 Platform (Backend as a Service)
 * - TanStack Query
 * 
 * ### Backend (Base44)
 * - Entities: Transaction, FinancialSnapshot
 * - Authentication: מובנה
 * - Database: NoSQL (מנוהל ע"י Base44)
 * 
 * ### Browser Support
 * - Chrome/Edge 90+
 * - Firefox 88+
 * - Safari 14+
 * 
 * ---
 * 
 * ## Future Enhancements
 * 
 * ### Phase 2
 * - תמיכה ב-Excel (.xlsx)
 * - ייצוא דוחות PDF
 * - התראות ניידות לפני יום סיכון
 * - שיתוף תחזית עם בן/בת זוג
 * 
 * ### Phase 3
 * - AI natural language queries
 * - דפוסי הוצאה אוטומטיים (קטגוריות)
 * - השוואה לחודשים קודמים
 * - יעדי חיסכון אישיים
 * 
 * ---
 * 
 * ## Contributing
 * 
 * לפני הוספת feature חדשה:
 * 1. ודא שהוא לא פוגע בפרטיות
 * 2. שמור על עקרון "client-side first"
 * 3. הוסף תיעוד מתאים
 * 4. בדוק עם נתונים אמיתיים מבנק
 * 
 * ---
 * 
 * **גרסה:** FlowUp v1.0.0  
 * **תאריך עדכון:** 2026-01-12  
 * **סוג מערכת:** Client-Side MVP  
 * **מנוע:** Hybrid SES + Seasonal Average  
 * **Safety Buffer:** 17% Standard Deviation  
 * **תמיכת בנקים:** 5 בנקים ישראליים מרכזיים
 */

export default null;