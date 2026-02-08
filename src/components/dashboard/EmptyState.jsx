import React from 'react';
import { motion } from 'framer-motion';
import { Building2, ShieldCheck, Lock, ArrowLeft, Eye, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OpenFinanceConnect from '@/components/connect/OpenFinanceConnect';

export default function EmptyState({ onDataParsed }) {
  const features = [
    { icon: Zap, text: 'חיתום חכם מבוסס תזרים (Traffic Light)' },
    { icon: Eye, text: 'מנוע תובנות לאיתור הון חבוי' },
    { icon: ShieldCheck, text: 'אבטחת Zero-Knowledge' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center"
    >
      <div className="mb-8 w-full max-w-md">
        <OpenFinanceConnect onConnected={onDataParsed} />
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-3xl mt-8">
        {features.map((feature, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + index * 0.1 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-sm"
          >
            <feature.icon className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <span className="text-sm text-slate-300 font-medium">{feature.text}</span>
          </motion.div>
        ))}
      </div>

      {/* Security note */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-8 text-xs text-slate-500 flex items-center gap-2 opacity-60"
      >
        <Lock className="w-3 h-3" />
        פועל תחת תקני אבטחה מחמירים (TLS 1.3 / ISO 27001)
      </motion.p>
    </motion.div>
  );
}