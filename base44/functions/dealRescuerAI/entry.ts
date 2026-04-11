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
                    analysis: `מבחינה חיתומית, לא ניתן להמליץ על מבנה חלופי לעסקה זו בשלב הנוכחי. יחס השירות הצפוי חוצה את רף הסיכון, ההכנסה החודשית עומדת על ${income}₪ מול הוצאות קבועות של ${expenses}₪, והעודף הפנוי לפני הלוואה הוא ${net}₪ בלבד. בנוסף, כרית הנזילות עומדת על ${liquidityMonths} חודשי כיסוי, מתחת לרף המינימלי של 2 חודשים. בנסיבות אלה, ההמלצה המקצועית היא להימנע מאישור עד לחיזוק תזרים או הגדלת כרית נזילות.`
                }
            }
        });
    }

    const prompt = `הוראה קריטית:

    ענה אך ורק בעברית.
    כתוב כמו אנליסט אשראי בכיר או חתם בכיר שנותן נימוק מקצועי להחלטה.
    אל תכתוב בולטים, אל תכתוב תקציר שטחי, ואל תשתמש בשפה שיווקית.
    השתמש אך ורק בנתונים שסופקו כאן.
    בכל מסלול כתוב פסקה אחת ברורה ומשכנעת שמסבירה למה המסלול נבחר, מה היתרון החיתומי שלו, ומה הוויתור שבו.
    חובה להתייחס במפורש לנזילות בחודשים, למקדמה, לריבית, להחזר החודשי, ל-DSR ולתזרים הפנוי לאחר ההלוואה.
    אם אתה מזכיר נזילות, השתמש בדיוק במספר ${liquidityMonths} חודשי כיסוי ואל תחשב ערך אחר.

    נתוני לקוח:
    - הכנסה חודשית: ${income} ₪
    - הוצאות קבועות: ${expenses} ₪
    - נזילות כוללת: ${liquidity} ₪
    - נזילות בחודשים: ${liquidityMonths}
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
      "cash_flow": { "analysis": "פסקה אחת מלאה" },
      "exposure": { "analysis": "פסקה אחת מלאה" },
      "behavioral": { "analysis": "פסקה אחת מלאה" }
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
              analysis: { type: "string" }
            }
          },
          exposure: {
            type: "object",
            properties: {
              analysis: { type: "string" }
            }
          },
          behavioral: {
            type: "object",
            properties: {
              analysis: { type: "string" }
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