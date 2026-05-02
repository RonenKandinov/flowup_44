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

        // Soft auth: we want to know who's calling (audit + future personalization),
        // but we MUST NOT 401 the request. In production we observed auth.me() failing
        // on the public B2B-Connect domain because the session cookie doesn't always
        // propagate cross-origin — that 401 caused the UI to render
        // "נימוק אשראי לא זמין". When auth fails we mark the request as unauthenticated
        // and serve static Hebrew fallback justifications instead.
        let isAuthenticated = false;
        try {
            const user = await base44.auth.me();
            isAuthenticated = !!user;
        } catch (authErr) {
            console.warn('generateCreditJustification: auth.me() failed, will use static fallback.', authErr?.message);
        }

        const body = await req.json();
        const { strategy, strategies, analysisInsights, originalStatus, policyThreshold, xaiFactors } = body;

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

        // Compress XAI factors (from dealRescuerEngine) into compact prompt-ready strings.
        // These are the SAME factors surfaced in the XAIFactorsPanel — passing them to the
        // LLM ensures the Hebrew justification is consistent with what the analyst sees on screen.
        const positiveFactors = Array.isArray(xaiFactors?.positive)
            ? xaiFactors.positive.map(f => f.label).filter(Boolean).slice(0, 4).join(', ')
            : '';
        const negativeFactors = Array.isArray(xaiFactors?.negative)
            ? xaiFactors.negative.map(f => f.label).filter(Boolean).slice(0, 4).join(', ')
            : '';

        // Strict Hebrew-only prompt. We explicitly forbid foreign words, transliterations,
        // and acronym expansions (e.g. LLM expanding "DSR" to "Digital Sustainable Ratio")
        // because in production gpt_5_mini occasionally mixes English/Arabic into Hebrew output.
        const buildPrompt = (s) => `אתה חתם אשראי ישראלי. כתוב נימוק קצר בעברית תקנית בלבד.

חוקים מוחלטים:
- עברית בלבד. אסור בהחלט להשתמש במילים באנגלית, ערבית או כל שפה אחרת.
- אסור להרחיב ראשי תיבות (לדוגמה: לכתוב "DSR" ולא "Debt Service Ratio").
- 2 משפטים בלבד. ללא כותרות, ללא רשימות, ללא מספרים מהטבלה.
- שפה מקצועית, ברורה וזורמת — כפי שחתם בנקאי היה כותב.

זווית הניתוח: ${angle[s.type] || s.type}.
פרופיל הלקוח: ${profileLines || 'סטנדרטי'}.
תוצאה: ${s.status}. יחס החזר חדש ${s.dsr}% מתוך סף ${threshold}%.
${positiveFactors ? `חוזקות שזוהו: ${positiveFactors}.` : ''}
${negativeFactors ? `סיכונים שזוהו: ${negativeFactors}.` : ''}

הסבר מה בפרופיל הספציפי של הלקוח מצדיק את הזווית הזו, באופן שונה משתי הזוויות האחרות. שלב במשפט הראשון לפחות חוזקה אחת או סיכון אחד מהרשימה למעלה (אם קיימים) — כך שהנימוק יתחבר לגורמי ההחלטה שמוצגים ללקוח.`;

        // Detect non-Hebrew contamination (Latin or Arabic letters). Hebrew-only justifications
        // may contain digits, punctuation and the % sign, but no foreign-script words.
        const isContaminated = (text) => {
            if (!text) return true;
            // Reject if text contains Arabic letters (U+0600–U+06FF)
            if (/[\u0600-\u06FF]/.test(text)) return true;
            // Reject if text contains Latin letters forming a word (>=2 in a row).
            // Single letters are tolerated only if not present at all is preferred — be strict.
            if (/[A-Za-z]{2,}/.test(text)) return true;
            return false;
        };

        // Static fallback per strategy type — guarantees the analyst always sees a meaningful
        // explanation even if the LLM is slow / errors / rate-limited in production.
        const fallbackText = {
            cash_flow_alignment: 'המסלול הותאם לתזרים החודשי של הלקוח: גובה ההחזר נשאר במרווח בטוח ביחס להכנסה הפנויה, מה שמבטיח עמידה שוטפת בתשלומים גם בחודשים חלשים.',
            exposure_reduction: 'המסלול מקטין את החשיפה הכוללת של הלקוח: יחס ההחזר לחוב יורד מתחת לסף המדיניות ומותיר כרית נזילות מספקת לשירות החוב לאורך זמן.',
            behavioral_approval: 'אישור מבוסס התנהגות פיננסית עקבית: למרות יחס החזר גבוה יחסית, התנהלות הלקוח לאורך זמן (משמעת תשלומים, ללא חריגות) מצדיקה אישור.'
        };

        // If the caller wasn't authenticated (cross-domain cookie failed), skip the LLM
        // entirely and return the static Hebrew fallback. Calling InvokeLLM unauthenticated
        // would also fail and we'd end up showing "לא זמין" to the user — defeating the
        // whole point of the soft-auth degradation above.
        if (!isAuthenticated) {
            const fallbackResults = list.map(s => fallbackText[s.type] || 'נימוק אשראי אינו זמין כרגע.');
            if (strategies) {
                return Response.json({ success: true, justifications: fallbackResults, mode: 'fallback' });
            }
            return Response.json({ success: true, justification: fallbackResults[0], mode: 'fallback' });
        }

        // Run all LLM calls in parallel — total latency ≈ slowest single call.
        // Using default model (gpt_5_mini) — empirically ~3-4× faster than gemini_3_flash
        // on short Hebrew generations, and we don't need web context here.
        const results = await Promise.all(list.map(async (s) => {
            const t0 = Date.now();
            try {
                let response = await base44.integrations.Core.InvokeLLM({
                    prompt: buildPrompt(s)
                });
                let text = typeof response === 'string' ? response.trim() : String(response).trim();

                // If the model leaked foreign-script words, retry once with an even stricter
                // re-write instruction. If it still fails — return the static Hebrew fallback.
                if (isContaminated(text)) {
                    console.warn(`LLM ${s.type}: contaminated output, retrying. First attempt: ${text.slice(0, 120)}`);
                    const retry = await base44.integrations.Core.InvokeLLM({
                        prompt: `שכתב את הטקסט הבא לעברית תקנית בלבד. אסור בהחלט מילים באנגלית או בערבית. אסור ראשי תיבות לועזיים. שמור על 2 משפטים, סגנון של חתם אשראי בנקאי:\n\n${text}`
                    });
                    const retryText = typeof retry === 'string' ? retry.trim() : String(retry).trim();
                    if (!isContaminated(retryText)) {
                        text = retryText;
                    } else {
                        console.error(`LLM ${s.type}: retry still contaminated, using fallback.`);
                        text = fallbackText[s.type] || 'נימוק אשראי אינו זמין כרגע.';
                    }
                }

                console.log(`LLM ${s.type}: ${Date.now() - t0}ms`);
                return text || fallbackText[s.type] || 'נימוק אשראי אינו זמין כרגע.';
            } catch (e) {
                console.error(`LLM ${s.type} failed after ${Date.now() - t0}ms:`, e?.message);
                return fallbackText[s.type] || 'נימוק אשראי אינו זמין כרגע.';
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