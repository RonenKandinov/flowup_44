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

        // Each strategy gets a DISTINCT thesis — explicit instructions on WHAT must be
        // emphasized and what is FORBIDDEN. This prevents the LLM from defaulting to the
        // same generic "פריסת ההלוואה והתאמת ההוצאה הדיסקרציונית..." sentence across all 3.
        const strategyThesis = {
            cash_flow_alignment: {
                title: 'התאמת תזרים',
                must_emphasize: 'פריסת ההלוואה לאורך זמן והתאמת ההוצאה הדיסקרציונית — כך שההחזר החודשי מתיישר עם ההכנסה הפנויה החודשית בפועל. הדגש את המרווח החודשי ואת היציבות התזרימית.',
                forbidden: 'אסור להזכיר הקטנת חשיפה, מקדמה, מינוף, או יציבות התנהגותית כסיבה מרכזית.',
                key_concept: 'יישור ההחזר לתזרים החודשי'
            },
            exposure_reduction: {
                title: 'הפחתת חשיפה',
                must_emphasize: 'הקטנת היקף ההלוואה, שימוש במקדמה, והקטנת המינוף הכולל של הלקוח. הדגש שהחשיפה הלקוחית יורדת ושנשמרת כרית נזילות לשירות החוב לאורך זמן.',
                forbidden: 'אסור להזכיר פריסה לאורך זמן, התאמת הוצאה דיסקרציונית, או יציבות התנהגותית כסיבה מרכזית.',
                key_concept: 'הקטנת מינוף ושמירת כרית נזילות'
            },
            behavioral_approval: {
                title: 'אישור מבוסס התנהגות',
                must_emphasize: 'משמעת תשלומים מוכחת, התנהלות פיננסית עקבית לאורך זמן, היעדר חריגות, ודפוסי הוצאה צפויים. הסיבה לאישור היא העקביות ההתנהגותית — לא המבנה הפיננסי.',
                forbidden: 'אסור להזכיר פריסה לאורך זמן, מקדמה, או הקטנת היקף ההלוואה כסיבה מרכזית.',
                key_concept: 'משמעת והתנהגות פיננסית מוכחת'
            }
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

        // Helper: classify the SPECIFIC strategy's profitability so the prompt can
        // tell the LLM whether the deal is profitable / marginal / loss-making.
        // This is what the EV panel in the UI shows — the justification MUST
        // align with it (no more "רווחיות תקינה" written next to a loss-making cube).
        const classifyProfitability = (margin) => {
            if (!Number.isFinite(margin)) return null;
            if (margin >= 0.05) return { label: 'רווחיות גבוהה', tone: 'התמחור מכסה את הסיכון בנדיבות ומייצר מרווח רווח חזק' };
            if (margin >= 0.02) return { label: 'רווחיות תקינה', tone: 'התמחור מאוזן מול הסיכון ועומד ברף הרווחיות הנדרש' };
            if (margin >= 0)    return { label: 'רווחיות גבולית', tone: 'מרווח הרווח מתחת לסף המדיניות, אך עדיין חיובי' };
            return { label: 'הפסד צפוי', tone: 'התמחור הנוכחי לא מכסה את ההפסד הצפוי במלואו, ודורש תיקון מחיר או תנאים' };
        };

        const classifyDsr = (dsr, t) => {
            const d = Number(dsr);
            if (!Number.isFinite(d) || !Number.isFinite(t)) return 'במסגרת המדיניות';
            if (d <= t * 0.5)  return 'נמוך משמעותית מסף המדיניות, עם מרווח ביטחון רחב';
            if (d <= t * 0.8)  return 'מתחת לסף המדיניות, עם מרווח ביטחון מספק';
            if (d <= t)        return 'קרוב לסף המדיניות אך בתוכו';
            if (d <= t + 10)   return 'מעל הסף, אך בתוך טווח הגמישות המקובל';
            return 'מעל הסף, בתחום ה-Stretch';
        };

        // Strict Hebrew-only prompt grounded in the SPECIFIC numbers of THIS strategy.
        // Per CTO direction: the justification must match what the cubes show — same DSR band,
        // same profitability verdict (EV-based), same status. We don't pass the raw ₪ figures
        // to the prompt (no number citations), but we DO classify them so the LLM tone matches.
        const buildPrompt = (s) => {
            const thesis = strategyThesis[s.type] || {
                title: s.type, must_emphasize: '', forbidden: '', key_concept: s.type
            };
            const statusLabel = s.status === 'approved' ? 'מאושר' : s.status === 'conditional' ? 'מאושר בתנאי' : 'לא מאושר';
            const dsrPosition = classifyDsr(s.dsr, threshold);
            const profitability = classifyProfitability(s.profitMargin);

            // Build the profitability sentence (sentence #3 of every justification)
            // FROM the actual EV of this strategy. This is the key fix for the
            // "all justifications say the same thing" bug.
            const profitabilityClause = profitability
                ? `במשפט השלישי חובה לומר במפורש: "${profitability.label}" — ${profitability.tone}.`
                : 'במשפט השלישי הצדק את התמחור מול הסיכון.';

            return `אתה חתם אשראי בכיר בחברה חוץ-בנקאית בישראל. אתה כותב נימוק אשראי רשמי במערכת חיתום פנימית.

המסלול שאתה מנמק: "${thesis.title}".
מהות המסלול: ${thesis.key_concept}.

חובה להדגיש במשפט המרכזי:
${thesis.must_emphasize}

אסור בתוקף:
${thesis.forbidden}

חוקי כתיבה מוחלטים:
- עברית תקנית בלבד. אסור מילים באנגלית, ערבית או כל שפה זרה. אסור ראשי תיבות לועזיים.
- אסור לצטט מספרים מדויקים (לא אחוזי החזר, לא סכומי שקלים, לא ריבית). השתמש בתיאורים איכותיים בלבד.
- בדיוק 3 משפטים, סך הכל 50-70 מילים.
- כל משפט מתמקד בנושא אחר, לפי המבנה הבא:
  משפט 1: מאפיין מרכזי בפרופיל הלקוח שתומך דווקא במסלול הזה (לא במסלול אחר).
  משפט 2: כיצד מבנה ההלוואה הספציפי של מסלול זה (${thesis.key_concept}) מאזן את הסיכון. חובה שהמשפט יזכיר במפורש את ${thesis.key_concept}.
  משפט 3: הצדקה כלכלית — תמחור, רווחיות, ושיקול דעת חתם. ${profitabilityClause}
- אסור בתוקף לחזור על נוסחים מנימוקים אחרים. כל מסלול מקבל ניסוח ייחודי משלו.
- אסור להשתמש בביטוי "פריסת ההלוואה והתאמת ההוצאה הדיסקרציונית" אלא במסלול "התאמת תזרים" בלבד.

נתוני המסלול הספציפי הזה (להקשר בלבד, אל תצטט מספרים):
- סטטוס המסלול: ${statusLabel}
- מיקום יחס ההחזר ביחס לסף המדיניות: ${dsrPosition}
${profitability ? `- רווחיות צפויה של המסלול: ${profitability.label}` : ''}

נתוני הלקוח (להקשר בלבד, אל תצטט):
- פרופיל: ${profileLines || 'סטנדרטי'}
${positiveFactors ? `- חוזקות שזוהו: ${positiveFactors}` : ''}
${negativeFactors ? `- סיכונים שזוהו: ${negativeFactors}` : ''}

החזר רק את הטקסט הסופי של הנימוק, ללא הקדמות, ללא כותרות, ללא מירכאות.`;
        };

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
        // The strict per-strategy thesis (must_emphasize / forbidden) in the prompt
        // is what now forces differentiated output — not the model choice. We keep
        // the default fast model so the analyst doesn't wait 25–50s for justifications.
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