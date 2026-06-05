import React, { useState, useEffect, useRef } from 'react';
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
  const token = searchParams.get('t');
  const ofCallback = searchParams.get('of_callback');

  const [session, setSession] = useState(null);
  const [step, setStep] = useState('validating'); // validating | welcome | connect | analyzing | success | error
  const [error, setError] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const callbackHandledRef = useRef(false);

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
        if (data.status === 'completed') {
          setStep('success');
        } else if (ofCallback && !callbackHandledRef.current) {
          callbackHandledRef.current = true;
          handleConnectedInline(data);
        } else {
          setStep('welcome');
        }
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
  const handleConnectedInline = async (sessionContext = session) => {
    setStep('analyzing');
    try {
      const currentSession = sessionContext || session;
      const connectionId = localStorage.getItem('of_pending_connection') || currentSession?.open_finance_connection_id;
      if (!connectionId) throw new Error('לא נמצא מזהה התחברות. נא לפתוח את הקישור מחדש ולנסות שוב.');
      // Mark the session as analyzing + record the connection id
      await base44.functions.invoke('b2bService', {
        action: 'update_onboarding_session',
        session_id: sessionId,
        status: 'analyzing',
        connection_id: connectionId || ''
      }).catch(() => {});

      const psuId = currentSession?.customer_id || localStorage.getItem('of_psu_id') || sessionId;

      const statusRes = await base44.functions.invoke('openFinanceAuth', {
        action: 'check_status',
        connectionId,
        psuId
      });

      if (!['ACTIVE', 'CONNECTED', 'COMPLETED'].includes(statusRes.data?.status)) {
        throw new Error('נתוני הבנק עדיין נטענים. נסה לרענן בעוד רגע.');
      }

      const bankRes = await base44.functions.invoke('loanLogicV2', {
        userId: psuId,
        targetAccountId: 'all'
      });

      if (!bankRes.data?.success) {
        throw new Error(bankRes.data?.error || 'לא הצלחנו לפתוח את נתוני הבנק.');
      }

      setAnalysisData(bankRes.data);

      await base44.functions.invoke('b2bService', {
        action: 'update_onboarding_session',
        session_id: sessionId,
        status: 'completed',
        connection_id: connectionId || ''
      }).catch(() => {});

      localStorage.removeItem('of_pending_connection');
      localStorage.removeItem('of_pending_provider');
      localStorage.removeItem('of_psu_id');

      setStep('success');
    } catch (err) {
      const serverError = err?.response?.data?.details || err?.response?.data?.error;
      setError(serverError || err?.message || 'שגיאה בשלב הניתוח');
      setStep('error');
    }
  };

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
                    התחברות
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
                    הנתונים נותחו ונפתחו בהצלחה ב־FlowUp.
                  </p>
                  {analysisData?.metrics && (
                    <div className="grid grid-cols-2 gap-3 text-right mb-6">
                      <div className="bg-white/80 rounded-xl p-3 border border-emerald-100">
                        <p className="text-xs text-slate-500">ציון</p>
                        <p className="text-lg font-bold text-slate-800">{analysisData.metrics.score}</p>
                      </div>
                      <div className="bg-white/80 rounded-xl p-3 border border-emerald-100">
                        <p className="text-xs text-slate-500">נזילות</p>
                        <p className="text-lg font-bold text-slate-800">₪{Number(analysisData.metrics.liquidAssets || 0).toLocaleString()}</p>
                      </div>
                      <div className="bg-white/80 rounded-xl p-3 border border-emerald-100">
                        <p className="text-xs text-slate-500">הכנסה חודשית</p>
                        <p className="text-lg font-bold text-slate-800">₪{Number(analysisData.metrics.totalIncome || 0).toLocaleString()}</p>
                      </div>
                      <div className="bg-white/80 rounded-xl p-3 border border-emerald-100">
                        <p className="text-xs text-slate-500">הוצאות חודשיות</p>
                        <p className="text-lg font-bold text-slate-800">₪{Number(analysisData.metrics.totalExpenses || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                  <p className="text-sm text-slate-500 font-medium mb-5">
                    ניתן לחזור לאתר של {session.b2b_partner_name}.
                  </p>
                  <button
                    onClick={() => window.close()}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg transition-colors"
                  >
                    סגור חלון
                  </button>
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