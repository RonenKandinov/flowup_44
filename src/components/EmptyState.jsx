import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Lock, ShieldCheck, ArrowUpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EmptyState({ onUploadClick }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full"
      >
        <div className="w-20 h-20 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-6 relative">
          <div className="absolute inset-0 bg-cyan-500/20 rounded-full animate-ping opacity-20" />
          <Upload className="w-8 h-8 text-cyan-400" />
        </div>

        <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">
          ברוכים הבאים ל-FlowUp
        </h2>
        
        <p className="text-slate-400 text-lg mb-8 leading-relaxed">
          מערכת חכמה לחיזוי תזרים מזומנים אישי.<br/>
          העלה קובץ בנקאי וקבל תחזית מדויקת תוך שניות.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex flex-col items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <span className="text-sm text-slate-300 font-medium">פרטיות מלאה</span>
                <span className="text-xs text-slate-500">המידע נשמר אצלך בדפדפן</span>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex flex-col items-center gap-2">
                <ArrowUpCircle className="w-6 h-6 text-purple-400" />
                <span className="text-sm text-slate-300 font-medium">תחזית חכמה</span>
                <span className="text-xs text-slate-500">מנוע היברידי לזיהוי מגמות</span>
            </div>
        </div>

        <Button 
          size="lg" 
          onClick={onUploadClick}
          className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-6 px-8 rounded-xl shadow-lg shadow-cyan-900/20 w-full sm:w-auto transition-all transform hover:scale-105"
        >
          <FileText className="w-5 h-5 ml-2" />
          העלאת קובץ ראשון
        </Button>

        <p className="mt-6 text-xs text-slate-600 flex items-center justify-center gap-1.5">
          <Lock className="w-3 h-3" />
          מאובטח בתקן הצפנה מתקדם. ללא שליחת מידע לשרת.
        </p>
      </motion.div>
    </div>
  );
}