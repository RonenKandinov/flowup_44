import React from 'react';
import { motion } from 'framer-motion';
import { Upload, Shield, Eye, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EmptyState({ onUploadClick }) {
  const features = [
    { icon: Eye, text: 'צפה ביתרה הצפויה לסוף החודש' },
    { icon: Zap, text: 'בדוק את ההשפעה של הוצאות עתידיות' },
    { icon: Shield, text: 'קבל התראה על ימי סיכון' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center"
    >
      {/* Animated logo/icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", delay: 0.2 }}
        className="relative mb-8"
      >
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center">
            <Upload className="w-8 h-8 text-cyan-400" />
          </div>
        </div>
        {/* Decorative rings */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border border-dashed border-cyan-500/20"
        />
      </motion.div>

      <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
        ברוכים הבאים ל-FlowUp
      </h2>
      <p className="text-slate-400 max-w-md mb-8">
        העלה את דוח העסקאות מהבנק שלך וקבל תמונה ברורה של המצב הפיננסי שלך
      </p>

      <Button
        onClick={onUploadClick}
        size="lg"
        className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium px-8 py-6 rounded-xl shadow-lg shadow-cyan-500/25 mb-12"
      >
        <Upload className="w-5 h-5 ml-2" />
        העלה קובץ CSV
      </Button>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
        {features.map((feature, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + index * 0.1 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/30 border border-slate-700/50"
          >
            <feature.icon className="w-5 h-5 text-cyan-400 flex-shrink-0" />
            <span className="text-sm text-slate-300">{feature.text}</span>
          </motion.div>
        ))}
      </div>

      {/* Security note */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-12 text-xs text-slate-500 flex items-center gap-2"
      >
        <Shield className="w-4 h-4" />
        הנתונים שלך מאובטחים ונשארים בשליטתך המלאה
      </motion.p>
    </motion.div>
  );
}