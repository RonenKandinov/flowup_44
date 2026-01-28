import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Activity, Lock } from 'lucide-react';
import Disclaimer from '@/components/dashboard/Disclaimer';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col relative overflow-hidden text-slate-100 font-sans" dir="rtl">
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
             <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px]" />
             <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-4 text-center max-w-4xl mx-auto w-full">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="mb-8"
            >
                <div className="inline-flex items-center justify-center p-3 mb-6 bg-slate-900/50 border border-slate-700 rounded-2xl shadow-xl backdrop-blur-sm">
                    <Activity className="w-8 h-8 text-cyan-400" />
                </div>
                <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-100 to-cyan-400 mb-6 tracking-tight">
                    FlowUp
                </h1>
                <p className="text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                    מערכת חיזוי פיננסי היברידית
                    <br />
                    <span className="text-sm md:text-base text-slate-500 mt-2 block">
                        חיזוי תזרים חכם • איתור החזרי מס • ניהול סיכונים
                    </span>
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="flex flex-col items-center gap-6 w-full max-w-sm"
            >
                <Link to={createPageUrl('Dashboard')} className="w-full">
                    <Button 
                        size="lg" 
                        className="w-full h-14 text-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 border-0 shadow-lg shadow-cyan-900/20 transition-all hover:scale-[1.02]"
                    >
                        כניסה למערכת
                        <ArrowLeft className="mr-2 h-5 w-5" />
                    </Button>
                </Link>
                
                <div className="grid grid-cols-3 gap-4 w-full text-center">
                    <div className="flex flex-col items-center gap-2">
                         <div className="p-2 bg-slate-900 rounded-full text-emerald-400"><Lock size={16} /></div>
                         <span className="text-[10px] text-slate-500">Local-First</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                         <div className="p-2 bg-slate-900 rounded-full text-purple-400"><Activity size={16} /></div>
                         <span className="text-[10px] text-slate-500">AI Risk Engine</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                         <div className="p-2 bg-slate-900 rounded-full text-blue-400"><Shield size={16} /></div>
                         <span className="text-[10px] text-slate-500">Privacy</span>
                    </div>
                </div>
            </motion.div>
        </div>

        <div className="relative z-10 w-full max-w-2xl mx-auto pb-8 px-4">
             <Disclaimer />
        </div>
    </div>
  );
}