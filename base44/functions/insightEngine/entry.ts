import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';
import { z } from 'npm:zod';

function withValidation(schema, handler) {
  return async (req) => {
    let body = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        const b = await req.clone().json();
        const v = schema.safeParse(b);
        if (!v.success) {
          return Response.json({ success: false, error: "Validation failed", details: v.error.issues }, { status: 400 });
        }
        body = b;
      } catch {
        return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
      }
    }
    return handler(req, body);
  };
}

const schema = z.object({
  metrics: z.object({
    totalIncome: z.number().optional(),
    totalExpenses: z.number().optional(),
    liquidAssets: z.number().optional(),
    score: z.number().optional(),
    status: z.string().optional(),
    isClean12Months: z.boolean().optional(),
    dti: z.number().optional(),
    trends: z.object({ income: z.number().optional(), expenses: z.number().optional(), investments: z.number().optional(), momentum: z.string().optional() }).optional(),
    history: z.array(z.object({ netFlow: z.number().optional() })).optional()
  }).optional(),
  behaviorProfile: z.any().optional(),
  deferNarrative: z.boolean().optional()
}).passthrough();

Deno.serve(withValidation(schema, async (req, body) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    // Allow anonymous access for public apps
    // if (!user) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const m = body?.metrics;
    if (!m) return Response.json({ success: false, error: "metrics required" });
    const behaviorProfile = body?.behaviorProfile || m?.behaviorProfile || null;
    const undeclaredIncome = m?.undeclaredIncomeAnalysis || behaviorProfile?.undeclaredIncomeAnalysis || null;
    // Forensic Intelligence — must-have signals BDI/credit reports can't see.
    const forensic = m?.forensicIntelligence || behaviorProfile?.forensicIntelligence || null;

    const income = m.totalIncome ?? 0;
    const expenses = m.totalExpenses ?? 0;
    const assets = m.liquidAssets ?? 0;
    const liquidAssetsBreakdown = m.liquidAssetsBreakdown || { cash: 0, etf: 0, trainingFund: 0 };
    const dti = m.dti ?? 0;
    const score = m.score ?? 0;

    const trends = m.trends || { income: 0, expenses: 0 };
    const history = (m.history || []).filter(h => typeof h.netFlow === "number");

    const liq = expenses > 0 ? +(assets / expenses).toFixed(1) : 0;
    const expInc = income > 0 ? +((expenses / income) * 100).toFixed(1) : 0;

    // ===== Base Risk =====
    let risk = score < 55 ? "Red" : score < 80 ? "Orange" : "Green";

    // ===== Behavior =====
    let behavior = trends.momentum || "STABLE";
    if (behavior === "STABLE" && history.length >= 2) {
      const d = history.at(-1).netFlow - history[0].netFlow;
      if (d > 0 && trends.expenses < 0) behavior = "IMPROVING";
      else if (d < 0 && trends.expenses > 0) behavior = "DETERIORATING";
    }

    const signals = {
      classification: behavior,
      netFlowTrend: history.length >= 2 ? (history.at(-1).netFlow > history[0].netFlow ? "UP" : "DOWN") : "UNKNOWN",
      expenseTrend: trends.expenses > 10 ? "INCREASING" : trends.expenses < -10 ? "DECREASING" : "STABLE",
      incomeTrend: trends.income > 0 ? "UP" : trends.income < 0 ? "DOWN" : "STABLE"
    };

    // Fetch custom underwriting rules
    let rules = {
      max_dti_approve: 35,
      max_dti_review: 45,
      min_liquidity_months: 1,
      max_expense_income_ratio: 90,
      min_income: 8000,
      enable_second_chance: true
    };
    
    try {
      const savedRules = await base44.asServiceRole.entities.UnderwritingRule.list();
      if (savedRules && savedRules.length > 0) {
        rules = { ...rules, ...savedRules[0] };
      }
    } catch (e) {
      console.warn("Could not fetch custom rules, using defaults", e);
    }

    const policy_explanations = [];
    let isRejected = false;
    let isReview = false;

    // Hard Rules
    if (dti > rules.max_dti_review) {
        isRejected = true;
        policy_explanations.push(`נדחה: יחס החזר (DTI) עומד על ${dti}%, מעל המקסימום המותר (${rules.max_dti_review}%).`);
    }
    if (income < rules.min_income) {
        isRejected = true;
        policy_explanations.push(`נדחה: הכנסה חודשית (₪${income}) נמוכה מהמינימום הנדרש (₪${rules.min_income}).`);
    }

    // Soft Rules
    if (dti > rules.max_dti_approve && dti <= rules.max_dti_review) {
        isReview = true;
        policy_explanations.push(`בחינה: יחס החזר (DTI) עומד על ${dti}%, מעל סף האישור האוטומטי (${rules.max_dti_approve}%).`);
    }
    if (expInc > rules.max_expense_income_ratio) {
        isReview = true;
        policy_explanations.push(`בחינה: יחס הוצאות להכנסות (${expInc}%) חורג מהמדיניות (${rules.max_expense_income_ratio}%).`);
    }
    if (liq < rules.min_liquidity_months) {
        isReview = true;
        policy_explanations.push(`בחינה: נזילות (${liq} חודשים) נמוכה מהנדרש (${rules.min_liquidity_months} חודשים).`);
    }

    if (m.isClean12Months) {
        risk = "Green";
        policy_explanations.push("אישור אוטומטי: פרופיל הלקוח נקי לחלוטין מאירועים שלילים ב-12 החודשים האחרונים.");
        isRejected = false;
        isReview = false;
    } else if (m.status === "GREEN") {
        risk = "Green";
        policy_explanations.push("אישור מערכת: עמידה בתנאי הסף של מנוע החיתום.");
        isRejected = false;
        isReview = false;
    } else if (isRejected || m.status === "RED") {
        risk = "Red";
    } else if (isReview || m.status === "ORANGE") {
        risk = "Orange";
    } else {
        risk = "Green";
        policy_explanations.push("אישור אוטומטי: כל המדדים עומדים במדיניות החיתום.");
    }

    const neg = expInc > rules.max_expense_income_ratio;
    const lowLiq = liq < rules.min_liquidity_months;
    const highDti = dti > rules.max_dti_review;

    // ===== Strengths =====
    const strengths = [];
    if (behavior === "WEALTH_BUILDING") strengths.push("בניית הון (Wealth Building) - הגדלת הפקדות להשקעות ולחיסכון ב-4 החודשים האחרונים");
    if (behaviorProfile?.investmentDiscipline?.avgMonthlyInvestmentOutflow > 0) strengths.push(`משמעת השקעה חיובית — ₪${Math.round(behaviorProfile.investmentDiscipline.avgMonthlyInvestmentOutflow).toLocaleString('en-US')} בחודש בממוצע להשקעות`);
    if (behaviorProfile?.totalPledgeableValue > 0) strengths.push(`נכסים אפשריים לשעבוד — שווי משוער לאחר haircut ₪${Math.round(behaviorProfile.totalPledgeableValue).toLocaleString('en-US')}`);
    if (dti <= rules.max_dti_approve) strengths.push(`DTI נמוך ובריא (${dti}%) — מתחת לסף האישור ${rules.max_dti_approve}%`);
    if (behavior === "IMPROVING") strengths.push("מגמת שיפור עקבית ב-4 החודשים האחרונים");
    if (liq > rules.min_liquidity_months * 2) strengths.push("נזילות גבוהה ביחס להוצאות");
    if (expInc < rules.max_expense_income_ratio - 10) strengths.push("שליטה בהוצאות");
    if (signals.netFlowTrend === "UP") strengths.push("תזרים מזומנים במגמת עלייה");

    // ===== Risks =====
    const risks = [];
    if (neg) risks.push(`יחס הוצאות/הכנסות חורג מהמדיניות (${rules.max_expense_income_ratio}%)`);
    if (lowLiq) risks.push(`נזילות נמוכה מהנדרש (${rules.min_liquidity_months} חודשים)`);
    if (highDti) risks.push(`יחס DTI חורג מהמדיניות (${rules.max_dti_review}%)`);
    if (income < rules.min_income) risks.push(`הכנסה נמוכה מהמינימום הנדרש (₪${rules.min_income})`);

    if (risks.length === 0) {
      if (dti > rules.max_dti_approve) risks.push("יחס חוב להכנסה גבולי");
    }

    if (dti <= rules.max_dti_approve) {
      for (let i = risks.length - 1; i >= 0; i--) {
        if (String(risks[i]).includes('DTI') || String(risks[i]).includes('חוב להכנסה')) risks.splice(i, 1);
      }
    }

    // ===== Fixes =====
    const fixes = [];
    if (neg) fixes.push(`הקטנת הוצאות מתחת ל-${rules.max_expense_income_ratio}%`);
    if (lowLiq) fixes.push(`הגדלת נזילות ללפחות ${rules.min_liquidity_months} חודשים`);
    if (highDti) fixes.push("הפחתת התחייבויות");

    if (fixes.length === 0) {
      if (dti > rules.max_dti_approve) fixes.push(`הפחתת יחס חוב להכנסה מתחת ל־${rules.max_dti_approve}%`);
    }

    // ===== Second Chance (False Negative Detection) =====
    let secondChanceScore = 0;
    // Nuanced scoring for better False Negative detection
    if (behavior === "IMPROVING") secondChanceScore += 3; // Higher weight for consistent behavior improvement
    if (liq > rules.min_liquidity_months * 3) secondChanceScore += 3; // Exceptional liquidity
    else if (liq > rules.min_liquidity_months * 1.5) secondChanceScore += 1.5;
    if (expInc < rules.max_expense_income_ratio - 15) secondChanceScore += 2; // Strong expense control
    else if (expInc < rules.max_expense_income_ratio - 5) secondChanceScore += 1;
    if (signals.netFlowTrend === "UP") secondChanceScore += 1.5;
    if (trends.income > 5) secondChanceScore += 2; // Significant income growth

    // Dynamic threshold based on initial risk
    let requiredScoreForSecondChance = 4;
    if (risk === "Red") requiredScoreForSecondChance = 6; // Harder to rescue from Red

    // Only apply second chance if the risk is Orange or Red AND feature is enabled
    const isSecondChance = rules.enable_second_chance && (risk === "Orange" || risk === "Red") && secondChanceScore >= requiredScoreForSecondChance;

    // Upgrade risk tier if second chance is granted
    if (isSecondChance) {
        policy_explanations.push(`זיהוי פוטנציאל (False Negative): הופעל מנגנון אישור חריג עקב אינדיקטורים חיוביים חזקים (ציון: ${secondChanceScore}).`);
        if (risk === "Red") risk = "Orange";
        else if (risk === "Orange") risk = "Green";
    }

    // ===== Recommendation =====
    let rec = "APPROVE", conf = "HIGH";

    if (risk === "Red") {
      rec = "DECLINE";
      conf = "HIGH";
    } else if (risk === "Orange") {
      rec = "REVIEW";
      conf = "MEDIUM";
    } else {
      rec = "APPROVE";
      conf = "HIGH";
    }

    // ===== Narrative =====
    const isExtremeReject = risk === "Red" && (dti > 100 || (income > 0 && expenses > income * 1.5) || score < 20);

    // Context numbers the LLM MUST reference verbatim in its output
    // (so the narrative reads like an underwriter's memo, not a generic AI summary).
    const gapDti = Math.max(0, dti - rules.max_dti_approve);
    const gapIncome = Math.max(0, rules.min_income - income);
    const gapExpRatio = Math.max(0, expInc - rules.max_expense_income_ratio);
    const fixedExpenses = m.totalFixedExpenses ?? Math.round(income * (dti / 100));
    const monthlyHeadroom = Math.round(income - expenses);
    const fmt = (n) => Math.round(Number(n || 0)).toLocaleString('en-US');

    // ========== מספרי עזר מחושבים מראש לציטוט ישיר ב-prompt ==========
    const debtReductionNeeded = Math.max(0, Math.round((dti - rules.max_dti_approve) / 100 * income));
    const targetFixedExpenses = Math.round(income * rules.max_dti_approve / 100);
    const fixedExpensesReduction = Math.max(0, fixedExpenses - targetFixedExpenses);
    const guarantorIncome = Math.round(income * 1.5);
    const liquidityGap = Math.max(0, rules.min_liquidity_months - liq);
    const decisionLabelHe = rec === 'DECLINE' ? 'דחייה' : rec === 'REVIEW' ? 'בחינה' : 'אישור';
    const pledgeableAssetsText = behaviorProfile?.pledgeableAssets?.length
      ? behaviorProfile.pledgeableAssets.map(a => `- ${a.label}: שווי ₪${fmt(a.estimatedValue)}, שווי לשעבוד אחרי haircut ₪${fmt(a.pledgeableValue)} (${a.evidence})`).join('\n')
      : 'לא זוהו נכסים ברורים לשעבוד מתוך 12 חודשי הנתונים.';
    const investmentDisciplineText = behaviorProfile?.investmentDiscipline?.avgMonthlyInvestmentOutflow > 0
      ? `הלקוח מעביר בממוצע ₪${fmt(behaviorProfile.investmentDiscipline.avgMonthlyInvestmentOutflow)} בחודש להשקעות — זה סיגנל חיובי של בניית הון, לא הוצאה שלילית.`
      : 'לא זוהתה משמעת השקעה חוזרת.';

    const prompt = `אתה חתם אשראי בכיר הכותב למנהל תיק הלוואות. המוקד שלך: **איך לבנות עסקה רווחית ובת-קיימא עם הלקוח הזה** — איך למנף את החוזקות שלו, באיזה מבנה תשלום והיקף הוא יצמיח את התיק, ואילו ביטחונות הופכים את העסקה לאטרקטיבית למלווה. סיכון הוא קונטקסט לתמחור ולתנאים — לא הסיבה לדחות. הימנע מטון של 'דחייה'/'חשיפה'/'הלקוח לא ישלם'. דבר בשפה של מינוף, הזדמנות, ובניית עסקה.

מצב הלקוח:
- תזרים פנוי: ${monthlyHeadroom >= 0 ? 'חיובי' : 'שלילי'} (₪${fmt(monthlyHeadroom)}/חודש)
- DTI: ${dti}% (סף אישור ${rules.max_dti_approve}%, סף דחייה ${rules.max_dti_review}%)
- כלל מחייב: אם DTI <= ${rules.max_dti_approve}% — זה סיגנל חיובי, אסור להציג אותו כסיכון או כחריגה.
- הוצאות/הכנסה: ${expInc}%
- נזילות: ${liq} חודשים
- נכסים נזילים: ₪${fmt(assets)} | מזומן ₪${fmt(liquidAssetsBreakdown.cash)} | השקעות ₪${fmt(liquidAssetsBreakdown.etf)} | גמל/השתלמות ₪${fmt(liquidAssetsBreakdown.trainingFund)}
- המלצה נוכחית: ${decisionLabelHe}
${isSecondChance ? `- ⚡ Second Chance פעיל — גורמים מפצים: ${strengths.join(', ')}` : ''}

התנהגות בתזרים (Open Finance):
${behaviorProfile ? JSON.stringify(behaviorProfile).slice(0, 1200) : 'אין'}

💎 השקעות ונכסים לשעבוד:
${investmentDisciplineText}
${pledgeableAssetsText}

חובה: כסף שהולך להשקעות/מניות/קרנות הוא סיגנל חיובי של בניית הון, לא "הפסד" ולא "הוצאה מסוכנת". אם יש נכסים לשעבוד — הצג אותם גם ב-summary וגם ב-leverage_opportunities.
חובה לפתוח בזווית חיובית כאשר קיימים DTI תקין, היעדר הלוואות קיימות, היעדר אוברדראפט או משמעת השקעה; אל תהפוך מדד תקין לסיכון.

🚨 **הלוואות קיימות ב-12 חודשים האחרונים** (מתוך סריקת התנועות):
${behaviorProfile?.existingLoans && behaviorProfile.existingLoans.length > 0
    ? `זוהו ${behaviorProfile.existingLoansCount} החזרי הלוואה קבועים בסך ₪${fmt(behaviorProfile.existingLoansMonthlyTotal)}/חודש:\n` +
      behaviorProfile.existingLoans.map(l => `  - ${l.label}: ₪${fmt(l.monthlyAmount)}/חודש (${l.loanType}, נצפה ב-${l.monthsObserved} חודשים)`).join('\n') +
      `\n\n⚠️ **זה קריטי!** הלווה המבוקשת תצטבר ל-${behaviorProfile.existingLoansCount} הלוואות קיימות. חובה להזכיר זאת ב-summary וב-key_risks ולהתייחס אל ה-PD בהתאם. המלווה צריך להבין שמדובר ב-loan stacking.`
    : 'לא זוהו הלוואות קיימות בתנועות החשבון (נקי מהתחייבויות קיימות במערכת הבנקאית) — זה סיגנל חיובי חזק למלווה.'
}

💎 **זיהוי חוזק פיננסי סמוי (Undeclared Income Discrepancy)**:
${undeclaredIncome?.hasUnreportedInflowIndication
    ? `⚡ הופעלה אינדיקציה! התזרים הנכנס העקבי בפועל (₪${fmt(undeclaredIncome.actualInflow)}/חודש) גבוה ב-${Math.round((undeclaredIncome.discrepancyRatio || 0) * 100)}% מההכנסה המדווחת (₪${fmt(undeclaredIncome.formalIncome)}). זהו "יהלום בלתי מלוטש": מודלים מסורתיים עלולים לדחות את הלקוח בשל שכר פורמלי נמוך, אך התזרים העקבי, ללא משיכות יתר וללא חודשים שליליים, מעיד על כושר החזר ריאלי חזק. חובה לציין זאת במפורש ב-summary, ב-behavior_analysis.key_positive_signals וב-lender_risk_assessment.leverage_opportunities, ולהמליץ על מסלול מותאם אישית המבוסס על התזרים בפועל ולא על השכר המוצהר. אסור לכנות זאת "כסף שחור" — מדובר בזיהוי חוזק כלכלי שלא משתקף בנתונים המסורתיים.`
    : 'לא זוהתה אינדיקציה לפער בין הכנסה מדווחת לתזרים בפועל.'}

🔬 **מודיעין פורנזי (Forensic Intelligence — סיגנלים שדוח אשראי/BDI לא רואים)**:
${forensic?.summary?.hasForensicInsight ? `
${forensic.sideIncome?.hasSideIncome
    ? `• הכנסה צדדית: זוהו ₪${fmt(forensic.sideIncome.monthlyTotal)}/חודש מהכנסות עקביות מעבר למשכורת הבסיס${forensic.sideIncome.gigEconomyDetected ? ' (כולל פלטפורמות Gig/דיגיטל)' : ''}. זהו תזרים תומך-החזר נוסף — חובה להציגו ב-key_positive_signals וב-leverage_opportunities כבסיס להגדלת היקף ההלוואה.`
    : ''}
${forensic.activityDecline?.detected
    ? `• ירידה בפעילות (Velocity): ההכנסה החציונית ב-3 החודשים האחרונים ירדה ב-${forensic.activityDecline.incomeDropPct}% מול הבסיס הקודם (חומרה: ${forensic.activityDecline.severity}). זהו סיגנל מקדים לעצמאי/עסק שמאט — הקדם ל-BDI. חובה לציין ב-key_risks ולהתאים את ה-PD ואת מבנה התשלום.`
    : ''}
${forensic.earlyDistress?.detected
    ? `• מצוקה מוקדמת (${forensic.earlyDistress.riskLevel}): ${forensic.earlyDistress.flags.map(f => f.label).join('; ')}. ${forensic.earlyDistress.leadIndicator}. חובה לציין ב-key_risks ובהערכת ה-PD — אלו "נורות אדומות שקטות".`
    : ''}
${forensic.declarationGap?.materialMismatch
    ? `• פער הצהרה מול מציאות: הלקוח הצהיר על ₪${fmt(forensic.declarationGap.declaredMonthlyExpenses)}/חודש הוצאות מחיה, אך בפועל ההוצאות החציוניות הן ₪${fmt(forensic.declarationGap.actualMonthlyExpenses)} (פער ${forensic.declarationGap.gapPct}%, ${forensic.declarationGap.direction === 'UNDER_DECLARED' ? 'הצהרת חסר' : 'הצהרת יתר'}). חובה לציין כנקודה לתשומת לב בבניית התנאים.`
    : ''}` : 'לא זוהו סיגנלים פורנזיים חריגים מעבר לניתוח הסטנדרטי.'}

🔒 פרטיות: אסור להזכיר שמות פרטיים. מונחים מותרים: "הלקוח" / "המבקש".

=== דרישות פלט ===

1. **summary** (2-3 משפטים קצרים, אנושיים, ללא מספרים מיותרים. סיפור מנקודת מבטה של המלווה — בטון של הזדמנות מינוף, לא דחייה):
   - משפט 1: מה המלווה רואה כאן כהזדמנות — איזה סוג לקוח זה ולמה הוא מעניין לתיק (דוגמה: "לקוח עם תזרים יציב ומשמעת השקעה — הזדמנות לבנות איתו מערכת יחסים אשראית ארוכת טווח").
   - משפט 2: מה ההתנהגות מספרת על אופי הלקוח ועל המבנה הנכון לעסקה (דוגמה: "דפוס ההוצאות מתפזר באופן עקבי לאורך החודש — תשלום חודשי מתון משתלב באופן טבעי במחזור התזרים").
   - משפט 3 (אופציונלי): איך לבנות את העסקה כך שתעבוד היטב לשני הצדדים — מבנה, ביטחונות מקלים או cross-sell שמגדיל ערך (דוגמה: "שעבוד חלקי של תיק ההשקעות מאפשר להציע ריבית אטרקטיבית והיקף גדול יותר").

   ❌ אסור ב-summary: מילים כמו "דחייה", "לא בר-קיימא", "לא יחזיר", "חשיפה", "לא יכול לעמוד". אסור: מספרים, אחוזים, ספים, DTI, APPROVE/DECLINE, סגנון רובוטי.
   ✅ כתוב כמו שותף עסקי שמציג הזדמנות אשראי — בטון רגוע, מקצועי ובונה.

2. **lender_risk_assessment** — ניתוח סיכון **למלווה** (קריטי — זו התוספת הגדולה):
   הערך את העסקה מזווית המלווה — מה הסיכוי לאיבוד כסף, מה ההפסד הצפוי במקרה של כשל, ואיך העסקה משתלבת לתיק ההלוואות הכולל.
   - **default_probability** (מספר 0-100): הערך PD שנתי ל-12 חודשים הקרובים. ללוואות צרכניים טיפוסי PD: Prime 2-5%, Near-Prime 6-12%, Subprime 15-25%, High-Risk 30%+.
   - **loss_given_default** (מספר 0-100): % מהקרן שיאבד במקרה של כשל. ללא ביטחונות: 55-65%. עם ערב: 30-40%. עם ביטחון מלא: 15-25%.
   - **expected_loss** (מספר 0-100): PD × LGD / 100. זו רצפת המחיר המינימלית למלווה (לפני עלויות הון ותפעול).
   - **portfolio_view** (משפט 1): הצג את העסקה כתוספת חיובית לתיק מגוון. ברירת המחדל היא Prime/Near-Prime; הסיווג למטה מ-Near-Prime מותר רק כשיש דגלים חמורים אמיתיים (DTI מעל סף הדחייה, אוברדראפט מתמשך, הכנסה מתחת למינימום). אל תזכיר 'תזרים שלילי' או 'loan stacking' כשאין הלוואות קיימות בפועל.
   - **mitigations** (מערך של 2-4 פריטים): מה המלווה יכול לעשות כדי להפחית סיכון. דוגמאות: "שעבוד תיק השקעות", "קיצור תקופה ל-24 חודשים", "העמדת תשלום ראשון גבוה", "העלאת ריבית לכיסוי ה-Expected Loss".
   - **leverage_opportunities** (מערך של 2-4 פריטים): איך למנף את הלקוח בצורה רווחית: הגדלת סכום תחת שיעבוד, מסלול Prime/Near-Prime, cross-sell, הלוואה מגובה נכס, או הצעה מותנית לפי תזרים.
   - **collateral_assets** (מערך): נכסים שזוהו מתוך 12 חודשים וניתנים לבחינת שעבוד.

3. **behavior_analysis.key_positive_signals** (מערך של פריטים קצרים עם מספר): אם אין — מערך ריק.

4. **behavior_analysis.key_risks** (מערך קצר של דברים שהמלווה צריך לקחת בחשבון בעת בניית התנאים — לא סיבות לדחייה. נסח כ"נקודות לתשומת לב" בטון מאוזן):
   - אם DTI ${dti}% נמוך או שווה לסף ${rules.max_dti_approve}% — אסור להכניס DTI כסיכון.
   - הימנע מניסוחים כמו "חורג", "מסוכן", "לא עומד". העדף: "כדאי לתמחר בהתאם ל...", "שווה לבחון מבנה תשלום מותאם ל...".
   - אם אין הלוואות קיימות בפועל ב-behaviorProfile.existingLoans — אסור להזכיר loan stacking.

5. **recommended_terms.conditions**: תנאים קצרים למלווה (לדוגמה: "תקופה מקסימלית 36 חודשים", "ערב עם הכנסה ₪${fmt(guarantorIncome)}+").`;

    let narrative = "המדדים המבניים חושבו בהצלחה. הניתוח הנרטיבי מתעדכן בנפרד.";
    let llmAnalysis = null;
    if (!body?.deferNarrative) {
    try {
      const llm = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: "gpt_5_mini",
        // schema additions below carry the lender-risk fields (PD/LGD/EL/portfolio_view/mitigations)
        // so the frontend can render LenderRiskBlock without a follow-up LLM call.
        response_json_schema: {
          type: "object",
          properties: {
            decision: { type: "string" },
            confidence: { type: "number" },
            is_false_negative: { type: "boolean" },
            summary: { type: "string" },
            policy_analysis: {
              type: "object",
              properties: {
                policy_status: { type: "string" },
                breaches: { type: "array", items: { type: "string" } },
                why_policy_failed: { type: "string" }
              }
            },
            behavior_analysis: {
              type: "object",
              properties: {
                trend: { type: "string" },
                key_positive_signals: { type: "array", items: { type: "string" } },
                key_risks: { type: "array", items: { type: "string" } }
              }
            },
            lender_risk_assessment: {
              type: "object",
              properties: {
                default_probability: { type: "number" },
                loss_given_default: { type: "number" },
                expected_loss: { type: "number" },
                portfolio_view: { type: "string" },
                mitigations: { type: "array", items: { type: "string" } },
                leverage_opportunities: { type: "array", items: { type: "string" } },
                collateral_assets: { type: "array", items: { type: "string" } }
              }
            },
            override_analysis: {
              type: "object",
              properties: {
                override_recommended: { type: "boolean" },
                reason: { type: "string" },
                confidence: { type: "number" }
              }
            },
            recommended_terms: {
              type: "object",
              properties: {
                approve: { type: "boolean" },
                amount: { type: "number" },
                interest_adjustment: { type: "string" },
                conditions: { type: "array", items: { type: "string" } }
              }
            }
          },
          required: ["decision", "summary", "is_false_negative"]
        }
      });
      if (llm) {
          // Some models (e.g. Claude via the InvokeLLM bridge) wrap the JSON in { response: {...} }.
          // Unwrap so all downstream code sees a flat object with `summary`, `decision`, etc.
          const flat = (llm && typeof llm === 'object' && llm.response && typeof llm.response === 'object') ? llm.response : llm;
          llmAnalysis = flat;
          narrative = flat.summary || narrative;
          if (flat.decision === "APPROVE") rec = "APPROVE";
          else if (flat.decision === "REVIEW") rec = "REVIEW";
          else if (flat.decision === "DECLINE") rec = "DECLINE";
          // Decisions may arrive prefixed ("DECLINE — דחייה") — normalize via startsWith too.
          else if (typeof flat.decision === 'string') {
              if (flat.decision.startsWith('APPROVE')) rec = 'APPROVE';
              else if (flat.decision.startsWith('REVIEW')) rec = 'REVIEW';
              else if (flat.decision.startsWith('DECLINE')) rec = 'DECLINE';
          }

          if (!isExtremeReject && (flat.override_analysis?.override_recommended || flat.is_false_negative)) {
              if (risk === "Red") risk = "Orange";
              else if (risk === "Orange") risk = "Green";
          }

          // Ensure AI doesn't go rogue against hard system states
          if (m.isClean12Months) {
              rec = "APPROVE";
              risk = "Green";
              llmAnalysis.is_false_negative = false;
          } else if (risk === "Green" && rec === "DECLINE") {
              rec = "REVIEW"; // At worst, a Green score requires human review, not auto-decline
          }

          if (isExtremeReject) {
              rec = "DECLINE";
              risk = "Red";
              llmAnalysis.is_false_negative = false; // Prevent logic bleeding
              if (llmAnalysis.override_analysis) {
                  llmAnalysis.override_analysis.override_recommended = false;
              }
          }
      }
    } catch (e) {
        console.error("LLM Error:", e);
    }
    }

    // ===== Pricing (Calculated after LLM overrides) =====
    let approveAmount = Math.round(income * 6);
    let approveInterest = 8;

    if (risk === "Orange") {
        approveInterest += 1;
        approveAmount *= 0.8;
    }
    if (risk === "Red") {
      approveInterest += 2;
      approveAmount *= 0.5;
    }

    if (isSecondChance) {
      approveInterest += 1.5;
      approveAmount *= 0.8;
    }

    let options = [
      {
        decision: "APPROVE",
        max_loan_amount: Math.round(approveAmount),
        suggested_interest: Math.round(approveInterest * 10) / 10
      },
      {
        decision: "REVIEW",
        max_loan_amount: Math.round(income * 4),
        suggested_interest: 11
      },
      {
        decision: "DECLINE",
        max_loan_amount: 0,
        suggested_interest: null
      }
    ];

    if (rec === "DECLINE") {
      options = [
        {
          decision: "DECLINE",
          max_loan_amount: 0,
          suggested_interest: null
        }
      ];
    }

    try {
      await base44.asServiceRole.entities.AuditLog.create({
        action: "AI_INSIGHT_ANALYSIS",
        user_id: user ? user.email : 'anonymous',
        details: { risk_tier: risk, decision: rec, dti },
        status: "SUCCESS"
      });
    } catch (err) {
      console.error("Audit log failed:", err);
    }

    // ===== Layer 1 Contract: analysisInsights =====
    const incomeTrendMap = signals.incomeTrend === 'UP' ? 'positive' : signals.incomeTrend === 'DOWN' ? 'negative' : 'stable';
    const anomalyDetected = signals.expenseTrend === 'INCREASING' || (trends.expenses || 0) > 15;
    const behavioralScore = Math.max(0, Math.min(1, Number((secondChanceScore / 10).toFixed(2))));
    const keyInsights = [];
    if (highDti) keyInsights.push(`יחס החזר (DTI) ${dti}% חורג מהמקסימום ${rules.max_dti_review}%`);
    if (lowLiq) keyInsights.push(`נזילות של ${liq} חודשים נמוכה מהנדרש (${rules.min_liquidity_months})`);
    if (neg) keyInsights.push(`יחס הוצאות/הכנסות ${expInc}% מעל המדיניות (${rules.max_expense_income_ratio}%)`);
    if (income < rules.min_income) keyInsights.push(`הכנסה ₪${Math.round(income)} מתחת למינימום ₪${rules.min_income}`);
    if (signals.netFlowTrend === 'UP') keyInsights.push('תזרים מזומנים במגמת עלייה');
    if (behavior === 'IMPROVING') keyInsights.push('מגמת שיפור התנהגותית עקבית');
    if (behaviorProfile?.investmentDiscipline?.avgMonthlyInvestmentOutflow > 0) keyInsights.push(`משמעת השקעה חיובית — ₪${Math.round(behaviorProfile.investmentDiscipline.avgMonthlyInvestmentOutflow).toLocaleString('en-US')} בחודש בממוצע להשקעות`);
    if (behaviorProfile?.totalPledgeableValue > 0) keyInsights.push(`זוהו נכסים אפשריים לשעבוד בשווי שמרני ₪${Math.round(behaviorProfile.totalPledgeableValue).toLocaleString('en-US')}`);
    if (isSecondChance) keyInsights.push('זוהה פוטנציאל False Negative — גורמים מפצים חזקים');
    if (undeclaredIncome?.hasUnreportedInflowIndication) keyInsights.push(`חוזק פיננסי סמוי — תזרים בפועל גבוה ב-${Math.round((undeclaredIncome.discrepancyRatio || 0) * 100)}% מההכנסה המדווחת`);
    // ── Forensic Intelligence signals (BDI can't see these) ──
    if (forensic?.sideIncome?.hasSideIncome) keyInsights.push(`הכנסה צדדית תומכת-החזר — ₪${Math.round(forensic.sideIncome.monthlyTotal).toLocaleString('en-US')}/חודש${forensic.sideIncome.gigEconomyDetected ? ' (Gig)' : ''}`);
    if (forensic?.activityDecline?.detected) keyInsights.push(`⚠️ ירידה בפעילות — הכנסה ירדה ${forensic.activityDecline.incomeDropPct}% (סיגנל מקדים ל-BDI)`);
    if (forensic?.earlyDistress?.detected) keyInsights.push(`⚠️ מצוקה מוקדמת (${forensic.earlyDistress.riskLevel}) — ${forensic.earlyDistress.flags.length} סימני לחץ שקטים`);
    if (forensic?.declarationGap?.materialMismatch) keyInsights.push(`פער הצהרה מול מציאות — ${forensic.declarationGap.gapPct}% בהוצאות המחיה`);
    if (keyInsights.length === 0) keyInsights.push('הפרופיל עומד במדיניות החיתום');

    const analysisInsights = {
      isFalseNegative: !!(llmAnalysis?.is_false_negative || isSecondChance),
      incomeTrend: incomeTrendMap,
      anomalyDetected,
      liquidityMonths: liq,
      behavioralScore,
      keyInsights
    };

    return Response.json({
      success: true,
      analysisInsights,
      insights: {
        narrative,
        behaviorSignals: signals,
        risk_tier: risk,
        metrics: {
          totalIncome: income,
          totalExpenses: expenses,
          liquidAssets: assets,
          liquidAssetsBreakdown,
          dti,
          expense_to_income_ratio: expInc,
          liquidity_months: liq
        },
        second_chance_analysis: {
          eligible: isSecondChance,
          score: secondChanceScore,
          reasons: strengths
        },
        llm_analysis: llmAnalysis,
        analysisInsights,
        analyst_recommendation: {
          recommendation: { decision: rec, confidence: conf },
          options,
          key_risks: risks,
          strengths,
          what_to_improve: fixes,
          policy_explanations
        }
      }
    });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}));