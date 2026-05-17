/**
 * FlowUp B2B Suite — Architecture, Core Engine & Risk Assessment Reference
 * =========================================================================
 *
 * מסמך זה הוא ה-source-of-truth לארכיטקטורת B2B של FlowUp.
 * חובה לעיין בו לפני כל שינוי הקשור לחיתום, ניקוד סיכון, או מודולי B2B.
 *
 * ============================================================================
 * # 0. Core Platform Philosophy
 * ============================================================================
 *
 * **FlowUp is a behavioral underwriting and credit decision infrastructure
 * platform built on top of Open Finance transaction intelligence.**
 *
 * עקרונות יסוד:
 * - כל module הוא **product layer** דק.
 * - מתחתיו רץ **risk engine אחד ויחיד** (insightEngine + loanLogicV2).
 * - ההחלטה מתבססת על **התנהגות פיננסית אמיתית** מ-Open Finance — לא על
 *   טופס שהמשתמש מילא, ולא על דירוג אשראי חיצוני.
 *
 * המוצרים נראים שונים (צ׳קים, חשבוניות, הון חוזר, RBF, PO), אבל כולם
 * שואלים את אותה שאלה: *"האם להתנהגות הפיננסית של העסק הזה יש מספיק
 * עוצמה כדי לשרת את ההתחייבות הזאת?"*
 *
 * ============================================================================
 * # 1. Layered Architecture — Analytics vs Decisioning
 * ============================================================================
 *
 * הפרדה ארכיטקטונית חדה בין שתי שכבות. ערבוב ביניהן = bug עיצובי.
 *
 * ## 1.1 Analytics Layer (read-only, ללא החלטות אשראי)
 * - **ניהול כספי (Treasury / Cash Management)** — תצוגת aggregation על
 *   חשבונות, cash position, receivables vs payables, liquidity forecast.
 * - **תשתית חיתום (Underwriting Infrastructure)** — מטה-נתונים על
 *   ניתוחי חיתום היסטוריים.
 * - **גבייה חכמה (Collections Intelligence)** — segmentation והמלצות
 *   אופרטיביות (לא החלטת אשראי).
 *
 * Backend: `cashFlowIntelligence`, `persistAnalysis` (read).
 *
 * ## 1.2 Decisioning Layer (יוצר החלטת אשראי + תמחור)
 * - **ניכיון צ׳קים (Check Discounting)**
 * - **הון חוזר (Working Capital)**
 * - **ניכיון חשבוניות (Factoring)**
 * - **מימון עסקי חכם (Reverse Factoring / RBF / PO / MCA)**
 *
 * Backend: `checkDiscountAnalyze`, `b2bFinancingAnalyze`, `loanLogicV2`,
 * `insightEngine`, `generateCreditJustification`.
 *
 * **כלל ברזל:** Decisioning Layer חייבת לכתוב `UnderwritingAnalysis` עם
 * `model_version` ו-`analysis_hash`. Analytics Layer לא כותבת.
 *
 * ============================================================================
 * # 2. Decision Orchestration Layer
 * ============================================================================
 *
 * שכבה לוגית (לא מודול UI) שאחראית על כל מה שקורה *בין* הבקשה ל-decision:
 *
 * 1. **Product Matching** — איזה מוצר באמת מתאים לבקשה? (לפעמים לקוח
 *    מבקש Working Capital אבל Factoring מתאים יותר).
 * 2. **Routing** — איזו פונקציית חיתום להריץ (לפי product_type).
 * 3. **Approvals** — מי שכבת ההחלטה (אוטומטי vs human-in-the-loop לפי tier).
 * 4. **Fallback Logic** — אם המוצר המבוקש נדחה, האם יש מוצר חלופי?
 * 5. **Scenario Generation** — יצירת מבני מימון חלופיים תואמי-מדיניות
 *    (מועבר ל-Approval Optimization Engine).
 *
 * מיקום בקוד: כרגע מפוזר בין `b2bFinancingAnalyze` ל-`dealRescuerEngine`.
 * **TODO:** לאחד תחת `orchestrationEngine` ייעודי.
 *
 * ============================================================================
 * # 3. Approval Optimization Engine ⭐ (Core Differentiator)
 * ============================================================================
 *
 * **Instead of binary approve/decline logic, FlowUp searches for
 * policy-compliant alternative financing structures.**
 *
 * זה ה-magic של FlowUp — לא עוד מנוע חיתום שאומר "כן/לא".
 *
 * ## איך זה עובד
 * כשבקשה לא עוברת בקונפיגורציה המבוקשת, המנוע מחפש *automatically*:
 * - **Lower Amount** — האם בסכום קטן יותר זה עובר?
 * - **Longer Term** — האם תקופה ארוכה יותר מורידה DSR מתחת לסף?
 * - **Higher Rate (Stretch Offer)** — האם תמחור גבוה יותר (Tier C)
 *   מפצה על ה-PD ומחזיר רווחיות צפויה חיובית?
 * - **Different Product** — האם Factoring במקום Working Capital פותר
 *   את הבעיה?
 * - **Discretionary Cut** — האם המלצה על הקטנת הוצאות דיסקרציוניות
 *   (במסגרת ה-guardrails) הופכת את העסקה לאפשרית?
 *
 * ## למה זה moat
 * - בנקים מסורתיים: בינארי (yes/no).
 * - FlowUp: מציע **תרחישים מובנים** ללקוח, עם הצדקה לכל אחד.
 * - תוצאה: יותר עסקאות סגורות, יותר transparency, פחות נטישה.
 *
 * מיקום בקוד: `dealRescuerEngine`, `loanLogicV2` (rescue strategies),
 * `AggressiveProductCard`, `enable_aggressive_approval` ב-`UnderwritingRule`.
 *
 * ============================================================================
 * # 4. Behavioral Intelligence ⭐ (The Real Moat)
 * ============================================================================
 *
 * **זה לא עוד metric — זה הליבה.**
 *
 * בנקים מסתכלים על מאזנים, דוחות, ודירוג אשראי (snapshot סטטי).
 * FlowUp מסתכלת על **התנהגות** — איך העסק מתנהל יום-יום:
 *
 * - **Cash Flow Stability** — coefficient of variation על הכנסות חודשיות.
 *   עסק עם income volatility נמוך = פחות סיכון *גם אם* DTI שלו גבוה.
 * - **Overdraft Behavior** — כמה ימים בחודש העסק במינוס? מה השיא?
 *   האם הוא חוזר לחיוב מהר? זה מנבא default טוב יותר מכל credit score.
 * - **Payment Discipline** — האם משלמים לספקים בזמן? איך מתנהגים מול חזרות?
 * - **Third-Party Behavioral Graph** — בניכיון צ׳קים: מה ההיסטוריה של
 *   *כותב הצ׳ק* אצל לקוחות אחרים שלנו? (cross-tenant behavioral signal,
 *   privacy-safe — רק aggregates).
 * - **Velocity Signals** — קצב הפקדות, קצב משיכות, שינויים בקצב.
 *
 * ## למה זה ה-moat האמיתי
 * - **נתונים שאין למתחרים** — רק מי שיש לו 12 חודשי Open Finance של אלפי
 *   עסקים יכול לזהות דפוסים התנהגותיים.
 * - **ה-data flywheel** — כל לקוח חדש משפר את המודל ההתנהגותי לכולם.
 * - **לא ניתן להעתקה מהיר** — credit score אפשר לקנות, behavioral graph
 *   צריך לבנות שנים.
 *
 * מיקום בקוד: `insightEngine` (חישוב), `loanLogicV2` (שימוש ב-PD),
 * `behavioral_classification` ב-`UnderwritingAnalysis`.
 *
 * ============================================================================
 * # 5. MVP Scope — מה באמת חייבים עכשיו
 * ============================================================================
 *
 * **אזהרה מפני over-engineering.** המערכת מתחילה להישמע גדולה מדי.
 * MVP אמיתי = 3 מוצרים, שלוש שכבות, סיפור אחד:
 *
 * ## MVP Products
 * 1. **Check Discounting** — מוצר שמשלם את החשבונות, ROI מהיר, OCR sexy.
 * 2. **Working Capital** — המוצר ה"קלאסי", מוכר לכל עסק.
 * 3. **Approval Optimization** — ה-differentiator שיוצר wow.
 *
 * שאר המודולים (RBF, PO, MCA, Factoring, Treasury, Collections) — נשארים
 * בקוד, מוסתרים/secondary ב-UI, ייפתחו אחרי product-market fit.
 *
 * ## MVP Layers
 * 1. **Behavioral Intelligence** (`insightEngine`).
 * 2. **Decisioning** (`loanLogicV2` + `checkDiscountAnalyze`).
 * 3. **Approval Optimization** (`dealRescuerEngine`).
 *
 * ## MVP UX Story
 * עסק מתחבר → Open Finance מושך 12 חודשים → המערכת מציעה 3 תרחישי
 * מימון מובנים → העסק בוחר אחד → אישור מיידי.
 *
 * **אל תוסיף מודול חדש לפני שה-flow הזה עובד end-to-end חלק.**
 *
 * ============================================================================
 * # 6. מפרטי מודולים (Reference)
 * ============================================================================
 *
 * ## 6.1 ניכיון צ׳קים (Check Discounting) — [MVP]
 *
 * ### Flow
 * 1. סריקת צ׳ק עם מצלמת מובייל (capture="environment") או העלאת תמונה.
 * 2. OCR (`checkOcrExtract`) מזהה: ח.פ כותב הצ׳ק, סכום, תאריך פירעון.
 * 3. אישור ידני של המשתמש על הנתונים שזוהו.
 * 4. `checkDiscountAnalyze` — בדיקת היסטוריית צד ג׳ + עוצמת העסק המבקש.
 *
 * ### בדיקות
 * - **Third-Party History** (12 חודשים): הפקדות קודמות, bounced, סכום מצטבר.
 * - **Requesting Business Strength** (InsightEngine): DSCR, נזילות, יציבות.
 * - **Velocity** — קצב הפקדת צ׳קים מאותו צד ג׳.
 *
 * ### החלטה
 * approved / review / adjusted / rejected + דמי ניכיון מחושבים.
 *
 * ---
 *
 * ## 6.2 הון חוזר (Working Capital) — [MVP]
 *
 * ### בדיקות
 * - **Cash Flow Stability** — income volatility, coefficient of variation.
 * - **Liquidity** — liquidity index במונחי חודשי הוצאות קבועות.
 * - **DSCR / Repayment Capacity** — Debt-Service Ratio, adjusted DTI.
 * - **Overdraft Behavior** — ימי overdraft, יתרה ממוצעת, שיא חריגה.
 * - **Risk Signals** — החזרות, עיקולים, חריגות, bounced checks.
 *
 * ---
 *
 * ## 6.3 ניכיון חשבוניות (Factoring) — [Post-MVP]
 *
 * ### בדיקות
 * - **Customer Reliability** — היסטוריית תשלומים נכנסים מאותו debtor_tax_id.
 * - **Invoice Patterns** — פעילות עקבית של חשבוניות לאותו לקוח.
 * - **Historical Incoming Payments** — matching מול OpenFinanceTransaction.
 * - **Transaction Validation** — השוואת סכומים, אנומליות.
 * - **Cash Flow Timing** — השפעה על liquidity forecast.
 *
 * ---
 *
 * ## 6.4 ניהול כספי (Treasury / Cash Management) — [Analytics Layer]
 *
 * **Not a credit product. Pure analytics layer.**
 *
 * - **Multi-Account Balances** — aggregation על OpenFinanceAccount.
 * - **Cash Position** — interimAvailable balance בזמן אמת.
 * - **Receivables vs Payables** — Invoice open vs SupplierPayment pending.
 * - **Liquidity Forecast** — cashFlowIntelligence 30-day forecast.
 *
 * ---
 *
 * ## 6.5 מימון עסקי חכם (B2B Financing — multi-product) — [Post-MVP]
 *
 * Hub אחד ל: Reverse Factoring · RBF · PO Financing · MCA.
 * Backend: `b2bFinancingAnalyze` (router לפי product_type).
 *
 * ---
 *
 * ## 6.6 גבייה חכמה (Collections) — [Analytics Layer]
 *
 * Risk segment (low/medium/high/critical) + recommended strategy
 * (soft_reminder / firm_reminder / phone_call / payment_plan /
 * legal_action / write_off).
 *
 * ---
 *
 * ## 6.7 תשתית חיתום (Underwriting Infrastructure) — [Analytics Layer]
 *
 * Read-only. התפלגות risk tiers + 10 ניתוחים אחרונים.
 *
 * ============================================================================
 * # 7. עקרונות חוצי-מודולים (Risk Assessment Invariants)
 * ============================================================================
 *
 * 1. **מקור נתונים יחיד** — כל הבדיקות על OpenFinanceTransaction (12 חודשים)
 *    + FinancialSnapshot. אסור לבסס החלטה על קלט משתמש בלבד.
 *
 * 2. **מטריקות יסוד משותפות** — DSCR, DTI, adjusted DTI, liquidity index,
 *    income volatility — מחושבות פעם אחת ב-`insightEngine` ומשותפות
 *    לכל המודולים. אסור לחשב אותן מחדש בכל מודול.
 *
 * 3. **Risk Flags משותפים** — bounced checks, overdraft days, declining
 *    income, high volatility — מזוהים ב-`insightEngine` ומשפיעים על PD
 *    בכל מוצר.
 *
 * 4. **Pricing Tiers משותפים** — Tier A (Prime) / B (Near Prime) /
 *    C (Subprime/Stretch) מוגדרים ב-`UnderwritingRule`.
 *
 * 5. **Persistence** — כל החלטה נשמרת ב-`UnderwritingAnalysis` עם
 *    `model_version` + `analysis_hash` לצורכי reproducibility ו-drift tracking.
 *
 * 6. **שקיפות (XAI)** — כל החלטה מלווה ב-`xai_factors` (positive/negative
 *    drivers). חובה להציג למשתמש.
 *
 * 7. **Privacy** — נתונים מובנים (scores, tiers, flags) → plaintext.
 *    נרטיב AI (justifications) → AES-GCM encrypted ב-`narrative_encrypted`.
 *
 * ============================================================================
 * # 8. Backend Function Map
 * ============================================================================
 *
 * | Layer        | Module              | Backend Function           | Entity                  |
 * |--------------|---------------------|----------------------------|-------------------------|
 * | Decisioning  | ניכיון צ׳קים        | checkOcrExtract +          | CheckDiscountRequest    |
 * |              |                     | checkDiscountAnalyze       |                         |
 * | Decisioning  | הון חוזר            | b2bFinancingAnalyze +      | B2BFinancingRequest     |
 * |              |                     | loanLogicV2                |                         |
 * | Decisioning  | מימון עסקי חכם      | b2bFinancingAnalyze        | B2BFinancingRequest     |
 * | Decisioning  | ניכיון חשבוניות     | (Invoice CRUD + insights)  | Invoice                 |
 * | Engine       | Behavioral metrics  | insightEngine              | UnderwritingAnalysis    |
 * | Engine       | Approval Optimizer  | dealRescuerEngine          | UnderwritingAnalysis    |
 * | Engine       | Justification (AI)  | generateCreditJustification| UnderwritingAnalysis    |
 * | Engine       | Persistence         | persistAnalysis            | UnderwritingAnalysis    |
 * | Analytics    | ניהול כספי          | cashFlowIntelligence       | OpenFinanceAccount      |
 * | Analytics    | גבייה חכמה          | (AI segmentation)          | CollectionsCase         |
 * | Analytics    | תשתית חיתום         | persistAnalysis (read)     | UnderwritingAnalysis    |
 *
 * ============================================================================
 * # 9. שינויים אחרונים
 * ============================================================================
 *
 * ## 2026-05
 * - **מימון ספקים (Supplier Finance)** — הוסר מ-UI; הקוד נשמר להחזרה עתידית.
 * - **אוצר → ניהול כספי** — שינוי שם + reframe מ"מוצר אשראי" ל"Analytics Layer".
 * - **CheckScanner** — שופר עם capture="environment" + העלאה נפרדת.
 * - **הוסף תיעוד ארכיטקטוני חדש**: Core Engine, Analytics vs Decisioning,
 *   Orchestration Layer, Approval Optimization, Behavioral Intelligence, MVP Scope.
 */

export default null;