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
    totalFixedExpenses: z.number().optional(),
    fixedExpenses: z.number().optional(),
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

    let risk = score < 55 ? "Red" : score < 80 ? "Orange" : "Green";

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

    if ((neg && badTrend) || (lowLiq && badTrend)) risk = "Red";

    let rec = "APPROVE", conf = "HIGH";
    if (risk === "Red") rec = "DECLINE";
    else if (neg || lowLiq || highDti || badTrend) { rec = "REVIEW"; conf = "MEDIUM"; }

    const options = [
      { decision: "APPROVE", max_loan_amount: Math.round(income * 10), suggested_interest: 6 },
      { decision: "REVIEW", max_loan_amount: Math.round(income * 5), suggested_interest: 10 },
      { decision: "DECLINE", max_loan_amount: 0, suggested_interest: null }
    ];

    const risks = [];
    if (neg) risks.push("תזרים שלילי");
    if (lowLiq) risks.push("נזילות נמוכה");
    if (highDti) risks.push("יחס חוב להכנסה גבוה");
    if (badTrend) risks.push("מגמת הידרדרות");

    const fixes = [];
    if (neg) fixes.push("הקטנת הוצאות מתחת להכנסה");
    if (lowLiq) fixes.push("הגדלת נזילות ללפחות 3 חודשים");
    if (highDti) fixes.push("הפחתת התחייבויות");
    if (badTrend) fixes.push("ייצוב תזרים");

    const prompt = `
אתה אנליסט אשראי.
כתוב בעברית בלבד.

נתונים:
${JSON.stringify({ income, expenses, signals, trends })}

נתח את המצב בלבד (בלי לקבוע החלטה).
`;

    let narrative = "ניכרת מגמת הידרדרות בתזרים ועלייה בהוצאות.";
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
        analyst_recommendation: {
          recommendation: { decision: rec, confidence: conf },
          options,
          key_risks: risks,
          what_to_improve: fixes
        }
      }
    });

  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}));