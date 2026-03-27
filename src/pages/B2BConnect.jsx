import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, ShieldCheck, Building2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import OpenFinanceConnect from '@/components/connect/OpenFinanceConnect';
import { Card, CardContent } from '@/components/ui/card';

export default function B2BConnect() {
  const [searchParams] = useSearchParams();
  const partnerId = searchParams.get('partner_id');
  const customerId = searchParams.get('customer_id');
  const amount = searchParams.get('amount');
  
  const [partner, setPartner] = useState(null);
  const [step, setStep] = useState('welcome'); // welcome -> connect -> analyzing -> success -> error
  const [error, setError] = useState(null);
  const [analysisResults, setAnalysisResults] = useState(null);

  useEffect(() => {
    if (partnerId) {
      base44.entities.B2BPartner.get(partnerId)
        .then(p => setPartner(p))
        .catch(err => {
          console.error(err);
          setError('שותף לא חוקי או לא נמצא');
          setStep('error');
        });
    } else {
      setError('חסרים פרטי שותף בקישור');
      setStep('error');
    }
  }, [partnerId]);

  // Handle the Open Finance Callback
  useEffect(() => {
    const ofCallback = searchParams.get('of_callback');
    if (ofCallback && partnerId && customerId) {
      setStep('analyzing');
      processConnectionAndAnalyze();
    }
  }, [searchParams, partnerId, customerId]);

  const processConnectionAndAnalyze = async () => {
    try {
      const connectionId = localStorage.getItem('of_pending_connection');
      const psuId = localStorage.getItem('of_psu_id') || customerId;

      if (!connectionId) {
        throw new Error('פג תוקף החיבור. אנא נסה שוב.');
      }

      // 1. Wait for connection to be ACTIVE
      let connectionStatus = 'INACTIVE';
      let attempts = 0;
      while (!['ACTIVE', 'COMPLETED', 'CONNECTED'].includes(connectionStatus) && attempts < 20) {
        await new Promise(r => setTimeout(r, 3000));
        const { data: statusData } = await base44.functions.invoke('openFinanceAuth', {
          action: 'check_status',
          connectionId,
          psuId
        });
        connectionStatus = statusData?.status || 'UNKNOWN';
        if (['ERROR', 'FETCHING_ERROR', 'EXPIRED', 'REJECTED', 'REVOKED'].includes(connectionStatus)) {
          throw new Error(`החיבור נכשל (${connectionStatus})`);
        }
        attempts++;
      }

      // 2. Fetch Bank Data
      const { data: bankData } = await base44.functions.invoke('loanLogicV2', { userId: psuId });
      if (!bankData?.success) throw new Error('שגיאה במשיכת נתוני הבנק');

      // 3. Run Insight Engine
      const { data: insightsRes } = await base44.functions.invoke('insightEngine', { metrics: bankData.metrics });
      if (!insightsRes?.success) throw new Error('שגיאה בניתוח הנתונים');

      setAnalysisResults(insightsRes.insights);

      // 4. Send Webhook to Partner
      await base44.functions.invoke('sendPartnerWebhook', {
        partner_id: partnerId,
        customer_id: customerId,
        analysis_results: insightsRes.insights
      });

      // Clean up
      localStorage.removeItem('of_pending_connection');
      localStorage.removeItem('of_pending_provider');
      
      setStep('success');

    } catch (err) {
      console.error(err);
      setError(err.message);
      setStep('error');
    }
  };

  const handleConnectedInline = () => {
    // If the provider didn't redirect but finished inline
    setStep('analyzing');
    processConnectionAndAnalyze();
  };

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md text-center p-8">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">שגיאה בתהליך</h2>
          <p className="text-slate-600">{error}</p>
        </Card>
      </div>
    );
  }

  if (!partner) {
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
            אישור אשראי מהיר עבור {partner.name}
          </h1>
          {amount && (
            <p className="text-slate-500 mt-2">
              בקשה להלוואה בסך ₪{Number(amount).toLocaleString()}
            </p>
          )}
        </div>

        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
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
                      קריאה בלבד - אין אפשרות לבצע פעולות בחשבון
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
            <motion.div
              key="connect"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <OpenFinanceConnect 
                inline={true} 
                onConnected={handleConnectedInline}
                // Pass customerId as psuId so it's tracked correctly
                defaultEmail={customerId} 
              />
            </motion.div>
          )}

          {step === 'analyzing' && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12"
            >
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
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="border-0 shadow-xl bg-gradient-to-br from-green-50 to-emerald-50">
                <CardContent className="p-8 text-center">
                  <div className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">התהליך הושלם בהצלחה!</h2>
                  <p className="text-slate-600 mb-6">
                    הנתונים נותחו והועברו באופן מאובטח ל{partner.name}.
                  </p>
                  <div className="bg-white/60 p-4 rounded-lg text-sm text-slate-700 mb-6">
                    {analysisResults?.narrative || 'הבקשה שלך נמצאת בבחינה סופית.'}
                  </div>
                  <p className="text-sm text-slate-500 font-medium">
                    ניתן לסגור חלון זה ולחזור לאתר של {partner.name}.
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