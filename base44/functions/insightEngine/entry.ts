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

    const prompt = `
אתה חתם אשראי בכיר בחברת מימון חוץ-בנקאית. המשימה שלך היא להבדיל בין לקוח "בזבזן" ללקוח "משקיע".
${isExtremeReject ? 
`⚠️ שים לב: מדובר בלקוח או בסימולציה עם נתונים קיצוניים לחלוטין (DTI של מעל 100%, ציון אפסי או תזרים שקורס). 
חובה עליך לקבוע דחייה מוחלטת (DECLINE). אל תחפש סיבות לאשר ואל תמליץ על בחינה נוספת. כתוב תקציר מנהלים מקצועי וקר שמסביר את עוצמת החריגה ביחס ההחזר או בתזרים.`
: 
`המטרה העסקית שלך היא למקסם אישורי הלוואות בטוחות (למצוא את ה"כן"), במיוחד במקרים שהמערכת האוטומטית דחתה טכנית (False Negatives). אתה לא "אבא ואמא" של הלקוח, אלא מנתח סיכונים עסקי שמחפש גורמים מפצים המאפשרים אישור.

⚠️ עקרונות עבודה:
- השקעה היא נזילות: עליך להתייחס להעברות לניירות ערך (Trading/Securities), קרנות השתלמות וחיסכון כאל נזילות גבוהה. כסף שיוצא להשקעה הוא סיגנל חיובי ליכולת החזר ואין להחשיב אותו כהוצאה שגורעת מהציון.
- נטרול "עונש העו"ש": אל תוריד ציון על יתרה נמוכה בעובר ושב אם מזוהה פעילות השקעה עקבית. לקוח שמשקיע את העודפים שלו הוא לווה בטוח יותר.
- חישוב DTI חכם: DTI במערכת כבר מחושב רק על בסיס הוצאות קשיחות (שכירות, הלוואות, ביטוח). השקעות וחיסכון מוחרגים מהחישוב הזה.
- ניתוח מגמות 12/4: בסיס שנתי קובע את הרמה, ומומנטום (4 חודשים) מזהה שינויים. לקוח שהגדיל את היקף ההשקעות ב-4 החודשים האחרונים הוא ב"Wealth Building". תיוג זה מעלה את ציון החוסן ויש לציין זאת בחיוב בהמלצה.
- חפש אקטיבית סיבות לאשר: התמקד ביכולת החזר אמיתית, יציבות תעסוקתית, ומגמות שיפור במומנטום של 4 החודשים האחרונים.
- תמחור סיכון: אם יש סיכון, שקול אישור בריבית גבוהה יותר או בסכום נמוך יותר (REVIEW) במקום דחייה אוטומטית.
- כתוב בצורה קצרה, חדה, עקבית ומבנית.`}

נתוני הלקוח (כולל החלטת מערכת נוכחית והפרות מדיניות):
${JSON.stringify({ income, expenses, signals, trends, currentRisk: risk, isSecondChance, dti, liq, expInc, secondChanceScore, policy_explanations, fixes, strengths })}

🎯 משימה:
בהתבסס על הנתונים, קבע:
${isExtremeReject ? 
`- קבע החלטה DECLINE.
- הסבר בקצרה למה הנתונים הללו חוסמים כל אפשרות לאשראי סביר.
- צפה פני עתיד: תאר בקצרה כיצד ייראה מצבו של הלקוח ב-3-6 החודשים הקרובים ללא שינוי (למשל, קריסה תזרימית מוחלטת).
- המלצות קונקרטיות: הצע 2-3 פעולות חירום ספציפיות שהלקוח חייב לבצע (למשל, "חובה להקטין הוצאות ב-X%", "מכירת נכסים").` 
: 
`- האם ניתן להפוך דחייה לאישור (False Negative) על בסיס גורמים מפצים?
- מה ההחלטה המומלצת עכשיו (APPROVE / REVIEW / DECLINE).
- אם מאשרים (או REVIEW) — באילו תנאים.
- המלצות קונקרטיות לשיפור: ספק 2-3 הצעות פעולה אופרטיביות וספציפיות ללקוח (לדוגמה: "הקטנת הוצאות מחיה ב-10%", "הגדלת חיסכון", "מחזור הלוואות קיימות").
- צפי מגמות עתידיות: התייחס לכיצד ייראה מצב הלקוח בעוד 3-6 חודשים אם לא יבוצע שינוי בהתנהלות הנוכחית.

📊 ניתוח נדרש:
- זהה יכולת תזרימית פנויה אמיתית להחזר ההלוואה.
- הדגש סיגנלים חיוביים (כמו תזרים חיובי עקבי).
- נתח את הסיכון בצורה עסקית קרה.

🧠 דגש חשוב (False Negative):
אם המערכת דחתה טכנית אך הלקוח מראה יכולת החזר:
- הסבר מדוע הדחייה הטכנית אינה משקפת את יכולת ההחזר האמיתית.
- הצג את הגורמים המפצים.
- אם הזיהוי השגוי נובע מ"רעש תזרימי" (העברות/חסכונות שניפחו את ההוצאות), חובה עליך להשתמש בניסוח הבא במפורש (ולשלב אותו בטקסט): "הוצאות הלקוח נראות גבוהות טכנית בשל העברות לחיסכון/השקעה, אך יכולת ההחזר האמיתית נותרה גבוהה."`}

🧾 הנחיות כתיבה לתקציר (Summary):
- פתח בשורת מחץ ברורה המציינת את ההחלטה העסקית.
- השתמש בנקודות קצרות וברורות (Bullet points) להצגת ההצדקה, הצפי העתידי, וההמלצות הקונקרטיות.
- המבנה חייב להיות אחיד כדי להבטיח עקביות בין ריצות.
- תהיה ישיר, עסקי ותכליתי.
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

    return Response.json({
      success: true,
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