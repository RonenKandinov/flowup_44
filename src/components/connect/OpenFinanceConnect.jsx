import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, ShieldCheck, Lock, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { KeyChain } from '@/components/protocol/core/keyChain';

export default function OpenFinanceConnect({ onConnected, inline = false }) {
  const [status, setStatus] = useState('idle'); // idle, connecting, analyzing, success
  const [progress, setProgress] = useState(0);

  const handleConnect = async () => {
    setStatus('connecting');
    setProgress(10);

    try {
      const user = await base44.auth.me();
      if (!user) throw new Error("User not authenticated");

      // Call new Open Finance Connector
      const { data } = await base44.functions.invoke("fup_live", { psuId: user.id });

      if (data.error) throw new Error(data.error);

      if (data.connectUrl) {
          window.location.href = data.connectUrl;
          return;
      }
      
      throw new Error("No connection URL received");

    } catch (error) {
      console.error("Open Finance Error:", error);
      alert(error.message || "Connection failed");
      setStatus('idle');
      setProgress(0);
    }
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

          <div className="grid grid-cols-2 gap-2 mb-6 opacity-70">
            {['poalim', 'leumi', 'discount', 'mizrahi'].map(bank => (
              <div key={bank} className="bg-slate-800/50 rounded-lg p-2 flex items-center justify-center border border-slate-700">
                {/* Placeholder for Bank Logos */}
                <div className="w-full h-6 bg-slate-700/50 rounded flex items-center justify-center text-[10px] text-slate-500 font-mono">
                  {bank.toUpperCase()}
                </div>
              </div>
            ))}
          </div>

          <Button 
            onClick={handleConnect}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white h-12 rounded-xl text-base shadow-lg shadow-blue-900/20"
          >
            <Lock className="w-4 h-4 mr-2" />
            התחבר מאובטח
          </Button>
          
          <div className="flex items-center justify-center gap-2 mt-4 text-[10px] text-slate-500">
            <ShieldCheck className="w-3 h-3" />
            <span>מוצפן בתקן AES-256 (Zero-Knowledge)</span>
          </div>
        </motion.div>
      )}

      {(status === 'connecting' || status === 'analyzing') && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center w-full"
        >
          <div className="w-16 h-16 relative mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
            <div 
              className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"
            ></div>
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-blue-400">
              {progress}%
            </div>
          </div>
          
          <h3 className="text-lg font-medium text-white mb-1">
            {status === 'connecting' ? 'מתחבר לבנק...' : 'מנתח תזרים...'}
          </h3>
          <p className="text-sm text-slate-400">
            {status === 'connecting' 
              ? 'יוצר ערוץ תקשורת מאובטח' 
              : 'מפעיל מנוע חיתום חכם (Traffic Light)'}
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