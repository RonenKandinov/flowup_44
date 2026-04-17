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

    // projectedDSR = DSR after recommended adjustments (down-payment of 10% of income + 12-month term reduction in obligations)
    // This is purely an indicative post-adjustment ratio to prevent mixing present vs. future.
    const projectedDSR = +(dti * 0.85).toFixed(1);

    const hardFacts = {
      income,
      expenses,
      expenseIncomeRatio: expInc,
      currentDSR: dti,
      projectedDSR,
      liquidityMonths: liq,
      behavioralScore: +(secondChanceScore / 10).toFixed(2),
      incomeTrend: signals.incomeTrend,
      anomalyDetected: signals.expenseTrend === 'INCREASING' || (trends.expenses || 0) > 15,
      riskTier: risk,
      isFalseNegativeCandidate: isSecondChance,
      policyBreaches: policy_explanations,
      rulePolicy: { max_dti_approve: rules.max_dti_approve, max_dti_review: rules.max_dti_review, max_expense_income_ratio: rules.max_expense_income_ratio, min_liquidity_months: rules.min_liquidity_months }
    };

    const prompt = `
אתה FlowUp AI Analyst – מנוע ניתוח פיננסי עבור חברות מימון חוץ-בנקאיות.

המטרה שלך: להפיק ניתוח אמין, עקבי לוגית, תומך-החלטה ולא שיווקי. המערכת מסבירה פערים — לא מחליטה אישור.

==================================================
🔴 חוק עליון (CRITICAL — אסור להפר בשום תנאי):
==================================================
אסור שתהיה סתירה בין הנתונים המספריים לבין הטקסט.
- אם expenseIncomeRatio > 100% — אסור לכתוב "יכולת החזר טובה" / "שליטה בהוצאות" / ניסוח חיובי דומה. חובה להדגיש מצב בעייתי + פוטנציאל לשיפור בלבד.
- אם currentDSR > max_dti_review — אסור להצהיר אישור.
- אסור לערבב בין מצב נוכחי (present) לבין מצב לאחר התאמות (future). כל אזכור של projectedDSR חייב לכלול את הביטוי "לאחר התאמות".
- אסור להשתמש במילים: "נראה", "כנראה", "אולי". שפה פורמלית וחד-משמעית בלבד.
- אין לייפות נתונים. אין לכתוב Positive Signal שלא מגובה בנתון מספרי מהקלט.

==================================================
מבנה פלט חובה (5 בלוקים קבועים):
==================================================
1. false_negative_insight — הצג רק אם: behavioralScore גבוה (≥0.6) + incomeTrend חיובי + anomalyDetected. פורמט: "זוהתה אינדיקציה ל-False Negative..." (אינדיקציה בלבד, לא וודאות). אם לא מתקיים — החזר מחרוזת ריקה "".
2. kpi_metrics — אובייקט עם liquidityMonths, expenseIncomeRatio, projectedDSR. projectedDSR תמיד עם הלייבל "לאחר התאמות".
3. executive_summary — 4 חלקים חובה ברצף בסדר זה:
   (א) מצב נוכחי: "ללקוח יחס הוצאות/הכנסות של X%..."
   (ב) בעיה: "המצב הנוכחי אינו מאפשר אישור תחת מדיניות סטנדרטית"
   (ג) פוטנציאל: "עם זאת, זוהו גורמים המעידים על פוטנציאל לשיפור..." (רק אם יש גורמים תומכים אמיתיים בנתונים; אחרת דלג על סעיף זה)
   (ד) מסקנה: "בהתאם, ניתן לשקול התאמת מבנה הלוואה"
4. positive_signals — מערך קצר. רק פריטים המגובים בנתון:
   - incomeTrend === 'UP' → "מגמת הכנסות חיובית"
   - liquidityMonths גבוה → "נזילות של X חודשים"
   - behavioralScore ≥ 0.6 → "התנהלות פיננסית יציבה"
   בלי פריטים שאינם נתמכים במספרים. פורמט קצר עם ✔️.
5. risk_signals — מערך קצר, חובה להיות כנים. למשל:
   - expenseIncomeRatio > 100% → "יחס הוצאות להכנסות מעל 100%"
   - currentDSR גבוה → "יכולת החזר נוכחית מוגבלת"
   - liquidityMonths < min → "נזילות נמוכה"
   פורמט קצר עם ❌.

==================================================
שדות עזר להחלטה:
==================================================
decision: APPROVE / REVIEW / DECLINE
is_false_negative: true רק כאשר כל שלושת הקריטריונים מתקיימים (behavioralScore≥0.6 + incomeTrend UP + anomalyDetected) ועם סיבה מנומקת.

==================================================
נתונים קשיחים (מקור האמת — אסור לסתור):
==================================================
${JSON.stringify(hardFacts)}

${isExtremeReject ? '⚠️ מצב קיצון: currentDSR>100% או score<20 — חובה DECLINE. אין אישור, אין REVIEW.' : ''}

כתוב את ה-summary בעברית פורמלית, נקודתית, בלי סופרלטיבים. תקציר מנהלים חייב לכלול את 4 החלקים (א-ד) ברצף.
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
            false_negative_insight: { type: "string" },
            kpi_metrics: {
              type: "object",
              properties: {
                liquidityMonths: { type: "number" },
                expenseIncomeRatio: { type: "number" },
                projectedDSR: { type: "string" }
              }
            },
            executive_summary: { type: "string" },
            positive_signals: { type: "array", items: { type: "string" } },
            risk_signals: { type: "array", items: { type: "string" } },
            summary: { type: "string" },
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
            }
          },
          required: ["decision", "executive_summary", "is_false_negative", "positive_signals", "risk_signals", "kpi_metrics"]
        }
      });
      if (llm) {
          llmAnalysis = llm;

          // ===== CRITICAL: Contradiction guard =====
          // Strip any positive_signal that contradicts the hard facts.
          if (Array.isArray(llm.positive_signals)) {
            llm.positive_signals = llm.positive_signals.filter(s => {
              const t = String(s).toLowerCase();
              if (expInc > 100 && /יכולת החזר טובה|שליטה בהוצאות|יציב/.test(s)) return false;
              if (signals.incomeTrend !== 'UP' && /מגמת הכנסות חיובית|הכנסה עולה/.test(s)) return false;
              if (liq < rules.min_liquidity_months && /נזילות/.test(s)) return false;
              return true;
            });
          }
          // Ensure risk_signals reflects reality
          if (!Array.isArray(llm.risk_signals)) llm.risk_signals = [];
          if (expInc > 100 && !llm.risk_signals.some(r => /100%/.test(r))) {
            llm.risk_signals.unshift("❌ יחס הוצאות להכנסות מעל 100%");
          }
          if (dti > rules.max_dti_review && !llm.risk_signals.some(r => /החזר/.test(r))) {
            llm.risk_signals.push("❌ יכולת החזר נוכחית מוגבלת");
          }
          if (liq < rules.min_liquidity_months && !llm.risk_signals.some(r => /נזילות/.test(r))) {
            llm.risk_signals.push("❌ נזילות נמוכה");
          }

          // Inject canonical kpi_metrics from hard facts (override any hallucinated values)
          llm.kpi_metrics = {
            liquidityMonths: liq,
            expenseIncomeRatio: expInc,
            projectedDSR: `${projectedDSR}% (לאחר התאמות)`
          };

          // Normalize false_negative_insight — only show when all three criteria hold
          const behavioralOk = (secondChanceScore / 10) >= 0.6;
          const incomeUp = signals.incomeTrend === 'UP';
          const anomaly = signals.expenseTrend === 'INCREASING' || (trends.expenses || 0) > 15;
          if (!(behavioralOk && incomeUp && anomaly)) {
            llm.false_negative_insight = "";
          }

          narrative = llm.executive_summary || llm.summary || narrative;
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