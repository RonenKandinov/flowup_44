import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Generates a short, human-friendly credit justification per rescue strategy.
// Uses a fast LLM model (gpt_5_mini) so the analyst doesn't wait.
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { strategy, analysisInsights, originalStatus } = await req.json();
        if (!strategy) {
            return Response.json({ error: 'Missing strategy' }, { status: 400 });
        }

        const strategyLabels = {
            cash_flow_alignment: 'התאמת תזרים (פריסה ארוכה יותר להקטנת החזר חודשי)',
            exposure_reduction: 'הפחתת חשיפה (סכום נמוך יותר או מקדמה גדולה יותר)',
            behavioral_approval: 'אישור מבוסס התנהגות פיננסית יציבה'
        };

        const statusLabels = {
            approved: 'אושר במסגרת מדיניות האשראי',
            conditional: 'אושר בתנאי (חריגה קלה שדורשת שיקול דעת)',
            failed: 'לא עובר את סף המדיניות'
        };

        const prompt = `אתה אנליסט אשראי בכיר. כתוב נימוק אשראי קצר (2-3 משפטים) בעברית, בשפה עסקית-אנושית (לא טכנית מדי), שמסביר מדוע אסטרטגיית החילוץ הספציפית הזו הגיונית ללקוח.

מצב מקורי של הבקשה: ${originalStatus || 'לא ידוע'}

אסטרטגיית חילוץ: ${strategyLabels[strategy.type] || strategy.type}
סטטוס לאחר חילוץ: ${statusLabels[strategy.status] || strategy.status}

פרטי המבנה המוצע:
- סכום הלוואה: ₪${Number(strategy.loanAmount || 0).toLocaleString('he-IL')}
- תקופה: ${strategy.termMonths} חודשים
- החזר חודשי: ₪${Number(strategy.monthlyPayment || 0).toLocaleString('he-IL')}
- ריבית: ${strategy.interestRate}%
- מקדמה: ${strategy.downPayment > 0 ? '₪' + Number(strategy.downPayment).toLocaleString('he-IL') : 'אין'}
- DSR חדש: ${strategy.dsr}% (סף מדיניות: 40%)

תובנות נוספות על הלקוח:
${analysisInsights?.liquidityMonths ? '- נזילות זמינה: ' + Number(analysisInsights.liquidityMonths).toFixed(1) + ' חודשים' : ''}
${analysisInsights?.incomeTrend ? '- מגמת הכנסה: ' + analysisInsights.incomeTrend : ''}
${analysisInsights?.riskTier ? '- רמת סיכון: ' + analysisInsights.riskTier : ''}

הנחיות לכתיבה:
1. התייחס ספציפית לאסטרטגיה (למשל "הפריסה הארוכה יותר" להתאמת תזרים, או "הקטנת הסכום והמקדמה" להפחתת חשיפה).
2. הסבר מה זה נותן ללקוח במונחים אנושיים, לא רק מספרים.
3. אם זה אישור מותנה — הסבר בקצרה למה זה עדיין הגיוני.
4. השתמש בטון עסקי אך נגיש, לא פורמלי מדי ולא טכני מדי.
5. אל תחזור על המספרים שכבר מוצגים בטבלה למעלה — התמקד ב"למה" זה עובד.
6. עד 3 משפטים. ללא רשימות או כותרות.`;

        const response = await base44.integrations.Core.InvokeLLM({
            prompt,
            model: 'gpt_5_mini'
        });

        const justification = typeof response === 'string' ? response.trim() : String(response).trim();

        return Response.json({ success: true, justification });
    } catch (error) {
        console.error('generateCreditJustification error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});