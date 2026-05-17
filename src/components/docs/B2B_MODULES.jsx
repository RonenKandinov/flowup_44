/**
 * FlowUp B2B Suite — Module Logic & Risk Assessment Reference
 * ============================================================
 *
 * מסמך זה מתעד את הלוגיקה של כל מודול B2B במערכת, ואת הבדיקות
 * שעליהן מבוססת הערכת סיכון הלקוח. יש לעיין בו לפני כל שינוי
 * הקשור להחלטות חיתום, ניקוד סיכון, או מודולי B2B.
 *
 * כל הבדיקות מבוצעות על בסיס נתוני Open Finance (12 חודשים אחרונים),
 * בשילוב עם InsightEngine, loanLogicV2, ו-checkDiscountAnalyze.
 *
 * ---
 *
 * ## 1. ניכיון צ׳קים (Check Discounting)
 *
 * ### מה זה
 * העסק מקבל כסף מיידי על צ׳ק דחוי במקום להמתין לתאריך הפירעון.
 *
 * ### Flow
 * 1. סריקת צ׳ק עם מצלמת מובייל (capture="environment") או העלאת תמונה.
 * 2. OCR (`checkOcrExtract`) מזהה: ח.פ כותב הצ׳ק, סכום, תאריך פירעון, מספר צ׳ק.
 * 3. אישור ידני של המשתמש על הנתונים שזוהו.
 * 4. שליחה ל-`checkDiscountAnalyze` שמבצע את הבדיקות.
 *
 * ### מה המערכת בודקת
 * - **Third-Party History** — היסטוריית הצ׳קים של כותב הצ׳ק (ח.פ צד ג׳)
 *   ב-12 החודשים האחרונים מתוך OpenFinanceTransaction של העסק:
 *     - מספר הפקדות קודמות
 *     - מספר צ׳קים שחזרו (bounced)
 *     - סכום מצטבר
 * - **Requesting Business Strength** — InsightEngine על העסק המבקש
 *   (DSCR, נזילות, יציבות הכנסות).
 * - **Velocity** — קצב הפקדת צ׳קים מאותו צד ג׳.
 *
 * ### החלטה
 * - approved / review / adjusted / rejected
 * - דמי ניכיון מחושבים לפי סיכון צד ג׳ + תאריך פירעון.
 *
 * ---
 *
 * ## 2. הון חוזר (Working Capital)
 *
 * ### מה זה
 * הלוואה קצרה לעסק כדי להתמודד עם:
 * משכורות · מלאי · מע״מ · עונתיות · הוצאות שוטפות · תזרים חלש.
 *
 * ### מה המערכת בודקת
 * - **Cash Flow Stability** — האם הכנסות העסק יציבות? (income volatility,
 *   coefficient of variation על הכנסות חודשיות).
 * - **Liquidity** — כמה כסף זמין נשאר לעסק? (liquidity index במונחי חודשי
 *   הוצאות קבועות).
 * - **DSCR / Repayment Capacity** — האם העסק מסוגל להחזיר? (Debt-Service
 *   Ratio, adjusted DTI מתוך loanLogicV2).
 * - **Overdraft Behavior** — כמה העסק חי במינוס? (ימי overdraft, יתרה
 *   ממוצעת, שיא חריגה).
 * - **Risk Signals** — החזרות · עיקולים · חריגות · bounced checks
 *   (risk flags מ-InsightEngine).
 *
 * ---
 *
 * ## 3. ניכיון חשבוניות (Factoring)
 *
 * ### מה זה
 * העסק לא מחכה 90 יום לקבל כסף על חשבונית — מקבל את הכסף עכשיו.
 *
 * ### מה המערכת בודקת
 * - **Customer Reliability** — האם הלקוחות (החייבים) משלמים בזמן?
 *   (היסטוריית תשלומים נכנסים מאותו debtor_tax_id).
 * - **Invoice Patterns** — האם יש פעילות עקבית של הוצאת חשבוניות לאותו
 *   לקוח? (תדירות, סכומים).
 * - **Historical Incoming Payments** — האם כסף באמת נכנס בעבר מאותם
 *   לקוחות? (matching מול OpenFinanceTransaction).
 * - **Transaction Validation** — האם החשבונית "אמיתית" בהתנהגות הבנקאית?
 *   (השוואת סכומים, אנומליות).
 * - **Cash Flow Timing** — איך זה משפיע על התזרים? (השפעה על liquidity
 *   forecast).
 *
 * ---
 *
 * ## 4. ניהול כספי (Treasury / Cash Management) [שם המודול לשעבר: "אוצר"]
 *
 * ### מה זה
 * ניהול תזרים ומזומנים עסקי — לא מוצר מימון, אלא שכבת ניהול כספי.
 *
 * ### מה המערכת בודקת
 * - **Multi-Account Balances** — כמה כסף יש בכלל החשבונות? (aggregation
 *   על OpenFinanceAccount).
 * - **Cash Position** — מה מצב המזומנים בזמן אמת? (interimAvailable balance).
 * - **Receivables vs Payables** — כמה אמור להיכנס מול לצאת? (Invoice
 *   open vs SupplierPayment pending).
 * - **Liquidity Forecast** — האם צפוי חוסר תזרימי? (cashFlowIntelligence
 *   30-day forecast).
 *
 * ### הערה
 * מודול זה איננו מוצר אשראי — הוא שכבת ניהול כספי בלבד.
 * ההיגיון של "אוצר" בעולמות החיתום מומר ל**ניהול כספי**:
 * תצוגה אנליטית בלבד, ללא החלטת אשראי.
 *
 * ---
 *
 * ## 5. מימון עסקי חכם (B2B Financing — multi-product)
 *
 * ### מה זה
 * Hub אחד למוצרים: Reverse Factoring · RBF · PO Financing ·
 * Working Capital · Merchant Cash Advance.
 *
 * ### Flow
 * 1. בחירת product_type + סכום מבוקש + הקשר (counterparty, MRR, PO#, וכו׳).
 * 2. שליחה ל-`b2bFinancingAnalyze` שמנתב ללוגיקת חיתום ייעודית למוצר.
 * 3. החזרת decision מובנה (tier, rate, max amount, repayment %).
 *
 * ### החלטה
 * מבוססת על אותן מטריקות יסוד (DSCR, נזילות, יציבות הכנסות) +
 * הקשר ספציפי למוצר (למשל: עוצמת ה-buyer ב-PO financing).
 *
 * ---
 *
 * ## 6. גבייה חכמה (Collections Intelligence)
 *
 * ### מה זה
 * ניהול תיקי גבייה על חשבוניות בפיגור.
 *
 * ### מה המערכת בודקת
 * - **Risk Segment** — low / medium / high / critical (AI segmentation).
 * - **Days Overdue** — ימי פיגור.
 * - **Recommended Strategy** — soft_reminder / firm_reminder / phone_call /
 *   payment_plan / legal_action / write_off.
 *
 * ---
 *
 * ## 7. תשתית חיתום (Underwriting Infrastructure)
 *
 * ### מה זה
 * תצוגת מטה-נתונים על כל ניתוחי החיתום שבוצעו במערכת.
 * Read-only — לצורכי analytics ופיקוח.
 *
 * ### מה מוצג
 * - התפלגות risk tiers (Green / Orange / Red).
 * - 10 הניתוחים האחרונים: user, score, tier, DSR, date.
 *
 * ---
 *
 * ## עקרונות חוצי-מודולים להערכת סיכון לקוח
 *
 * 1. **מקור נתונים יחיד** — כל הבדיקות מבוססות על OpenFinanceTransaction
 *    (12 חודשים) + FinancialSnapshot. אסור לבסס החלטה על קלט משתמש בלבד.
 *
 * 2. **מטריקות יסוד משותפות** — DSCR, DTI, adjusted DTI, liquidity index,
 *    income volatility — מחושבות פעם אחת ב-`insightEngine` ומשותפות
 *    לכל המודולים.
 *
 * 3. **Risk Flags משותפים** — bounced checks, overdraft days, declining
 *    income, high volatility — מזוהים ב-`insightEngine` ומשפיעים על PD
 *    בכל מוצר.
 *
 * 4. **Pricing Tiers משותפים** — Tier A (Prime) / B (Near Prime) /
 *    C (Subprime/Stretch) מוגדרים ב-`UnderwritingRule` ומשפיעים על
 *    תמחור בכל המודולים.
 *
 * 5. **Persistence** — כל החלטה נשמרת ב-`UnderwritingAnalysis` עם
 *    `model_version` ו-`analysis_hash` לצורכי reproducibility ו-drift tracking.
 *
 * 6. **שקיפות (XAI)** — כל החלטה מלווה ב-`xai_factors` (positive/negative
 *    drivers) — חובה להציג אותם למשתמש.
 *
 * 7. **Privacy** — נתונים מובנים (scores, tiers, flags) — plaintext.
 *    נרטיב AI (justifications) — AES-GCM encrypted ב-`narrative_encrypted`.
 *
 * ---
 *
 * ## מיפוי מודול → Backend Function
 *
 * | Module              | Backend Function           | Entity                  |
 * |---------------------|----------------------------|-------------------------|
 * | ניכיון צ׳קים        | checkOcrExtract +          | CheckDiscountRequest    |
 * |                     | checkDiscountAnalyze       |                         |
 * | הון חוזר            | b2bFinancingAnalyze        | B2BFinancingRequest     |
 * | ניכיון חשבוניות     | (Invoice CRUD + insights)  | Invoice                 |
 * | ניהול כספי          | cashFlowIntelligence       | OpenFinanceAccount      |
 * | מימון עסקי חכם      | b2bFinancingAnalyze        | B2BFinancingRequest     |
 * | גבייה חכמה          | (AI segmentation)          | CollectionsCase         |
 * | תשתית חיתום         | persistAnalysis (read)     | UnderwritingAnalysis    |
 *
 * ---
 *
 * ## מודולים שהוסרו מה-UI (2026-05)
 *
 * - **מימון ספקים (Supplier Finance)** — הוסר מטאבי B2B Suite לבקשת הלקוח.
 *   הלוגיקה (`SupplierPayment` entity, `SupplierFinanceTab`) נשמרת בקוד
 *   להחזרה עתידית.
 * - **אוצר (Treasury)** — שמו שונה ל**ניהול כספי**. הלוגיקה נשמרה,
 *   הפוקוס שונה מ"מוצר אשראי" ל"שכבת ניהול כספי" (read-only analytics).
 */

export default null;