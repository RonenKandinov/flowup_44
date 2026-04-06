import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { strategies, context, isRejected } = body;

    const income = Math.round(context?.avgIncome || 0);
    const expenses = Math.round(context?.avgFixedExpenses || 0);
    const liquidity = Math.round(context?.liquidAssets || 0);
    const liquidityMonths = context?.liquidityMonths ? Math.round(context.liquidityMonths * 10) / 10 : 0;
    const net = income - expenses;

    if (isRejected || net <= 0) {
        return Response.json({
            success: true,
            logic: {
                rejected: {
                    bullets: [
                        `DSR צפוי לחצות את רף ה-100% או שההכנסה (${income}₪) נמוכה מההוצאות (${expenses}₪).`,
                        `נזילות עומדת על ${liquidityMonths} חודשים, מתחת לרף המינימלי הנדרש של 2 חודשים.`,
                        `אין עודף תזרימי חיובי המאפשר עמידה בהחזרים נוספים (העודף עומד על ${net}₪ בלבד לפני ההלוואה).`
                    ]
                }
            }
        });
    }

    const prompt = `CRITICAL INSTRUCTION:

    ענה אך ורק בעברית. אל תשתמש באנגלית בכלל.

    אתה אנליסט אשראי בכיר בבנק שמקבל החלטת אישור סופית.
    השתמש אך ורק במספרים שסופקו להלן, אל תמציא חישובים. אל תכתוב משפטים כלליים כמו "יציבות תזרימית". 
    הסבר למה ההלוואה מאושרת בהתבסס על DSR, נזילות בחודשים, ותזרים פנוי (Cash Flow).

    נתוני לקוח:
    - הכנסה חודשית: ${income} ₪
    - הוצאות קבועות: ${expenses} ₪
    - נזילות כוללת: ${liquidity} ₪ (${liquidityMonths} חודשי כיסוי)
    - עודף חודשי פנוי (לפני הלוואה): ${net} ₪

    אסטרטגיות (לכל אחת, ספק 3 נקודות קצרות המנמקות את הבחירה):

    1. Cash Flow
    - תשלום חודשי צפוי: ${Math.round(strategies?.cash_flow?.metrics?.pmt || 0)} ₪
    - DSR (יחס שירות חוב): ${Math.round(strategies?.cash_flow?.metrics?.dsr || 0)}%
    - תזרים פנוי נותר: ${Math.round(strategies?.cash_flow?.metrics?.freeCashFlow || 0)} ₪

    2. Exposure
    - תשלום חודשי צפוי: ${Math.round(strategies?.exposure?.metrics?.pmt || 0)} ₪
    - DSR (יחס שירות חוב): ${Math.round(strategies?.exposure?.metrics?.dsr || 0)}%
    - תזרים פנוי נותר: ${Math.round(strategies?.exposure?.metrics?.freeCashFlow || 0)} ₪

    3. Behavioral
    - תשלום חודשי צפוי: ${Math.round(strategies?.behavioral?.metrics?.pmt || 0)} ₪
    - DSR (יחס שירות חוב): ${Math.round(strategies?.behavioral?.metrics?.dsr || 0)}%
    - תזרים פנוי נותר: ${Math.round(strategies?.behavioral?.metrics?.freeCashFlow || 0)} ₪

    פורמט חובה:
    {
    "cash_flow": { "bullets": ["נקודה מבוססת מספרים...", "...", "..."] },
    "exposure": { "bullets": ["נקודה מבוססת מספרים...", "...", "..."] },
    "behavioral": { "bullets": ["נקודה מבוססת מספרים...", "...", "..."] }
    }
    `;
   

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