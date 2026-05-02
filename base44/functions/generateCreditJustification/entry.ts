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
            cash_flow_alignment: 'תזרימית — יישור ההחזר ליכולת ההחזר בפועל באמצעות פריסה והתאמת הוצאה דיסקרציונית',
            exposure_reduction: 'חשיפתית — הקטנת מינוף ושמירה על כרית נזילות',
            behavioral_approval: 'התנהגותית — עקביות, משמעת פיננסית ויציבות לאורך זמן'
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

        // Map status → required narrative tone. This is what makes the 4 archetypes
        // (Approved / Conditional / Aggressive / Reject) read coherently and
        // distinctly, as defined by the credit policy document.
        const narrativeBlueprint = (s) => {
            const dsrAboveThreshold = Number(s.dsr) > Number(threshold);
            if (s.status === 'approved' && !dsrAboveThreshold) {
                // Archetype 1 — Good client (Approved)
                return `מבנה החובה (3 משפטים, סדר קבוע):
משפט 1 — חוזקות הפרופיל: התחל ב"הלקוח מציג..." או "הלקוח מאופיין ב..." והדגש לפחות חוזקה אחת מתוך רשימת החוזקות (אמון תזרימי, יציבות התנהלות, נזילות, התנהגות פיננסית).
משפט 2 — איך המבנה מאזן את יחס ההחזר: השתמש בנוסח "פריסת ההלוואה והתאמת ההוצאה הדיסקרציונית מאפשרות התאמה ליכולת ההחזר בפועל" או דומה. הזכר שיחס ההחזר עומד ביחס לסף, אך אל תצטט מספרים.
משפט 3 — תמחור מול סיכון: סיים ב"התמחור משקף רמת סיכון נמוכה-בינונית ושומר על רווחיות תקינה" או נוסח דומה.`;
            }
            if (s.status === 'approved' && dsrAboveThreshold) {
                // Archetype 2 — Borderline (Conditional masquerading as approved due to behavioral flex)
                return `מבנה החובה (3 משפטים, סדר קבוע):
משפט 1 — מצב יחס ההחזר: התחל ב"יחס ההחזר לאחר ההתאמות עומד מעל סף המדיניות, אך במסגרת טווח הגמישות המקובל" או נוסח דומה.
משפט 2 — תמונת הסיכון של הלקוח: הזכר שילוב של חוזקה אחת וסיכון אחד מהרשימות (אם קיימים) — לדוגמה "הפרופיל מצביע על יציבות חלקית, עם מספר אינדיקציות לסיכון מתון".
משפט 3 — תמחור מול סיכון: סיים בנוסח "התמחור הגבוה מפצה על הסיכון ומייצר רווחיות חיובית, ולכן העסקה מאושרת בכפוף לשיקול דעת חתם".`;
            }
            if (s.status === 'conditional') {
                // Archetype 2 — Borderline (Conditional)
                return `מבנה החובה (3 משפטים, סדר קבוע):
משפט 1 — מצב יחס ההחזר: התחל ב"יחס ההחזר לאחר ההתאמות עומד מעל סף המדיניות, אך במסגרת טווח ה-Stretch המקובל" או נוסח דומה (אם DSR אכן מעל הסף — אחרת אמור "יחס ההחזר נמצא בטווח גבולי").
משפט 2 — תמונת הסיכון: שלב חוזקה אחת וסיכון אחד מהרשימות — לדוגמה "הפרופיל מצביע על יציבות חלקית, עם מספר אינדיקציות לסיכון מתון".
משפט 3 — תמחור מול סיכון: סיים ב"התמחור הגבוה מפצה על הסיכון ומייצר רווחיות גבולית אך חיובית, ולכן העסקה מאושרת בכפוף לשיקול דעת".`;
            }
            // Archetype 4 — Reject (failed)
            return `מבנה החובה (3 משפטים, סדר קבוע):
משפט 1 — חוסר התאמה: התחל ב"יכולת ההחזר בפועל אינה מספקת ביחס למבנה ההלוואה, גם לאחר ההתאמות".
משפט 2 — תמונת הסיכון: ציין שילוב של רמת סיכון גבוהה ולפחות סיכון אחד ספציפי מהרשימה (אם קיים).
משפט 3 — מסקנה כלכלית: סיים ב"התמחור אינו מכסה את ההפסד הצפוי, ולכן העסקה אינה עומדת ברף הכלכלי הנדרש לאישור".`;
        };

        // Strict Hebrew-only prompt. We explicitly forbid foreign words, transliterations,
        // and acronym expansions (e.g. LLM expanding "DSR" to "Debt Service Ratio")
        // because in production gpt_5_mini occasionally mixes English/Arabic into Hebrew output.
        const buildPrompt = (s) => `אתה חתם אשראי ישראלי בכיר בחברה חוץ-בנקאית. כתוב נימוק אשראי בעברית תקנית בלבד, בסגנון של נימוק רשמי במערכת חיתום.

חוקים מוחלטים:
- עברית בלבד. אסור בהחלט מילים באנגלית, ערבית או כל שפה אחרת.
- אסור להרחיב ראשי תיבות.
- אסור לצטט מספרים מדויקים מהטבלה (לא אחוזי DSR ספציפיים, לא סכומים בשקלים, לא ריבית באחוזים). השתמש בתיאורים איכותיים: "מעל סף המדיניות", "במרווח בטוח", "במסגרת טווח הגמישות".
- בדיוק 3 משפטים. ללא כותרות, ללא רשימות. שפה מקצועית, זורמת ומקצועית-בנקאית.
- כל משפט מתחיל בתוכן ענייני, לא ב"לכן" או ב"בנוסף".

זווית הזה ניתוח: ${angle[s.type] || s.type}.
פרופיל הלקוח: ${profileLines || 'סטנדרטי'}.
תוצאה רשמית: ${s.status === 'approved' ? 'מאושר' : s.status === 'conditional' ? 'מאושר בתנאי' : 'לא מאושר'}.
יחס החזר חדש ביחס לסף המדיניות: ${Number(s.dsr) <= Number(threshold) ? 'בתוך הסף' : 'מעל הסף בטווח גמישות'}.
${positiveFactors ? `חוזקות שזוהו בפרופיל: ${positiveFactors}.` : ''}
${negativeFactors ? `סיכונים שזוהו בפרופיל: ${negativeFactors}.` : ''}

${narrativeBlueprint(s)}

חשוב: הקפד שהנימוק יזרום כסיפור אחד קוהרנטי — לא רשימה של עובדות. כל משפט חייב להתחבר לקודמו.`;

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

        // Static fallback per (strategy × status). Mirrors the 3 narrative archetypes used
        // in the LLM blueprint above — guarantees the analyst sees a coherent, policy-consistent
        // explanation even when the LLM is slow, errors out, or unauthenticated.
        const fallbackByStatus = (s) => {
            const dsrAboveThreshold = Number(s.dsr) > Number(threshold);
            // Approved + DSR within threshold → "Good client" archetype
            if (s.status === 'approved' && !dsrAboveThreshold) {
                if (s.type === 'cash_flow_alignment') {
                    return 'הלקוח מציג אמון תזרימי גבוה ודפוסי התנהלות יציבים לאורך זמן. פריסת ההלוואה והתאמת ההוצאה הדיסקרציונית מאפשרות יישור ההחזר ליכולת ההחזר בפועל ושומרות מרווח בטוח ביחס להכנסה הפנויה. התמחור משקף רמת סיכון נמוכה-בינונית ושומר על רווחיות תקינה.';
                }
                if (s.type === 'exposure_reduction') {
                    return 'הלקוח מאופיין בנזילות תקינה ומבנה הוצאות יציב, מה שמאפשר הקטנת חשיפה ללא פגיעה בכרית הביטחון. הקטנת היקף ההלוואה ושימוש במקדמה מורידים את יחס ההחזר אל בתוך סף המדיניות ומחזקים את היציבות הכלכלית של הלקוח. התמחור משקף רמת סיכון נמוכה ושומר על רווחיות תקינה.';
                }
                return 'הלקוח מציג התנהלות פיננסית עקבית ומשמעת תשלומים יציבה לאורך זמן. גם כאשר יחס ההחזר נמצא בטווח הגבוה של סף המדיניות, הפרופיל ההתנהגותי מצדיק אישור מלא בהסתמך על יציבות מוכחת. התמחור משקף רמת סיכון בינונית ושומר על רווחיות תקינה.';
            }
            // Approved + DSR above threshold (behavioral flex) — borderline approved
            if (s.status === 'approved' && dsrAboveThreshold) {
                return 'יחס ההחזר לאחר ההתאמות עומד מעל סף המדיניות, אך במסגרת טווח הגמישות המקובל. הפרופיל מצביע על יציבות חלקית עם מספר אינדיקציות לסיכון מתון. התמחור הגבוה מפצה על הסיכון ומייצר רווחיות חיובית, ולכן העסקה מאושרת בכפוף לשיקול דעת חתם.';
            }
            // Conditional — borderline archetype
            if (s.status === 'conditional') {
                return 'יחס ההחזר לאחר ההתאמות עומד מעל סף המדיניות, אך במסגרת טווח הגמישות המקובל. הפרופיל מצביע על יציבות חלקית, עם מספר אינדיקציות לסיכון מתון. התמחור הגבוה מפצה על הסיכון ומייצר רווחיות גבולית אך חיובית, ולכן העסקה מאושרת בכפוף לשיקול דעת חתם.';
            }
            // Reject archetype
            return 'יכולת ההחזר בפועל אינה מספקת ביחס למבנה ההלוואה, גם לאחר ההתאמות. רמת הסיכון גבוהה ומלווה במספר אינדיקציות לחוסר יציבות. התמחור אינו מכסה את ההפסד הצפוי, ולכן העסקה אינה עומדת ברף הכלכלי הנדרש לאישור.';
        };

        // If the caller wasn't authenticated (cross-domain cookie failed), skip the LLM
        // entirely and return the static Hebrew fallback. Calling InvokeLLM unauthenticated
        // would also fail and we'd end up showing "לא זמין" to the user — defeating the
        // whole point of the soft-auth degradation above.
        if (!isAuthenticated) {
            const fallbackResults = list.map(s => fallbackByStatus(s));
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
                        prompt: `שכתב את הטקסט הבא לעברית תקנית בלבד. אסור בהחלט מילים באנגלית או בערבית. אסור ראשי תיבות לועזיים. שמור על 3 משפטים, סגנון של חתם אשראי בנקאי:\n\n${text}`
                    });
                    const retryText = typeof retry === 'string' ? retry.trim() : String(retry).trim();
                    if (!isContaminated(retryText)) {
                        text = retryText;
                    } else {
                        console.error(`LLM ${s.type}: retry still contaminated, using fallback.`);
                        text = fallbackByStatus(s);
                    }
                }

                console.log(`LLM ${s.type}: ${Date.now() - t0}ms`);
                return text || fallbackByStatus(s);
            } catch (e) {
                console.error(`LLM ${s.type} failed after ${Date.now() - t0}ms:`, e?.message);
                return fallbackByStatus(s);
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