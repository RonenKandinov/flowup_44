import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ShieldAlert, AlertTriangle, Activity, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ResilienceCard({ metrics }) {
    if (!metrics || !metrics.recommendation) return null;

    const isGreen = metrics.status === 'GREEN';
    const isRed = metrics.status === 'RED';
    
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-5 space-y-4"
        >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                    <ShieldCheck className={cn("w-5 h-5", isGreen ? "text-emerald-400" : isRed ? "text-rose-400" : "text-amber-400")} />
                    <h3 className="text-sm font-semibold text-slate-200">החלטת חיתום (Pilot)</h3>
                </div>
                <div className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold border",
                    isGreen ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
                    isRed ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : 
                    "bg-amber-500/10 text-amber-400 border-amber-500/20"
                )}>
                    {metrics.recommendation}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">רמת ביטחון</span>
                    <div className="text-sm font-medium text-slate-200 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-blue-400" />
                        {metrics.confidence}
                    </div>
                </div>
                <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">מבחן עמידות</span>
                    <div className="text-sm font-medium text-slate-200 flex items-center gap-1.5">
                        {metrics.stressTestPassed === 3 ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        {metrics.stressTestPassed}/3 תרחישים
                    </div>
                </div>
            </div>

            {metrics.forceRedReason && (
                <div className="mt-2 p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-xs font-bold text-rose-400">פסילה אוטומטית</p>
                        <p className="text-[10px] text-rose-300 opacity-80">{metrics.forceRedReason}</p>
                    </div>
                </div>
            )}
            
            <div className="pt-2">
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>כושר החזר (DTI)</span>
                    <span>{metrics.dti}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                        className={cn("h-full rounded-full", metrics.dti > 50 ? "bg-rose-500" : "bg-blue-500")} 
                        style={{ width: `${Math.min(metrics.dti, 100)}%` }}
                    />
                </div>
            </div>
        </motion.div>
    );
}