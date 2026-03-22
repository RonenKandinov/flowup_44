import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, AlertTriangle, BrainCircuit, Activity, FileText, CheckCircle2, XCircle, Zap } from 'lucide-react';
import ExportDecisionModal from './ExportDecisionModal';

export default function InsightsAgent({ analysis, isLoading }) {
    const [isOpen, setIsOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            setIsOpen(!mobile);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    if (isLoading) {
        return (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center h-full min-h-[200px]">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-white font-medium">האנליסט מעבד נתונים...</h3>
                <p className="text-slate-500 text-sm mt-1">מנתח התנהלות פיננסית וסיכונים.</p>
            </div>
        );
    }

    if (!analysis || analysis.error || !analysis.analyst_recommendation) {
        return (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center h-full min-h-[200px]">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                    <AlertTriangle className="w-6 h-6 text-slate-500" />
                </div>
                <h3 className="text-white font-medium">אין מספיק נתונים לניתוח</h3>
                <p className="text-slate-500 text-sm mt-1">לא נמצאו מספיק תנועות שניתן לנתח בשלב זה.</p>
            </div>
        );
    }

    const {
        narrative,
        risk_tier,
        metrics,
        second_chance_analysis,
        analyst_recommendation,
        behaviorSignals
    } = analysis;

    const { recommendation, options, key_risks, strengths, what_to_improve, policy_explanations } = analyst_recommendation;

    return (
        <div className="relative h-full w-full">
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-indigo-500/20 rounded-xl overflow-hidden shadow-lg shadow-indigo-900/5 h-full flex flex-col">

                {/* Header */}
                <div
                    className={`px-4 py-3 border-b border-slate-800/60 bg-slate-900/50 flex justify-between items-center ${isMobile ? 'cursor-pointer hover:bg-slate-800' : ''}`}
                    onClick={() => isMobile && setIsOpen(!isOpen)}
                >
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <div className="absolute inset-0 bg-indigo-500 blur-sm opacity-20 animate-pulse rounded-full" />
                            <BrainCircuit className="w-5 h-5 text-indigo-400 relative z-10" />
                        </div>
                        <span className="text-sm font-semibold text-slate-200">
                            אנליסט אשראי AI
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/30 px-2 py-0.5 rounded-full border border-indigo-900/30">
                            DTI: {metrics?.dti ?? 0}%
                        </span>
                        {isMobile && (
                            isOpen
                                ? <ChevronUp className="w-4 h-4 text-slate-400" />
                                : <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                    </div>
                </div>

                {/* Body */}
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={isMobile ? { height: 0, opacity: 0 } : false}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={isMobile ? { height: 0, opacity: 0 } : false}
                            className="overflow-hidden flex-1 flex flex-col"
                        >
                            <div className="p-4 flex-1 flex flex-col space-y-4 overflow-y-auto">

                                {/* Decision Banner */}
                                <div className={`p-3 rounded-lg border flex items-center justify-between ${
                                    recommendation.decision === 'APPROVE' ? 'bg-emerald-900/20 border-emerald-500/30' :
                                    recommendation.decision === 'REVIEW' ? 'bg-amber-900/20 border-amber-500/30' :
                                    'bg-red-900/20 border-red-500/30'
                                }`}>
                                    <div className="flex items-center gap-3">
                                        {recommendation.decision === 'APPROVE' ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> :
                                         recommendation.decision === 'REVIEW' ? <AlertTriangle className="w-6 h-6 text-amber-400" /> :
                                         <XCircle className="w-6 h-6 text-red-400" />}
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase font-bold">המלצת מערכת</p>
                                            <p className={`text-base font-bold ${
                                                recommendation.decision === 'APPROVE' ? 'text-emerald-400' :
                                                recommendation.decision === 'REVIEW' ? 'text-amber-400' :
                                                'text-red-400'
                                            }`}>
                                                {recommendation.decision === 'APPROVE' ? 'אישור' :
                                                 recommendation.decision === 'REVIEW' ? 'בחינה נוספת' : 'דחייה'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-400 uppercase">רמת ביטחון</p>
                                        <p className="text-xs font-mono text-slate-300">{recommendation.confidence}</p>
                                    </div>
                                </div>

                                {/* Second Chance Banner */}
                                {second_chance_analysis?.eligible && (
                                    <div className="bg-indigo-900/30 border border-indigo-500/30 p-3 rounded-lg flex items-start gap-3">
                                        <Zap className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold text-indigo-300">הזדמנות שנייה (Second Chance)</p>
                                            <p className="text-xs text-indigo-200/80 mt-1">הלקוח קיבל שדרוג בדירוג הסיכון בזכות התנהלות פיננסית חיובית המפצה על נתונים יבשים חלשים.</p>
                                        </div>
                                    </div>
                                )}

                                {/* Metrics */}
                                <div className="grid grid-cols-3 gap-2">
                                    <MetricBox label="DTI (יחס החזר)" value={`${metrics?.dti ?? 0}%`} tooltip="אחוז ההכנסה הפנויה שמופנה להחזר חובות. יחס נמוך הוא טוב יותר." />
                                    <MetricBox label="הוצאות/הכנסות" value={`${metrics?.expense_to_income_ratio ?? 0}%`} tooltip="אחוז ההוצאות מתוך ההכנסות. מעל 100% מעיד על גירעון." />
                                    <MetricBox label="נזילות (חודשים)" value={`${metrics?.liquidity_months ?? 0}`} tooltip="מספר החודשים שהלקוח יכול לשרוד ללא הכנסה, בהתבסס על נכסים נזילים." />
                                </div>

                                <Section title="תקציר מנהלים">
                                    {narrative}
                                </Section>

                                {policy_explanations && policy_explanations.length > 0 && (
                                    <div className="bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                                        <p className="text-[10px] text-slate-500 uppercase mb-2">החלטות מנוע חיתום (Policy Engine)</p>
                                        <ul className="space-y-2">
                                            {policy_explanations.map((exp, idx) => (
                                                <li key={idx} className="flex items-start gap-2 text-sm text-slate-300 bg-slate-900/50 p-2 rounded-md border border-slate-700/30">
                                                    <div className="mt-0.5 shrink-0">
                                                        {exp.includes('נדחה') ? <XCircle className="w-4 h-4 text-red-400" /> : 
                                                         exp.includes('בחינה') ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : 
                                                         exp.includes('הזדמנות שנייה') ? <Zap className="w-4 h-4 text-indigo-400" /> :
                                                         <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                                                    </div>
                                                    <span className="leading-tight">{exp}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Strengths & Risks */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {strengths?.length > 0 && (
                                        <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-lg p-3">
                                            <p className="text-[10px] text-emerald-400/80 uppercase font-bold mb-2">נקודות חוזק</p>
                                            <ul className="space-y-1">
                                                {strengths.map((s, i) => (
                                                    <li key={i} className="text-xs text-emerald-200/90 flex items-center gap-1.5">
                                                        <div className="w-1 h-1 rounded-full bg-emerald-400" />
                                                        {s}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {key_risks?.length > 0 && (
                                        <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-3">
                                            <p className="text-[10px] text-red-400/80 uppercase font-bold mb-2">סיכונים מרכזיים</p>
                                            <ul className="space-y-1">
                                                {key_risks.map((r, i) => (
                                                    <li key={i} className="text-xs text-red-200/90 flex items-center gap-1.5">
                                                        <div className="w-1 h-1 rounded-full bg-red-400" />
                                                        {r}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                {/* How to approve */}
                                {what_to_improve?.length > 0 && recommendation.decision !== 'APPROVE' && (
                                    <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-lg p-3">
                                        <p className="text-[10px] text-indigo-400/80 uppercase font-bold mb-2">תנאים לאישור (איך כן לאשר)</p>
                                        <ul className="space-y-1">
                                            {what_to_improve.map((item, i) => (
                                                <li key={i} className="text-xs text-indigo-200/90 flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-3 h-3 text-indigo-400 shrink-0" />
                                                    <span className="leading-tight">{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Options */}
                                {options && options.length > 0 && (
                                    <details className="group bg-slate-800/30 rounded-lg border border-slate-700/50">
                                        <summary className="flex items-center justify-between p-3 cursor-pointer list-none">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold">מתווי תשלום אפשריים (מקסימום בטוח)</span>
                                            <ChevronDown className="w-4 h-4 text-slate-500 group-open:rotate-180 transition-transform" />
                                        </summary>
                                        <div className="p-3 pt-0 grid grid-cols-1 gap-2">
                                            {options.map((opt, idx) => (
                                                <div key={idx} className="bg-slate-900/80 p-3 rounded-lg border border-slate-700/50 flex flex-col gap-1">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm font-bold text-indigo-300">{opt.decision === 'APPROVE' ? 'מסלול אישור' : opt.decision === 'REVIEW' ? 'מסלול בחינה' : 'דחייה'}</span>
                                                        <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-emerald-400">
                                                            {opt.max_loan_amount > 0 ? `עד ₪${opt.max_loan_amount.toLocaleString()}` : '₪0'}
                                                        </span>
                                                    </div>
                                                    {opt.suggested_interest && (
                                                        <p className="text-xs text-slate-400 mt-1">ריבית מומלצת: {opt.suggested_interest}%</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                )}

                                {/* Export Button */}
                                <div className="pt-2 border-t border-slate-800/60 mt-2 flex justify-end">
                                    <ExportDecisionModal analysis={analysis} />
                                </div>

                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    );
}

/* ---------- Small UI Helpers ---------- */

function MetricBox({ label, value, color = "text-white", tooltip }) {
    return (
        <div className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/50 group relative">
            <p className="text-[10px] text-slate-500 mb-0.5 border-b border-dashed border-slate-600/50 inline-block cursor-help">{label}</p>
            <p className={`text-sm font-mono ${color}`}>{value}</p>
            {tooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-xs text-slate-300 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-center pointer-events-none border border-slate-700">
                    {tooltip}
                </div>
            )}
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div className="bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
            <p className="text-[10px] text-slate-500 uppercase mb-1">{title}</p>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{children}</p>
        </div>
    );
}