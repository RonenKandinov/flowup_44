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
    dti: z.number().optional(),
    trends: z.object({ income: z.number().optional(), expenses: z.number().optional() }).optional(),
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

    const liq = income > 0 ? +(assets / income).toFixed(1) : 0;
    const expInc = income > 0 ? +((expenses / income) * 100).toFixed(1) : 0;

    // ===== Base Risk =====
    let risk = score < 55 ? "Red" : score < 80 ? "Orange" : "Green";

    // ===== Behavior =====
    let behavior = "STABLE";
    if (history.length >= 2) {
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

    if (isRejected) {
        risk = "Red";
    } else if (isReview) {
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
    if (behavior === "IMPROVING") strengths.push("מגמת שיפור עקבית");
    if (liq > rules.min_liquidity_months * 2) strengths.push("נזילות גבוהה");
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

    // ===== Pricing =====
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
      approveInterest += 1.5; // Premium for the risk taken on second chance
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

    // ===== Narrative =====
    const prompt = `
אתה חתם אשראי בכיר בחברת מימון חוץ-בנקאית.
המטרה העסקית שלך היא למקסם אישורי הלוואות בטוחות (למצוא את ה"כן"), במיוחד במקרים שהמערכת האוטומטית דחתה טכנית (False Negatives). אתה לא "אבא ואמא" של הלקוח, אלא מנתח סיכונים עסקי שמחפש גורמים מפצים המאפשרים אישור.

⚠️ עקרונות עבודה:
- חפש אקטיבית סיבות לאשר: התמקד ביכולת החזר אמיתית, יציבות תעסוקתית, ומגמות שיפור, גם אם יש חריגות יבשות מהמדיניות.
- תמחור סיכון: אם יש סיכון, שקול אישור בריבית גבוהה יותר או בסכום נמוך יותר (REVIEW) במקום דחייה אוטומטית.
- אל תחנך את הלקוח: אל תיתן עצות לחיסכון. התמקד בשאלה "האם הוא יכול להחזיר את ההלוואה?".
- כתוב בצורה קצרה, חדה ומקצועית, מוכוונת שורת רווח.

נתוני הלקוח (כולל החלטת מערכת נוכחית והפרות מדיניות):
${JSON.stringify({ income, expenses, signals, trends, currentRisk: risk, isSecondChance, dti, liq, expInc, secondChanceScore, policy_explanations, fixes, strengths })}

🎯 משימה:
בהתבסס על הנתונים, קבע:
- האם ניתן להפוך דחייה לאישור (False Negative) על בסיס גורמים מפצים (למשל: הכנסה גבוהה שמפצה על DTI גבולי, או מגמת שיפור חזקה)?
- מה ההחלטה המומלצת עכשיו (APPROVE / REVIEW / DECLINE) - העדף APPROVE או REVIEW על פני DECLINE אם יש הגיון עסקי.
- אם מאשרים (או REVIEW) — באילו תנאים (התאמת סכום/ריבית לסיכון).

📊 ניתוח נדרש:
- זהה יכולת תזרימית פנויה אמיתית להחזר ההלוואה, מעבר ליחסים היבשים.
- הדגש סיגנלים חיוביים (כמו תזרים חיובי עקבי) שמאפשרים "לעקוף" חוקי מדיניות נוקשים.
- נתח את הסיכון בצורה עסקית קרה: האם הסיכון מתומחר נכון?

🧠 דגש חשוב (False Negative):
אם המערכת דחתה טכנית אך הלקוח מראה יכולת החזר:
- הסבר מדוע הדחייה הטכנית אינה משקפת את יכולת ההחזר האמיתית.
- הצג את הגורמים המפצים שמאפשרים לאשר את העסקה בבטחה.

🧾 הנחיות כתיבה:
- תהיה ישיר, עסקי ותכליתי.
- אל תכתוב אזהרות כלליות או עצות חינוכיות.
- התמקד בשורה התחתונה: למה כדאי לנו לאשר את ההלוואה הזו.
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
          
          if (llm.override_analysis?.override_recommended || llm.is_false_negative) {
              if (risk === "Red") risk = "Orange";
              else if (risk === "Orange") risk = "Green";
          }
      }
    } catch (e) {
        console.error("LLM Error:", e);
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