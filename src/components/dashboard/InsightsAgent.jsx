import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, AlertTriangle, BrainCircuit, Activity, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InsightsAgent({ analysis }) {
    const [isOpen, setIsOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) setIsOpen(false);
            else setIsOpen(true);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) {
        return (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center h-full min-h-[200px]">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-white font-medium">האנליסט מעבד נתונים...</h3>
                <p className="text-slate-500 text-sm mt-1">מנתח יכולת החזר והתחייבויות קשיחות.</p>
            </div>
        );
    }

    return (
        <div className="relative h-full">
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-indigo-500/20 rounded-xl overflow-hidden shadow-lg shadow-indigo-900/5 h-full flex flex-col">
                <div 
                    className={`px-4 py-3 border-b border-slate-800/60 bg-slate-900/50 flex justify-between items-center ${isMobile ? 'cursor-pointer hover:bg-slate-800' : ''}`}
                    onClick={() => isMobile && setIsOpen(!isOpen)}
                >
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <div className="absolute inset-0 bg-indigo-500 blur-sm opacity-20 animate-pulse rounded-full" />
                            <BrainCircuit className="w-5 h-5 text-indigo-400 relative z-10" />
                        </div>
                        <span className="text-sm font-semibold text-slate-200">FlowUp AI Analyst</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/30 px-2 py-0.5 rounded-full border border-indigo-900/30" dir="ltr">
                            DTI: {analysis.metrics?.structural_dti || 0}%
                        </span>
                        {isMobile && (
                            isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                    </div>
                </div>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div 
                            initial={isMobile ? { height: 0, opacity: 0 } : false}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={isMobile ? { height: 0, opacity: 0 } : false}
                            className="overflow-hidden flex-1 flex flex-col"
                        >
                            <div className="p-4 flex-1 flex flex-col space-y-4 overflow-y-auto max-h-[400px] custom-scrollbar text-left" dir="ltr">
                                <div>
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <Activity className="w-4 h-4 text-indigo-400" />
                                        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Risk Assessment</h4>
                                    </div>
                                    <p className="text-sm text-slate-400 leading-relaxed bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                                        {analysis.risk_assessment}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/50">
                                        <p className="text-[10px] text-slate-500 mb-0.5">Structural DTI</p>
                                        <p className="text-sm font-mono text-white">{analysis.metrics?.structural_dti || 0}%</p>
                                    </div>
                                    <div className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/50">
                                        <p className="text-[10px] text-slate-500 mb-0.5">Adjusted DTI</p>
                                        <p className="text-sm font-mono text-emerald-400">{analysis.metrics?.adjusted_dti || 0}%</p>
                                    </div>
                                    <div className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/50">
                                        <p className="text-[10px] text-slate-500 mb-0.5">Liquidity Buffer</p>
                                        <p className="text-sm font-mono text-white">{analysis.metrics?.liquidity_buffer_months || 0} mo</p>
                                    </div>
                                    <div className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/50">
                                        <p className="text-[10px] text-slate-500 mb-0.5">Income Volatility</p>
                                        <p className="text-sm font-mono text-amber-400">{analysis.metrics?.income_volatility || 0}</p>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <FileText className="w-4 h-4 text-indigo-400" />
                                        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Capacity Interpretation</h4>
                                    </div>
                                    <p className="text-sm text-slate-400 leading-relaxed bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                                        {analysis.capacity_interpretation}
                                    </p>
                                </div>

                                <div>
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <Activity className="w-4 h-4 text-indigo-400" />
                                        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Stability & Liquidity</h4>
                                    </div>
                                    <p className="text-sm text-slate-400 leading-relaxed bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                                        <span className="block mb-2">{analysis.stability_assessment}</span>
                                        <span>{analysis.liquidity_analysis}</span>
                                    </p>
                                </div>

                                <div>
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <FileText className="w-4 h-4 text-indigo-400" />
                                        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Approval Rationale</h4>
                                    </div>
                                    <p className="text-sm text-slate-400 leading-relaxed bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                                        {analysis.approval_rationale}
                                    </p>
                                </div>
                                
                                <div className="bg-indigo-900/20 p-3 rounded-lg border border-indigo-500/20">
                                    <p className="text-[10px] text-indigo-300 uppercase tracking-wider mb-1">Recommended Structure</p>
                                    <p className="text-sm text-indigo-100 font-medium">{analysis.recommended_structure}</p>
                                </div>

                                {analysis.risk_flags && analysis.risk_flags.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertTriangle className="w-4 h-4 text-red-400" />
                                            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Risk Flags</h4>
                                        </div>
                                        <ul className="space-y-1.5">
                                            {analysis.risk_flags.map((flag, idx) => (
                                                <li key={idx} className="text-xs text-red-200/80 bg-red-950/20 px-2 py-1.5 rounded flex items-start gap-2">
                                                    <span className="text-red-500 mt-0.5">•</span>
                                                    <span>{flag}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}