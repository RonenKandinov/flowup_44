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

        // Resolve DSR policy threshold in PARALLEL with the LLM calls (don't block them)
        const thresholdPromise = (async () => {
            let t = Number(policyThreshold);
            if (Number.isFinite(t) && t > 0) return t;
            try {
                const rules = await base44.asServiceRole.entities.UnderwritingRule.list();
                const max = Number(rules?.[0]?.max_dti_approve);
                if (Number.isFinite(max) && max > 0 && max < 100) return max;
            } catch (e) { /* fall through */ }
            return 40;
        })();

        const angle = {
            cash_flow_alignment: 'תזרימית (יציבות הכנסה, מרווח חודשי)',
            exposure_reduction: 'חשיפתית (יחס חוב, נזילות, מינוף)',
            behavioral_approval: 'התנהגותית (עקביות, משמעת פיננסית)'
        };

        // Build a COMPACT client profile once — same across all 3 strategies, shorter prompt = faster response
        const m = analysisInsights?.metrics || {};
        const profileLines = [
            m.liquidity_buffer_months != null && `נזילות ${Number(m.liquidity_buffer_months).toFixed(1)} ח׳`,
            m.structural_dti != null && `DTI מבני ${m.structural_dti}%`,
            m.adjusted_dti != null && `DTI מתואם ${m.adjusted_dti}%`,
            m.income_volatility != null && `תנודתיות הכנסה ${m.income_volatility}%`,
            analysisInsights?.risk_tier && `סיכון: ${analysisInsights.risk_tier}`,
            analysisInsights?.behavioral_classification && `התנהגות: ${analysisInsights.behavioral_classification}`,
            analysisInsights?.risk_flags?.length ? `דגלים: ${analysisInsights.risk_flags.slice(0, 3).join(', ')}` : null
        ].filter(Boolean).join(' | ');

        const threshold = await thresholdPromise;

        // Short, focused prompt — compact but emphasizes Hebrew-only + human storytelling.
        const buildPrompt = (s) => `אתה אנליסט אשראי בכיר. כתוב נימוק חי ואישי (2-3 משפטים) שמסביר למה **ללקוח הזה ספציפית** מתאים המסלול הזה — כאילו אתה מציג לוועדת אשראי מדוע הבקשה שלו עוברת.

זווית הניתוח: ${angle[s.type] || s.type}.
פרופיל הלקוח: ${profileLines || 'סטנדרטי'}.
סטטוס לאחר חילוץ: ${s.status}. DSR חדש ${s.dsr}% (סף מדיניות ${threshold}%).

חוקים מחייבים:
1. **כתוב בעברית בלבד**. אסור לחלוטין להשתמש במילים, ביטויים או מונחים באנגלית או בכל שפה אחרת. כל מונח מקצועי — תרגם לעברית (למשל "Payment History" → "היסטוריית תשלומים", "DTI" ניתן להשאיר כראשי תיבות).
2. דבר על הלקוח כאדם, לא כמקרה — "הלקוח הוכיח...", "ההתנהלות שלו מעידה...".
3. חבר בין נתון ספציפי בפרופיל לבין הסיבה שדווקא המסלול הזה מתאים לו.
4. אל תחזור על המספרים מהטבלה (סכום, תקופה, החזר, ריבית, מקדמה).
5. אל תסביר מה המסלול עושה באופן כללי — רק למה הוא מתאים ללקוח הזה.
6. כל נימוק חייב להיות שונה מהאחרים בזווית ובסיפור.
7. ללא כותרות, ללא רשימות, טקסט רץ בלבד.`;

        // Run all LLM calls in parallel — total latency ≈ slowest single call.
        // Using default model (gpt_5_mini) — empirically ~3-4× faster than gemini_3_flash
        // on short Hebrew generations, and we don't need web context here.
        const results = await Promise.all(list.map(async (s) => {
            const t0 = Date.now();
            try {
                const response = await base44.integrations.Core.InvokeLLM({
                    prompt: buildPrompt(s)
                });
                console.log(`LLM ${s.type}: ${Date.now() - t0}ms`);
                return typeof response === 'string' ? response.trim() : String(response).trim();
            } catch (e) {
                console.error(`LLM ${s.type} failed after ${Date.now() - t0}ms:`, e?.message);
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