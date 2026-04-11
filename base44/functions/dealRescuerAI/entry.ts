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

    const prompt = `הוראה קריטית:

    ענה אך ורק בעברית.
    אל תכתוב אנגלית, ערבית או מונחים לועזיים מיותרים.
    אתה אנליסט אשראי בכיר שמנמק החלטת אישור על בסיס מספרים בלבד.
    השתמש אך ורק בנתונים שסופקו, אל תמציא חישובים ואל תכתוב ניסוחים כלליים.
    בכל אסטרטגיה הדגש במפורש את הריבית, המקדמה, ההחזר החודשי, ה-DSR והתזרים הפנוי.

    נתוני לקוח:
    - הכנסה חודשית: ${income} ₪
    - הוצאות קבועות: ${expenses} ₪
    - נזילות כוללת: ${liquidity} ₪ (${liquidityMonths} חודשי כיסוי)
    - עודף חודשי פנוי לפני הלוואה: ${net} ₪

    אסטרטגיה 1 - התאמת החזר:
    - מקדמה: ${Math.round(strategies?.cash_flow?.metrics?.downPayment || 0)} ₪
    - ריבית שנתית: ${(((strategies?.cash_flow?.metrics?.rate || 0) * 100).toFixed(1))}%
    - תשלום חודשי: ${Math.round(strategies?.cash_flow?.metrics?.pmt || 0)} ₪
    - DSR: ${Math.round(strategies?.cash_flow?.metrics?.dsr || 0)}%
    - תזרים פנוי נותר: ${Math.round(strategies?.cash_flow?.metrics?.freeCashFlow || 0)} ₪

    אסטרטגיה 2 - הפחתת חשיפה:
    - מקדמה: ${Math.round(strategies?.exposure?.metrics?.downPayment || 0)} ₪
    - ריבית שנתית: ${(((strategies?.exposure?.metrics?.rate || 0) * 100).toFixed(1))}%
    - תשלום חודשי: ${Math.round(strategies?.exposure?.metrics?.pmt || 0)} ₪
    - DSR: ${Math.round(strategies?.exposure?.metrics?.dsr || 0)}%
    - תזרים פנוי נותר: ${Math.round(strategies?.exposure?.metrics?.freeCashFlow || 0)} ₪

    אסטרטגיה 3 - מסלול אופטימלי:
    - מקדמה: ${Math.round(strategies?.behavioral?.metrics?.downPayment || 0)} ₪
    - ריבית שנתית: ${(((strategies?.behavioral?.metrics?.rate || 0) * 100).toFixed(1))}%
    - תשלום חודשי: ${Math.round(strategies?.behavioral?.metrics?.pmt || 0)} ₪
    - DSR: ${Math.round(strategies?.behavioral?.metrics?.dsr || 0)}%
    - תזרים פנוי נותר: ${Math.round(strategies?.behavioral?.metrics?.freeCashFlow || 0)} ₪

    פורמט חובה:
    {
      "cash_flow": { "bullets": ["...", "...", "..."] },
      "exposure": { "bullets": ["...", "...", "..."] },
      "behavioral": { "bullets": ["...", "...", "..."] }
    }
    `;
   

    const llmRes = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: "gemini_3_flash",
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