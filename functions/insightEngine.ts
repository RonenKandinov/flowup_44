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
    if (!user) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

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

    const neg = expInc > 100;
    const lowLiq = liq < 1;
    const highDti = dti > 45;
    const badTrend = behavior === "DETERIORATING";

    // ===== Behavior Override (קריטי) =====
    if (behavior === "DETERIORATING") {
      if (liq < 2 || signals.netFlowTrend === "DOWN") {
        risk = "Orange";
      }
      if (liq < 1.5 && signals.netFlowTrend === "DOWN") {
        risk = "Red";
      }
    }

    if (neg && badTrend) risk = "Red";

    // ===== Strengths =====
    const strengths = [];
    if (behavior === "IMPROVING") strengths.push("מגמת שיפור עקבית");
    if (liq > 3) strengths.push("נזילות גבוהה");
    if (expInc < 90) strengths.push("שליטה בהוצאות");
    if (signals.netFlowTrend === "UP") strengths.push("תזרים מזומנים במגמת עלייה");

    // ===== Risks =====
    const risks = [];
    if (neg) risks.push("תזרים שלילי");
    if (lowLiq) risks.push("נזילות נמוכה");
    if (highDti) risks.push("יחס חוב להכנסה גבוה");
    if (badTrend) risks.push("מגמת הידרדרות");

    if (risks.length === 0) {
      if (dti > 35) risks.push("יחס חוב להכנסה גבולי");
      if (income < 10000) risks.push("רמת הכנסה נמוכה יחסית");
    }

    // ===== Fixes =====
    const fixes = [];
    if (neg) fixes.push("הקטנת הוצאות מתחת להכנסה");
    if (lowLiq) fixes.push("הגדלת נזילות ללפחות 3 חודשים");
    if (highDti) fixes.push("הפחתת התחייבויות");
    if (badTrend) fixes.push("ייצוב תזרים");

    if (fixes.length === 0) {
      if (dti > 35) fixes.push("הפחתת יחס חוב להכנסה מתחת ל־35%");
      if (income < 10000) fixes.push("הגדלת הכנסה חודשית");
    }

    // ===== Second Chance =====
    let secondChanceScore = 0;
    if (behavior === "IMPROVING") secondChanceScore += 2;
    if (liq > 4) secondChanceScore += 2;
    if (expInc < 85) secondChanceScore += 1;
    if (signals.netFlowTrend === "UP") secondChanceScore += 1;

    const isSecondChance = (risk === "Orange" || risk === "Red") && secondChanceScore >= 4;

    // ===== Recommendation =====
    let rec = "APPROVE", conf = "HIGH";

    if (risk === "Red" && !isSecondChance) {
      rec = "DECLINE";
      conf = "HIGH";
    } else if (neg || lowLiq || highDti || badTrend) {
      rec = isSecondChance ? "APPROVE" : "REVIEW";
      conf = isSecondChance ? "MEDIUM" : "MEDIUM";
    }

    // ===== Pricing =====
    let approveAmount = Math.round(income * 6);
    let approveInterest = 8;

    if (risk === "Orange") approveInterest += 1;
    if (risk === "Red") {
      approveInterest += 2;
      approveAmount *= 0.7;
    }

    if (behavior === "DETERIORATING") {
      approveAmount *= 0.7;
      approveInterest += 1;
    }

    if (isSecondChance) {
      approveInterest += 1.5;
      approveAmount *= 0.8;
    }

    const options = [
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

    // ===== Narrative =====
    const prompt = `
אתה אנליסט אשראי.
כתוב בעברית בלבד.

נתונים:
${JSON.stringify({ income, expenses, signals, trends })}

נתח את המצב בלבד (בלי לקבוע החלטה).
`;

    let narrative = "מצב פיננסי בינוני עם סיכון מסוים.";
    try {
      const llm = base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: { narrative: { type: "string" } },
          required: ["narrative"]
        }
      });
      const timeout = new Promise((_, r) => setTimeout(() => r(new Error()), 5000));
      const res = await Promise.race([llm, timeout]);
      if (res?.narrative) narrative = res.narrative;
    } catch {}

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
        analyst_recommendation: {
          recommendation: { decision: rec, confidence: conf },
          options,
          key_risks: risks,
          strengths,
          what_to_improve: fixes
        }
      }
    });

  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}));