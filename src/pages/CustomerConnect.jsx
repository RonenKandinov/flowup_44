import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, ShieldCheck, Building2, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import OpenFinanceConnect from '@/components/connect/OpenFinanceConnect';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Customer-facing onboarding page.
 * URL: /connect/:sessionId?t=<raw_token>
 *
 * The session is validated against onboardingLinkValidate BEFORE we render
 * anything sensitive. The raw token never leaves this page — it's exchanged
 * for partner branding + session context and then dropped.
 */
export default function CustomerConnect() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();

  // The bank redirects back WITHOUT the token (?t=) — only with ?of_callback=1.
  // So we persist the raw token on first landing and restore it on the way back.
  const tokenKey = `onboarding_token_${sessionId}`;
  const urlToken = searchParams.get('t');
  const token = urlToken || (typeof window !== 'undefined' ? localStorage.getItem(tokenKey) : null);
  const isCallback = searchParams.get('of_callback') === '1';

  if (urlToken && typeof window !== 'undefined') {
    localStorage.setItem(tokenKey, urlToken);
  }

  const [session, setSession] = useState(null);
  const [step, setStep] = useState('validating'); // validating | welcome | connect | analyzing | success | error
  const [error, setError] = useState(null);

  // Step 1 — validate the link
  useEffect(() => {
    if (!sessionId || !token) {
      setError('הקישור אינו תקין או חסרים נתונים.');
      setStep('error');
      return;
    }
    base44.functions
      .invoke('b2bService', { action: 'validate_onboarding_link', session_id: sessionId, token })
      .then((res) => {
        const data = res?.data || res;
        if (data?.error) {
          if (data.error === 'expired') setError('פג תוקף הקישור. אנא בקש קישור חדש מהחברה.');
          else if (data.error === 'already_used') setError('הקישור כבר נוצל. אנא פנה לחברה.');
          else if (data.error === 'invalid_token' || data.error === 'invalid_link') setError('הקישור אינו תקין.');
          else setError(data.error);
          setStep('error');
          return;
        }
        setSession(data);
        // If we're returning from the bank, jump straight to the callback handler
        setStep(isCallback ? 'analyzing' : 'welcome');
      })
      .catch((err) => {
        const msg = err?.response?.data?.error || err?.message || 'שגיאה באימות הקישור';
        if (msg === 'expired') setError('פג תוקף הקישור. אנא בקש קישור חדש מהחברה.');
        else if (msg === 'already_used') setError('הקישור כבר נוצל. אנא פנה לחברה.');
        else if (msg === 'invalid_token' || msg === 'invalid_link') setError('הקישור אינו תקין.');
        else setError(msg);
        setStep('error');
      });
  }, [sessionId, token]);

  // Step 3 — Open Finance finished inline
  const handleConnectedInline = async () => {
    setStep('analyzing');
    try {
      const connectionId = localStorage.getItem('of_pending_connection');
      // Mark the session as analyzing + record the connection id
      await base44.functions.invoke('b2bService', {
        action: 'update_onboarding_session',
        session_id: sessionId,
        status: 'analyzing',
        connection_id: connectionId || ''
      }).catch(() => {});

      // Fire underwriting in the background (reuses the existing b2bService flow)
      base44.functions.invoke('b2bService', {
        action: 'process_underwriting',
        partner_id: session?.b2b_partner_id,
        customer_id: session?.customer_id || sessionId,
        connection_id: connectionId,
        psu_id: session?.customer_id || sessionId,
        onboarding_session_id: sessionId
      }).catch((err) => console.error('Background underwriting failed:', err));

      localStorage.removeItem('of_pending_connection');
      localStorage.removeItem('of_pending_provider');

      // Analysis continues asynchronously on the server; it will mark the session completed.
      setTimeout(() => setStep('success'), 2000);
    } catch (err) {
      setError(err?.message || 'שגיאה בשלב הניתוח');
      setStep('error');
    }
  };

  // Step 4 — Returning from the bank's consent page (?of_callback=1).
  // The bank dropped our token, but we restored it from localStorage above.
  // Here we poll Open Finance for the connection status, then fire underwriting.
  useEffect(() => {
    if (!isCallback || !session) return;

    let cancelled = false;

    const runCallback = async () => {
      const connectionId = localStorage.getItem('of_pending_connection');
      const psuId = session.customer_id || session.customer_email || sessionId;

      if (!connectionId) {
        setError('פג תוקף סשן החיבור. אנא נסו שוב מההתחלה.');
        setStep('error');
        return;
      }

      const READY = ['ACTIVE', 'COMPLETED', 'CONNECTED'];
      const ERRORS = ['ERROR', 'FETCHING_ERROR', 'EXPIRED', 'REJECTED', 'REVOKED'];
      let connStatus = 'INACTIVE';
      let attempts = 0;

      // Poll until the connection becomes active (data fetched) or fails
      while (!READY.includes(connStatus) && !ERRORS.includes(connStatus) && attempts < 20 && !cancelled) {
        await new Promise((r) => setTimeout(r, 3000));
        try {
          const res = await base44.functions.invoke('openFinanceAuth', {
            action: 'check_status',
            connectionId,
            psuId
          });
          connStatus = res?.data?.status || 'UNKNOWN';
        } catch (e) {
          console.error('Status check error:', e);
          break;
        }
        attempts++;
      }

      if (cancelled) return;

      if (ERRORS.includes(connStatus)) {
        setError(`החיבור לבנק נכשל (${connStatus}). אנא נסו שוב.`);
        setStep('error');
        return;
      }

      // Connection ready → mark session analyzing + fire underwriting in the background
      try {
        await base44.functions.invoke('b2bService', {
          action: 'update_onboarding_session',
          session_id: sessionId,
          status: 'analyzing',
          connection_id: connectionId
        }).catch(() => {});

        base44.functions.invoke('b2bService', {
          action: 'process_underwriting',
          partner_id: session.b2b_partner_id,
          customer_id: session.customer_id || sessionId,
          connection_id: connectionId,
          psu_id: psuId,
          onboarding_session_id: sessionId
        }).catch((err) => console.error('Background underwriting failed:', err));

        localStorage.removeItem('of_pending_connection');
        localStorage.removeItem('of_pending_provider');
        setStep('success');
      } catch (err) {
        setError(err?.message || 'שגיאה בשלב הניתוח');
        setStep('error');
      }
    };

    runCallback();
    return () => { cancelled = true; };
  }, [isCallback, session, sessionId]);

  // ── Error ──
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md text-center p-8">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">שגיאה בתהליך</h2>
          <p className="text-slate-600">{error}</p>
        </Card>
      </div>
    );
  }

  // ── Validating ──
  if (step === 'validating' || !session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        {/* Partner Branding Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="w-8 border-b-2 border-dashed border-slate-300"></div>
            <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg font-bold text-xl">
              F
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            אישור אשראי מהיר עבור {session.b2b_partner_name}
          </h1>
          {session.customer_name && (
            <p className="text-slate-600 mt-1">שלום {session.customer_name},</p>
          )}
          {session.requested_amount ? (
            <p className="text-slate-500 mt-2">
              בקשה להלוואה בסך ₪{Number(session.requested_amount).toLocaleString()}
            </p>
          ) : null}
        </div>

        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <motion.div key="welcome" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Card className="border-0 shadow-xl">
                <CardContent className="p-6 space-y-6">
                  <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm leading-relaxed">
                    כדי שנוכל לאשר את בקשתך באופן מיידי, אנו זקוקים לחיבור מאובטח לחשבון הבנק שלך. התהליך לוקח פחות מדקה.
                  </div>
                  <ul className="space-y-3 text-sm text-slate-600">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      חיבור מאובטח בתקן בנק ישראל (Open Banking)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      קריאה בלבד – אין אפשרות לבצע פעולות בחשבון
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      הנתונים משמשים אך ורק לבחינת בקשה זו
                    </li>
                  </ul>
                  <button
                    onClick={() => setStep('connect')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors"
                  >
                    המשך לחיבור הבנק
                  </button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 'connect' && (
            <motion.div key="connect" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <OpenFinanceConnect
                inline={true}
                onConnected={handleConnectedInline}
                defaultId={session.customer_id || session.customer_email || sessionId}
              />
            </motion.div>
          )}

          {step === 'analyzing' && (
            <motion.div key="analyzing" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12">
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">מנתח נתונים...</h2>
              <p className="text-slate-500">FlowUp מבצעת חיתום חכם בזמן אמת</p>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="border-0 shadow-xl bg-gradient-to-br from-green-50 to-emerald-50">
                <CardContent className="p-8 text-center">
                  <div className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">התהליך הושלם בהצלחה!</h2>
                  <p className="text-slate-600 mb-6">
                    הנתונים נותחו והועברו באופן מאובטח ל{session.b2b_partner_name}.
                  </p>
                  <p className="text-sm text-slate-500 font-medium">
                    ניתן לסגור חלון זה ולחזור לאתר של {session.b2b_partner_name}.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center mt-8 text-xs text-slate-400 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3 h-3" />
          מאובטח ע"י FlowUp Open Finance
        </div>
      </div>
    </div>
  );
}