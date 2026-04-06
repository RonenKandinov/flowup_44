import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { strategies, context } = body;

    const income = Math.round(context?.avgIncome || 0);
    const expenses = Math.round(context?.avgFixedExpenses || 0);
    const liquidity = Math.round(context?.liquidAssets || 0);
    const net = income - expenses;

    // 🚨 GUARD — אם הלקוח בגרעון
    if (net <= 0) {
      return Response.json({
        success: true,
        logic: {
          cash_flow: {
            bullets: [
              `הכנסה ${income}₪ נמוכה מהוצאות ${expenses}₪ ולכן אין עודף תזרימי`,
              `יכולת החזר אינה מספקת לתשלום חודשי נוסף`,
              `נדרש שינוי מבנה מהותי או דחייה`
            ]
          },
          exposure: {
            bullets: [
              `פער שלילי של ${net}₪ מצביע על סיכון גבוה`,
              `ללא כרית תזרימית אין יכולת לספוג התחייבות`,
              `העסקה אינה עומדת בקריטריוני חיתום`
            ]
          },
          behavioral: {
            bullets: [
              `התנהגות תזרימית שלילית לאורך זמן`,
              `אין בסיס לאישור ללא שיפור הכנסה או הפחתת הוצאות`,
              `המלצה: דחייה או התאמה מחדש`
            ]
          }
        }
      });
    }

    const prompt = `CRITICAL INSTRUCTION:
You are a senior credit underwriter making a FINAL approval decision.

You must justify why THIS specific customer can repay the loan.

STRICT RULES:
- Each bullet MUST include numbers
- MUST refer to income, expenses, and monthly payment
- MUST explain repayment ability
- NO generic statements

Customer Data:
- Monthly Income: ${income} ILS
- Fixed Expenses: ${expenses} ILS
- Liquid Assets: ${liquidity} ILS
- Net Free Income: ${net} ILS

Strategies:

Cash Flow:
- Term: ${strategies?.cash_flow?.metrics?.term || 0} months
- Monthly Payment: ${Math.round(strategies?.cash_flow?.metrics?.pmt || 0)} ILS
- DTI: ${Math.round(strategies?.cash_flow?.metrics?.dti || 0)}%
- LTV: ${Math.round(strategies?.cash_flow?.metrics?.ltv || 0)}%

Exposure:
- Term: ${strategies?.exposure?.metrics?.term || 0} months
- Monthly Payment: ${Math.round(strategies?.exposure?.metrics?.pmt || 0)} ILS
- DTI: ${Math.round(strategies?.exposure?.metrics?.dti || 0)}%
- LTV: ${Math.round(strategies?.exposure?.metrics?.ltv || 0)}%

Behavioral:
- Term: ${strategies?.behavioral?.metrics?.term || 0} months
- Monthly Payment: ${Math.round(strategies?.behavioral?.metrics?.pmt || 0)} ILS
- DTI: ${Math.round(strategies?.behavioral?.metrics?.dti || 0)}%
- LTV: ${Math.round(strategies?.behavioral?.metrics?.ltv || 0)}%

OUTPUT (STRICT JSON):
{
  "cash_flow": { "bullets": ["...", "...", "..."] },
  "exposure": { "bullets": ["...", "...", "..."] },
  "behavioral": { "bullets": ["...", "...", "..."] }
}`;

    const llmRes = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: "gpt_5_mini",
      response_json_schema: {
        type: "object",
        properties: {
          cash_flow: {
            type: "object",
            properties: {
              bullets: { type: "array", items: { type: "string" } }
            }
          },
          exposure: {
            type: "object",
            properties: {
              bullets: { type: "array", items: { type: "string" } }
            }
          },
          behavioral: {
            type: "object",
            properties: {
              bullets: { type: "array", items: { type: "string" } }
            }
          }
        },
        required: ["cash_flow", "exposure", "behavioral"]
      }
    });

    return Response.json({
      success: true,
      logic: llmRes
    });

  } catch (e) {
    console.error("DealRescuerAI Error:", e);
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
});