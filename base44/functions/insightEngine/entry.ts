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
  }).optional()
}).passthrough();

Deno.serve(withValidation(schema, async (req, body) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    // Allow anonymous access for public apps
    // if (!user) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const m = body?.metrics;
    if (!m) return Response.json({ success: false, error: "metrics required" });

    const income = m.totalIncome ?? 0;
    const expenses = m.totalExpenses ?? 0;
    const assets = m.liquidAssets ?? 0;
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

    const prompt = `
אתה חתם אשראי בכיר בחברת מימון חוץ-בנקאית, כותב מזכר חיתום ל-VP Sales. הקורא הוא איש מכירות שצריך להבין תוך 10 שניות: האם מאשרים, בכמה, ולמה — או אם דוחים, מה הפער המספרי שצריך לסגור כדי לחזור לעסקה.

⛔ אסור לחלוטין:
- ביטויים כלליים בלי מספרים ("הוצאות גבוהות", "הכנסה נמוכה", "מגמה חיובית", "גורמים מפצים", "פוטנציאל").
- שפה של מאמן כושר/יועץ פיננסי ("הלקוח צריך לשפר", "מומלץ לשקול").
- חזרה על הגדרות המערכת ("DTI חורג מהמדיניות") בלי לומר במה בדיוק ובכמה ש"ח/אחוזים.

✅ חובה:
- כל סיכון, כל חוזק, כל המלצה — חייבים לכלול מספר קונקרטי (₪, %, או חודשים).
- שורת מחץ ראשונה: החלטה + הסיבה המספרית האחת המכרעת. דוגמה טובה: "דחייה — DTI ${dti}% חורג ב-${gapDti} נקודות מסף האישור ${rules.max_dti_approve}%, פער שדורש הפחתת התחייבויות חודשיות של כ-₪${fmt(Math.max(0, (dti - rules.max_dti_approve) / 100 * income))}."
- כשמדברים על שיפור — תן יעד מספרי. לא "להקטין הוצאות" אלא "להפחית הוצאות קבועות מ-₪${fmt(fixedExpenses)} ל-₪${fmt(Math.round(income * rules.max_dti_approve / 100))} (-₪${fmt(Math.max(0, fixedExpenses - Math.round(income * rules.max_dti_approve / 100)))} בחודש)".
- חוזקות = רק כאלה שמשנות את הצעת המחיר. נזילות גבוהה ב-2 חודשים מעל הסף = חוזק. מגמת הכנסה +3% = רעש, לא חוזק.

${isExtremeReject ? 
`⚠️ נתונים קיצוניים — DTI מעל 100%, ציון אפסי או תזרים שלילי קבוע. דחייה מוחלטת (DECLINE). אל תחפש סיבות לאשר. הסבר את עוצמת החריגה במספרים יבשים בלבד.`
: 
`💡 עקרונות חיתום שאתה מיישם:
- העברות לני"ע / קרן השתלמות / חיסכון = נזילות, לא הוצאה. אם זוהו כאלה — ציין ב-₪ ובחודשים נוספים של runway שזה מוסיף.
- DTI חושב כבר רק על הוצאות קבועות. השקעות לא בפנים. אם הלקוח ב-Wealth Building — תרגם את זה לסכום חודשי שעובר לחיסכון.
- ריבית מתמחרת סיכון. אם הסיכון בינוני — אישור בריבית גבוהה ב-1-2% עדיף על דחייה.
- False Negative = הלקוח נראה רע על הנייר אבל יכולת ההחזר האמיתית קיימת. תוכיח את זה במספר תזרים פנוי חודשי בש"ח, לא בסיסמאות.`}

נתוני הלקוח:
${JSON.stringify({ 
  income: Math.round(income), 
  expenses: Math.round(expenses), 
  fixedExpenses, 
  monthlyHeadroom, 
  dti, 
  dtiGapAboveApprove: gapDti, 
  liq, 
  expInc, 
  expRatioGapAbovePolicy: gapExpRatio, 
  incomeGapBelowMin: gapIncome, 
  signals, 
  trends, 
  currentRisk: risk, 
  isSecondChance, 
  secondChanceScore, 
  policy_breaches: policy_explanations, 
  rules: { max_dti_approve: rules.max_dti_approve, max_dti_review: rules.max_dti_review, min_income: rules.min_income, min_liquidity_months: rules.min_liquidity_months, max_expense_income_ratio: rules.max_expense_income_ratio }
})}

🎯 פלט נדרש:

1. **summary** (תקציר מנהלים, 3-5 שורות בפורמט VP Sales):
   - שורה 1: "[החלטה] — [הסיבה המספרית האחת המכרעת]." בלי קישוטים.
   - שורה 2: "תזרים פנוי חודשי: ₪[סכום]. נזילות: [X] חודשים." — שני המספרים שמכריעים יכולת החזר.
   ${isExtremeReject ?
   `- שורה 3: "פער לסגירה: [מספר ספציפי] — לא ניתן לסגור בטווח של 3-6 חודשים."
   - שורה 4: "צפי ללא התערבות: [תיאור קרירות מספרי של ההידרדרות הצפויה]."` :
   `- שורה 3: "מה צריך כדי להזיז ל-APPROVE: [פעולה אחת עם יעד מספרי]."
   - שורה 4 (אופציונלית): "חלון הזדמנות: [תאריך/מסגרת זמן] לבדיקה חוזרת."`}

2. **behavior_analysis.key_positive_signals** (מערך):
   רק סיגנלים מספריים שמשפיעים על תמחור. כל פריט בפורמט: "[סיגנל] — [מספר/השפעה כספית]."
   דוגמאות תקפות: "נזילות עודפת מעל הסף: [X] חודשים מעבר לנדרש, שווי-ערך לכרית של ₪[סכום]." / "תזרים פנוי חיובי: ₪[סכום] בחודש לאחר הוצאות קבועות." / "פעילות חיסכון/השקעה: ₪[סכום] בחודש שלא נכנס לחישוב DTI."
   ❌ אסור: "מגמת הכנסה חיובית" בלי מספר. "התנהגות יציבה". "גורמים מפצים".
   אם אין סיגנל מספרי חזק — מערך ריק. אל תמציא.

3. **behavior_analysis.key_risks** (מערך):
   כל סיכון = פער מספרי לסף. פורמט: "[שם המדד] [ערך נוכחי] — חורג ב-[פער] מהסף [ערך הסף]."
   דוגמאות: "DTI ${dti}% — חורג ב-${gapDti} נק' מסף האישור ${rules.max_dti_approve}%." / "הוצאות/הכנסה ${expInc}% — חורג ב-${gapExpRatio.toFixed(1)} נק' מהמדיניות ${rules.max_expense_income_ratio}%."
   ❌ אסור: "הכנסה נמוכה" / "הוצאות גבוהות" בלי מספרים.

4. **recommended_terms.conditions** (במקרה של APPROVE/REVIEW):
   כל תנאי = מספר. לדוגמה: "קיצור תקופה ל-36 חודשים", "דרישת ערב סולבנטי עם הכנסה ₪${fmt(Math.round(income * 1.5))}+", "ביטחון נזיל של 10% מקרן ההלוואה".
`;

    let narrative = "מצב פיננסי יציב.";
    let llmAnalysis = null;
    try {
      const llm = await base44.integrations.Core.InvokeLLM({
        prompt,
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
          llmAnalysis = llm;
          narrative = llm.summary || narrative;
          if (llm.decision === "APPROVE") rec = "APPROVE";
          else if (llm.decision === "REVIEW") rec = "REVIEW";
          else if (llm.decision === "DECLINE") rec = "DECLINE";
          
          if (!isExtremeReject && (llm.override_analysis?.override_recommended || llm.is_false_negative)) {
              if (risk === "Red") risk = "Orange";
              else if (risk === "Orange") risk = "Green";
          }

          // Ensure AI doesn't go rogue against hard system states
          if (m.isClean12Months) {
              rec = "APPROVE";
              risk = "Green";
              llm.is_false_negative = false;
              llmAnalysis.is_false_negative = false;
          } else if (risk === "Green" && rec === "DECLINE") {
              rec = "REVIEW"; // At worst, a Green score requires human review, not auto-decline
          }

          if (isExtremeReject) {
              rec = "DECLINE";
              risk = "Red";
              llm.is_false_negative = false; // Prevent logic bleeding
              llmAnalysis.is_false_negative = false;
              if (llmAnalysis.override_analysis) {
                  llmAnalysis.override_analysis.override_recommended = false;
              }
          }
      }
    } catch (e) {
        console.error("LLM Error:", e);
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
    if (isSecondChance) keyInsights.push('זוהה פוטנציאל False Negative — גורמים מפצים חזקים');
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