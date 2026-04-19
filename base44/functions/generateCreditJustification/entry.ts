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

        const strategyAngles = {
            cash_flow_alignment: 'זווית תזרימית — מה בנתוני התזרים של הלקוח (יציבות הכנסה, מרווח חודשי, קצב הוצאות) הופך דווקא אותו למתאים למסלול הזה',
            exposure_reduction: 'זווית חשיפתית — מה בפרופיל הסיכון של הלקוח (יחס חוב, נזילות, רמת מינוף) הופך דווקא אותו למתאים להקטנת חשיפה',
            behavioral_approval: 'זווית התנהגותית — מה בדפוסי ההתנהלות של הלקוח (עקביות בתשלומים, יציבות, משמעת פיננסית) הופך דווקא אותו למתאים לאישור על סמך התנהגות'
        };

        const statusLabels = {
            approved: 'אושר במסגרת מדיניות האשראי',
            conditional: 'אושר בתנאי (חריגה קלה שדורשת שיקול דעת)',
            failed: 'לא עובר את סף המדיניות'
        };

        const prompt = `אתה אנליסט אשראי בכיר. כתוב נימוק אשראי קצר (2-3 משפטים) בעברית, שמסביר למה **הלקוח הספציפי הזה** עובר דרך הגישה הזו — לפי הסיפור האישי שלו מהנתונים.

מצב מקורי של הבקשה: ${originalStatus || 'לא ידוע'}
סטטוס לאחר חילוץ: ${statusLabels[strategy.status] || strategy.status}

זווית הניתוח: ${strategyAngles[strategy.type] || strategy.type}

נתוני הלקוח (השתמש רק במה שרלוונטי לזווית):
${analysisInsights?.metrics?.liquidity_buffer_months != null ? '- נזילות זמינה: ' + Number(analysisInsights.metrics.liquidity_buffer_months).toFixed(1) + ' חודשים' : ''}
${analysisInsights?.metrics?.structural_dti != null ? '- DTI מבני: ' + analysisInsights.metrics.structural_dti + '%' : ''}
${analysisInsights?.metrics?.adjusted_dti != null ? '- DTI מתואם: ' + analysisInsights.metrics.adjusted_dti + '%' : ''}
${analysisInsights?.metrics?.income_volatility != null ? '- תנודתיות הכנסה: ' + analysisInsights.metrics.income_volatility + '%' : ''}
${analysisInsights?.risk_tier ? '- רמת סיכון: ' + analysisInsights.risk_tier : ''}
${analysisInsights?.behavioral_classification ? '- סיווג התנהגותי: ' + analysisInsights.behavioral_classification : ''}
${analysisInsights?.classification_reason ? '- הסבר סיווג: ' + analysisInsights.classification_reason : ''}
${analysisInsights?.risk_flags?.length ? '- דגלי סיכון: ' + analysisInsights.risk_flags.join('; ') : '- אין דגלי סיכון פעילים'}

DSR חדש לאחר החילוץ: ${strategy.dsr}% (סף מדיניות: 40%)

הנחיות קריטיות לכתיבה:
1. **כתוב בעברית תקנית בלבד**. אסור בהחלט להשתמש באותיות או מילים בשפות אחרות (רוסית, אנגלית, וכו'). אם יש שם של דגל סיכון בשפה זרה — תרגם אותו לעברית במלואו.
2. **אסור** להסביר מה הגישה עושה באופן כללי (לא "הפריסה הארוכה יותר מפחיתה עומס"). זה כבר ברור.
3. **חובה** להסביר מה בנתונים האישיים של הלקוח הזה גורם לו לעבור דווקא דרך הזווית הזו. למשל: "הנזילות של 2.3 חודשים והמגמה היציבה בהכנסות הן מה שמצדיקים לקבל את הסיכון התזרימי הזה", או "שיעור החיסכון של 18% והיעדר דגלי סיכון הם מה שבונים את האמון ההתנהגותי".
4. כל נימוק חייב להיות שונה לחלוטין מהאחרים — לא אותה מוזיקה בווריאציות שונות.
5. שפה עסקית־אנושית, לא טכנית, לא פורמלית יתר על המידה.
6. אל תחזור על המספרים מהטבלה (סכום, תקופה, החזר, ריבית, מקדמה).
7. עד 3 משפטים. ללא כותרות וללא רשימות.`;

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