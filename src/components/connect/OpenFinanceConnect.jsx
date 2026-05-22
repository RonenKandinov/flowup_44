import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, ShieldCheck, Lock, CheckCircle2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { getSupportedProviders } from '@/components/config/openFinanceProviders';

export default function OpenFinanceConnect({ onConnected, inline = false, defaultId = '' }) {
  const [status, setStatus] = useState('idle'); // idle, email_required, connecting, redirecting, success
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [progress, setProgress] = useState(0);
  const [idInput, setIdInput] = useState(defaultId);
  const [inputError, setInputError] = useState('');
  const [pendingProviderId, setPendingProviderId] = useState(null);

  // Resolve the psuId: try base44 auth first, fall back to provided email
  const getPsuId = async () => {
    try {
      const user = await base44.auth.me();
      if (user?.email || user?.id) return user.email || user.id;
    } catch (_) {
      // not logged into base44 — fall through
    }
    return null;
  };

  const startConnection = async (providerId, psuId) => {
    setStatus('connecting');
    setSelectedProvider(providerId);
    setProgress(20);

    try {
      setProgress(50);
      const redirectUrl = `${window.location.origin}${window.location.pathname}?of_callback=1`;
      const initResponse = await base44.functions.invoke("openFinanceAuth", {
        action: 'init_connection',
        psuId,
        providerId,
        redirectUrl
      });

      if (!initResponse.data?.success || !initResponse.data?.connectUrl) {
        throw new Error(initResponse.data?.error || "Failed to initiate connection");
      }

      const { connectUrl, connectionId } = initResponse.data;
      localStorage.setItem('of_pending_connection', connectionId);
      localStorage.setItem('of_pending_provider', providerId || '');
      localStorage.setItem('of_psu_id', psuId);

      setProgress(80);
      setStatus('redirecting');
      window.location.href = connectUrl;

    } catch (error) {
      console.error("Open Finance Error:", error);
      toast.error(`חיבור נכשל: ${error.message}`);
      setStatus('idle');
      setSelectedProvider(null);
      setProgress(0);
    }
  };

  const handleConnect = async (providerId) => {
    const psuId = await getPsuId();
    if (psuId) {
      await startConnection(providerId, psuId);
    } else {
      // Not authenticated — ask for email
      setPendingProviderId(providerId);
      setStatus('id_required');
    }
  };

  const handleIdSubmit = async (e) => {
    e.preventDefault();
    const costumerId = idInput.trim();

    if (!costumerId || !/^[0-9]{9}$/.test(costumerId)) {
      toast.error('(סספרות 9) נא להזין תעודת זהות תקינה');
      return;
    }
    await startConnection(pendingProviderId, costumerId);
  };

  const containerClass = inline
    ? "w-full max-w-md mx-auto bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden mt-10 p-6"
    : "flex flex-col items-center justify-center w-full max-w-md";

  return (
    <div className={containerClass}>
      {status === 'idle' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center w-full"
        >
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
            <Building2 className="w-8 h-8 text-blue-400" />
          </div>

          <h2 className="text-xl font-bold text-white mb-2">חיבור לחשבון הבנק</h2>
          <p className="text-slate-400 text-sm mb-6">
            חבר את חשבונך באופן מאובטח באמצעות Open Finance לקבלת ניתוח חיתום מיידי.
          </p>

          <div className="grid grid-cols-2 gap-2 mb-6">
            {getSupportedProviders().map(provider => (
              provider.comingSoon ? (
                <div
                  key={provider.id}
                  className="relative bg-slate-800/30 rounded-lg p-3 flex items-center justify-center border border-slate-700/50 opacity-50 cursor-not-allowed"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xl">{provider.logo}</span>
                    <span className="text-[10px] text-slate-500 font-medium">{provider.displayName}</span>
                  </div>
                  <span className="absolute top-1 right-1 text-[8px] bg-slate-700 text-slate-400 px-1 rounded">בקרוב</span>
                </div>
              ) : (
                <Button
                  key={provider.id}
                  onClick={() => handleConnect(provider.id)}
                  variant="outline"
                  className="bg-slate-800/50 hover:bg-slate-700 rounded-lg p-3 flex items-center justify-center border border-slate-700 hover:border-cyan-500 transition-all"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xl">{provider.logo}</span>
                    <span className="text-[10px] text-slate-400 font-medium">{provider.displayName}</span>
                  </div>
                </Button>
              )
            ))}
          </div>

          <div className="text-center text-xs text-slate-500 mb-4">
            או
          </div>

          <Button
            onClick={() => handleConnect('mizrahi')}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white h-12 rounded-xl text-base shadow-lg shadow-blue-900/20"
          >
            <Lock className="w-4 h-4 mr-2" />
            התחבר מאובטח (מזרחי)
          </Button>

          <div className="flex gap-2 mt-3 w-full">
            <Button
              onClick={() => handleConnect('mizrahi-sandbox')}
              variant="outline"
              className="flex-1 bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 h-10 text-xs"
            >
              מזרחי Sandbox
            </Button>
            <Button
              onClick={() => handleConnect('leumi-sandbox')}
              variant="outline"
              className="flex-1 bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 h-10 text-xs"
            >
              לאומי Sandbox
            </Button>
            <Button
              onClick={() => handleConnect('hapoalim-sandbox')}
              variant="outline"
              className="flex-1 bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 h-10 text-xs"
            >
              פועלים Sandbox
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2 mt-4 text-[10px] text-slate-500">
            <ShieldCheck className="w-3 h-3" />
            <span>מוצפן בתקן AES-256 (Zero-Knowledge)</span>
          </div>
        </motion.div>
      )}

      {status === 'id_required' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center w-full"
        >
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
            <Mail className="w-8 h-8 text-blue-400" />
          </div>

          <h2 className="text-xl font-bold text-white mb-2">הזן את תעודת הזהות שלך</h2>
          <p className="text-slate-400 text-sm mb-6">
            <span className="block">כדי לשמור את נתוני החיבור, נא להזין מספר תעודת זהות</span>
            <span className="block mt-1">(9 ספרות)</span>
          </p>

          <form onSubmit={handleIdSubmit} className="w-full space-y-3">
          <div>
              <input
                type="text"
                maxLength="9"
                value={idInput}
                onChange={(e) => {
                  const val = e.target.value;
                  // אם המשתמש הקליד משהו שהוא לא מספר
                  if (/[^0-9]/.test(val)) {
                    setInputError('נא להזין רק מספרים ולא אותיות');
                    // מנקה מיד את האותיות כדי שלא יופיעו בשדה
                    setIdInput(val.replace(/[^0-9]/g, ''));
                  } else {
                    setInputError(''); // מנקה את השגיאה אם הכל תקין
                    setIdInput(val);
                  }
                }}
                placeholder="הכנס תעודת זהות"
                autoFocus
                className={`w-full bg-slate-800 border ${inputError ? 'border-red-500' : 'border-slate-600'} text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors`}
              />
              {/* הודעת השגיאה באדום שתקפוץ מתחת לשדה */}
              {inputError && (
                <p className="text-red-500 text-xs mt-1 text-right">{inputError}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white h-12 rounded-xl text-base"
            >
              המשך לחיבור הבנק
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setStatus('idle'); setPendingProviderId(null); }}
              className="w-full text-slate-400 hover:text-white text-sm"
            >
              חזור
            </Button>
          </form>
        </motion.div>
      )}

      {(status === 'connecting' || status === 'redirecting') && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center w-full"
        >
          <div className="w-16 h-16 relative mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-blue-400">
              {progress}%
            </div>
          </div>

          <h3 className="text-lg font-medium text-white mb-1">
            {status === 'redirecting'
              ? 'מפנה לעמוד הסכמה של הבנק...'
              : `מתחבר ל${selectedProvider?.toUpperCase() || 'בנק'}...`}
          </h3>
          <p className="text-sm text-slate-400">
            {status === 'redirecting'
              ? 'תועבר לבנק לאישור הגישה — חזור לאחר האישור'
              : 'יוצר ערוץ תקשורת מאובטח'}
          </p>
        </motion.div>
      )}

      {status === 'success' && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center w-full"
        >
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">הניתוח הושלם</h2>
          <p className="text-slate-400 text-sm">מעביר אותך לדאשבורד...</p>
    
        </motion.div>
      )}
    </div>
  );
}