import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ShieldCheck, Activity, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import Disclaimer from '@/components/dashboard/Disclaimer';

export default function Home() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center space-y-12 relative" dir="rtl">
      
      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6 max-w-2xl mx-auto z-10"
      >
        <div className="inline-block p-3 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-4">
            <Activity className="w-8 h-8 text-cyan-400" />
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 tracking-tight leading-tight">
          FlowUp
        </h1>
        
        <p className="text-xl md:text-2xl text-slate-400 font-light leading-relaxed max-w-xl mx-auto">
          מנוע חיזוי פיננסי היברידי. <br/>
          <span className="text-slate-300">פרטיות מלאה. חישובים מקומיים. שליטה אמיתית.</span>
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <a href={createPageUrl('Dashboard')}>
            <Button size="lg" className="h-14 px-8 text-lg bg-cyan-500 hover:bg-cyan-600 text-black font-bold rounded-full shadow-lg shadow-cyan-500/20 transition-all hover:scale-105">
              כניסה לדאשבורד
              <ArrowLeft className="w-5 h-5 mr-2" />
            </Button>
          </a>
        </div>
      </motion.div>

      {/* Features Grid */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl text-right"
      >
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm">
            <Lock className="w-8 h-8 text-emerald-400 mb-4" />
            <h3 className="text-lg font-bold text-slate-200 mb-2">Local-First Privacy</h3>
            <p className="text-sm text-slate-400">המידע שלך נשאר אצלך. אנחנו לא שומרים נתונים פיננסיים בשרתים שלנו.</p>
        </div>
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm">
            <Activity className="w-8 h-8 text-purple-400 mb-4" />
            <h3 className="text-lg font-bold text-slate-200 mb-2">Hybrid Prediction</h3>
            <p className="text-sm text-slate-400">מנוע חיזוי המשלב ממוצע עונתי עם מגמות אחרונות לדיוק מקסימלי.</p>
        </div>
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm">
            <ShieldCheck className="w-8 h-8 text-cyan-400 mb-4" />
            <h3 className="text-lg font-bold text-slate-200 mb-2">Safety Buffer</h3>
            <p className="text-sm text-slate-400">מקדם ביטחון של 12% המגן עליך מפני הפתעות ותנודות לא צפויות.</p>
        </div>
      </motion.div>

      {/* Footer / Disclaimer */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="w-full max-w-2xl mt-12"
      >
          <Disclaimer />
      </motion.div>

    </div>
  );
}