import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Generates short, human-friendly credit justifications for rescue strategies.
// Supports two modes:
//   1. Single strategy: { strategy, analysisInsights, originalStatus, policyThreshold }
//      → returns { success, justification }
//   2. Batch (faster): { strategies: [...], analysisInsights, originalStatus, policyThreshold }
//      → returns { success, justifications: [string, ...] } — parallelized LLM calls
//
// Uses gemini_3_flash (fastest model) so analysts don't wait 3× serial LLM round-trips.
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { strategy, strategies, analysisInsights, originalStatus, policyThreshold } = body;

        const list = Array.isArray(strategies) && strategies.length > 0
            ? strategies
            : (strategy ? [strategy] : null);

        if (!list) {
            return Response.json({ error: 'Missing strategy/strategies' }, { status: 400 });
        }

        // Resolve DSR policy threshold once (shared across all strategies)
        let threshold = Number(policyThreshold);
        if (!Number.isFinite(threshold) || threshold <= 0) {
            try {
                const rules = await base44.asServiceRole.entities.UnderwritingRule.list();
                const max = Number(rules?.[0]?.max_dti_approve);
                if (Number.isFinite(max) && max > 0 && max < 100) threshold = max;
            } catch (e) { /* fall through to default */ }
        }
        if (!Number.isFinite(threshold) || threshold <= 0) threshold = 40;

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

        const buildPrompt = (s) => `אתה אנליסט אשראי בכיר. כתוב נימוק אשראי קצר (2-3 משפטים) בעברית, שמסביר למה **הלקוח הספציפי הזה** עובר דרך הגישה הזו — לפי הסיפור האישי שלו מהנתונים.

מצב מקורי של הבקשה: ${originalStatus || 'לא ידוע'}
סטטוס לאחר חילוץ: ${statusLabels[s.status] || s.status}

זווית הניתוח: ${strategyAngles[s.type] || s.type}

נתוני הלקוח (השתמש רק במה שרלוונטי לזווית):
${analysisInsights?.metrics?.liquidity_buffer_months != null ? '- נזילות זמינה: ' + Number(analysisInsights.metrics.liquidity_buffer_months).toFixed(1) + ' חודשים' : ''}
${analysisInsights?.metrics?.structural_dti != null ? '- DTI מבני: ' + analysisInsights.metrics.structural_dti + '%' : ''}
${analysisInsights?.metrics?.adjusted_dti != null ? '- DTI מתואם: ' + analysisInsights.metrics.adjusted_dti + '%' : ''}
${analysisInsights?.metrics?.income_volatility != null ? '- תנודתיות הכנסה: ' + analysisInsights.metrics.income_volatility + '%' : ''}
${analysisInsights?.risk_tier ? '- רמת סיכון: ' + analysisInsights.risk_tier : ''}
${analysisInsights?.behavioral_classification ? '- סיווג התנהגותי: ' + analysisInsights.behavioral_classification : ''}
${analysisInsights?.classification_reason ? '- הסבר סיווג: ' + analysisInsights.classification_reason : ''}
${analysisInsights?.risk_flags?.length ? '- דגלי סיכון: ' + analysisInsights.risk_flags.join('; ') : '- אין דגלי סיכון פעילים'}

DSR חדש לאחר החילוץ: ${s.dsr}% (סף מדיניות: ${threshold}%)

הנחיות קריטיות לכתיבה:
1. **כתוב בעברית תקנית בלבד**. אסור בהחלט להשתמש באותיות או מילים בשפות אחרות (רוסית, אנגלית, וכו'). אם יש שם של דגל סיכון בשפה זרה — תרגם אותו לעברית במלואו.
2. **אסור** להסביר מה הגישה עושה באופן כללי (לא "הפריסה הארוכה יותר מפחיתה עומס"). זה כבר ברור.
3. **חובה** להסביר מה בנתונים האישיים של הלקוח הזה גורם לו לעבור דווקא דרך הזווית הזו.
4. כל נימוק חייב להיות שונה לחלוטין מהאחרים — לא אותה מוזיקה בווריאציות שונות.
5. שפה עסקית־אנושית, לא טכנית, לא פורמלית יתר על המידה.
6. אל תחזור על המספרים מהטבלה (סכום, תקופה, החזר, ריבית, מקדמה).
7. עד 3 משפטים. ללא כותרות וללא רשימות.`;

        // Run all LLM calls in parallel — this is the key latency win
        const results = await Promise.all(list.map(async (s) => {
            try {
                const response = await base44.integrations.Core.InvokeLLM({
                    prompt: buildPrompt(s),
                    model: 'gemini_3_flash'
                });
                return typeof response === 'string' ? response.trim() : String(response).trim();
            } catch (e) {
                console.error('LLM call failed for strategy:', s?.type, e?.message);
                return null;
            }
        }));

        // Backwards-compatible response shape
        if (strategies) {
            return Response.json({ success: true, justifications: results });
        }
        return Response.json({ success: true, justification: results[0] });
    } catch (error) {
        console.error('generateCreditJustification error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});