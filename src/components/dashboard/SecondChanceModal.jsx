import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, CheckCircle2, AlertTriangle, TrendingUp, ShieldCheck } from 'lucide-react';

export default function SecondChanceModal({ analysis, onClose }) {
    const { second_chance_analysis, metrics, analyst_recommendation, llm_analysis } = analysis || {};
    const sc = second_chance_analysis;
    if (!sc) return null;

    const score = sc.score ?? 0;
    const reasons = sc.reasons || [];
    const flags = sc.flags || [];
    const scoreColor = score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-red-400';
    const scoreBg = score >= 70 ? 'from-emerald-900/40 to-slate-900' : score >= 40 ? 'from-amber-900/40 to-slate-900' : 'from-red-900/40 to-slate-900';
    const recommendation = analyst_recommendation?.recommendation?.decision || 'REVIEW';

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.92, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.92, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="bg-slate-900 border border-indigo-500/30 rounded-2xl w-full max-w-md shadow-2xl shadow-indigo-900/20 overflow-hidden"
                    onClick={e => e.stopPropagation()}
                    dir="rtl"
                >
                    {/* Header */}
                    <div className={`bg-gradient-to-br ${scoreBg} px-5 py-4 flex items-center justify-between border-b border-slate-800`}>
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
                                <Zap className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-bold">מנגנון הזדמנות שנייה</p>
                                <p className="text-white font-semibold text-sm">Second Chance Analysis</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Score */}
                    <div className="px-5 py-5 flex items-center gap-5 border-b border-slate-800/60">
                        <div className="relative w-20 h-20 shrink-0">
                            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3" />
                                <circle
                                    cx="18" cy="18" r="15.9" fill="none"
                                    stroke={score >= 70 ? '#34d399' : score >= 40 ? '#fbbf24' : '#f87171'}
                                    strokeWidth="3"
                                    strokeDasharray={`${score} ${100 - score}`}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className={`text-xl font-bold ${scoreColor}`}>{score}</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-slate-400 text-xs mb-1">ציון הזדמנות שנייה</p>
                            <p className={`text-2xl font-bold ${scoreColor}`}>
                                {score >= 70 ? 'גבוה' : score >= 40 ? 'בינוני' : 'נמוך'}
                            </p>
                            <p className="text-slate-500 text-xs mt-1">
                                {score >= 70 ? 'ממליץ לשקול אישור — גורמים מפצים חזקים' :
                                 score >= 40 ? 'שוקל אישור חלקי — עם תנאים מותאמי סיכון' :
                                 'לא מצדיק עקיפת מדיניות — סיכון גבוה'}
                            </p>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="px-5 py-4 space-y-4 max-h-[55vh] overflow-y-auto">

                        {/* Reasons — why eligible */}
                        {reasons.length > 0 && (
                            <div>
                                <p className="text-[10px] text-emerald-400/80 uppercase font-bold mb-2 flex items-center gap-1.5">
                                    <TrendingUp className="w-3 h-3" /> גורמים מפצים שהפעילו את המנגנון
                                </p>
                                <ul className="space-y-1.5">
                                    {reasons.map((r, i) => (
                                        <li key={i} className="flex items-start gap-2 bg-emerald-900/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                                            <span className="text-xs text-slate-300">{r}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Risk flags remaining */}
                        {flags.length > 0 && (
                            <div>
                                <p className="text-[10px] text-amber-400/80 uppercase font-bold mb-2 flex items-center gap-1.5">
                                    <AlertTriangle className="w-3 h-3" /> גורמי סיכון שנותרו (לתשומת ליבך)
                                </p>
                                <ul className="space-y-1.5">
                                    {flags.map((f, i) => (
                                        <li key={i} className="flex items-start gap-2 bg-amber-900/10 border border-amber-500/20 rounded-lg px-3 py-2">
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                                            <span className="text-xs text-slate-300">{f}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Key metrics for analyst */}
                        {metrics && (
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-2 flex items-center gap-1.5">
                                    <ShieldCheck className="w-3 h-3" /> מדדים קריטיים לאנליסט
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-slate-800/50 rounded-lg p-2.5 text-center">
                                        <p className="text-[10px] text-slate-500">DTI</p>
                                        <p className="text-sm font-bold text-white">{metrics.dti ?? 0}%</p>
                                    </div>
                                    <div className="bg-slate-800/50 rounded-lg p-2.5 text-center">
                                        <p className="text-[10px] text-slate-500">DSR</p>
                                        <p className="text-sm font-bold text-white">{metrics.expense_to_income_ratio ?? 0}%</p>
                                    </div>
                                    <div className="bg-slate-800/50 rounded-lg p-2.5 text-center">
                                        <p className="text-[10px] text-slate-500">נזילות</p>
                                        <p className="text-sm font-bold text-white">{metrics.liquidity_months ?? 0}m</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* LLM override reason */}
                        {llm_analysis?.override_analysis?.conditions_for_approval && (
                            <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-3">
                                <p className="text-[10px] text-indigo-400/80 uppercase font-bold mb-1">המלצת AI לאנליסט — תנאים לאישור</p>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    {llm_analysis.override_analysis.conditions_for_approval}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer CTA */}
                    <div className="px-5 py-4 border-t border-slate-800/60 bg-slate-950/30 flex items-center justify-between gap-3">
                        <p className="text-[10px] text-slate-600">החלטה סופית נתונה לשיקול האנליסט בלבד</p>
                        <button
                            onClick={onClose}
                            className="bg-indigo-600 hover:bg-indigo-500 transition-colors text-white text-xs font-semibold px-4 py-2 rounded-lg"
                        >
                            הבנתי
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}