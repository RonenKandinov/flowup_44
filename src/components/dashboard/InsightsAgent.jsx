import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, AlertTriangle, BrainCircuit, Activity, FileText, CheckCircle2, XCircle, Zap, ShieldCheck, AlertOctagon, TrendingUp, TrendingDown, Target, Focus } from 'lucide-react';
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
        behaviorSignals,
        llm_analysis
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
                            FlowUp AI Analyst
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
                                </div>

                                {/* False Negative Banner */}
                                {llm_analysis?.is_false_negative && (
                                    <div className="bg-fuchsia-900/30 border border-fuchsia-500/30 p-3 rounded-lg flex items-start gap-3">
                                        <BrainCircuit className="w-5 h-5 text-fuchsia-400 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold text-fuchsia-300">זיהוי False Negative (שגיאת מדיניות)</p>
                                            <p className="text-xs text-fuchsia-200/80 mt-1">מערכת ה-AI זיהתה שהלקוח נדחה בגלל "סיבה טכנית", למרות התנהגות פיננסית חיובית המצדיקה אישור.</p>
                                            {llm_analysis.override_analysis?.reason && (
                                                <p className="text-xs text-fuchsia-300 mt-2 font-medium bg-fuchsia-950/50 p-2 rounded border-l-2 border-fuchsia-500">"{llm_analysis.override_analysis.reason}"</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Second Chance Banner */}
                                {!llm_analysis?.is_false_negative && second_chance_analysis?.eligible && (
                                    <div className="bg-indigo-900/30 border border-indigo-500/30 p-3 rounded-lg flex items-start gap-3">
                                        <Zap className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold text-indigo-300">הזדמנות שנייה (Second Chance)</p>
                                            <p className="text-xs text-indigo-200/80 mt-1">הלקוח קיבל שדרוג בדירוג הסיכון בזכות התנהלות פיננסית חיובית המפצה על נתונים יבשים חלשים.</p>
                                        </div>
                                    </div>
                                )}

                                {/* Core Risk Metrics */}
                                <div className="grid grid-cols-3 gap-3 mt-2">
                                    <EnhancedMetricBox 
                                        label="DTI (יחס החזר)" 
                                        value={`${metrics?.dti ?? 0}%`} 
                                        isDanger={(metrics?.dti ?? 0) > 40}
                                        isWarning={(metrics?.dti ?? 0) > 30}
                                        icon={Target}
                                    />
                                    <EnhancedMetricBox 
                                        label="DSR (הוצאות/הכנסות)" 
                                        value={`${metrics?.expense_to_income_ratio ?? 0}%`} 
                                        isDanger={(metrics?.expense_to_income_ratio ?? 0) > 90}
                                        isWarning={(metrics?.expense_to_income_ratio ?? 0) > 75}
                                        icon={Activity}
                                    />
                                    <EnhancedMetricBox 
                                        label="נזילות (חודשים)" 
                                        value={`${metrics?.liquidity_months ?? 0}`} 
                                        isDanger={(metrics?.liquidity_months ?? 0) < 1}
                                        isWarning={(metrics?.liquidity_months ?? 0) < 2}
                                        icon={Zap}
                                        reverseLogic
                                    />
                                </div>

                                <Section title="תקציר מנהלים (Executive Summary)">
                                    {narrative}
                                </Section>

                                {/* Behavior Analysis */}
                                {llm_analysis?.behavior_analysis && (
                                    <div className="bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[10px] text-slate-500 uppercase">ניתוח התנהגות מעמיק</p>
                                            {llm_analysis.behavior_analysis.trend && (
                                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                                    llm_analysis.behavior_analysis.trend === 'IMPROVING' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    llm_analysis.behavior_analysis.trend === 'DETERIORATING' ? 'bg-red-500/20 text-red-400' :
                                                    'bg-slate-500/20 text-slate-400'
                                                }`}>{llm_analysis.behavior_analysis.trend}</span>
                                            )}
                                        </div>
                                        {llm_analysis.behavior_analysis.key_positive_signals?.length > 0 && (
                                            <div className="mb-2">
                                                <p className="text-[10px] text-emerald-400/80 mb-1 uppercase font-bold">סיגנלים חיוביים:</p>
                                                <ul className="space-y-1">
                                                    {llm_analysis.behavior_analysis.key_positive_signals.map((sig, i) => (
                                                        <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0"/>{sig}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {llm_analysis.behavior_analysis.key_risks?.length > 0 && (
                                            <div>
                                                <p className="text-[10px] text-red-400/80 mb-1 uppercase font-bold">סיכונים לגידור:</p>
                                                <ul className="space-y-1">
                                                    {llm_analysis.behavior_analysis.key_risks.map((risk, i) => (
                                                        <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5"><XCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0"/>{risk}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Removed Policy Engine explanations as requested */}

                                {/* Strengths */}
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

function EnhancedMetricBox({ label, value, isDanger, isWarning, icon: Icon, reverseLogic }) {
    // For Liquidity (reverseLogic), Danger is when value is LOW.
    let statusColor = "text-emerald-400";
    let bgGlow = "bg-emerald-400/10";
    let borderColor = "border-emerald-500/20";
    let barColor = "bg-emerald-500";
    
    if (isDanger) {
        statusColor = "text-red-400";
        bgGlow = "bg-red-400/10";
        borderColor = "border-red-500/30";
        barColor = "bg-red-500";
    } else if (isWarning) {
        statusColor = "text-amber-400";
        bgGlow = "bg-amber-400/10";
        borderColor = "border-amber-500/30";
        barColor = "bg-amber-500";
    }

    return (
        <div className={`relative overflow-hidden bg-slate-900/60 p-3 rounded-xl border ${borderColor} shadow-sm flex flex-col justify-between group hover:bg-slate-800/80 transition-colors`}>
            <div className={`absolute top-0 right-0 w-16 h-16 ${bgGlow} rounded-full blur-2xl -mr-8 -mt-8 transition-opacity group-hover:opacity-100 opacity-50`} />
            <div className="flex items-center justify-between mb-2 relative z-10">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{label}</p>
                {Icon && <Icon className={`w-3.5 h-3.5 ${statusColor} opacity-70`} />}
            </div>
            <div className="relative z-10">
                <p className={`text-xl font-black font-mono tracking-tight ${statusColor}`}>{value}</p>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full`} style={{ width: isDanger ? '85%' : isWarning ? '60%' : '30%' }} />
                </div>
            </div>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div className={`relative bg-slate-900/40 p-4 rounded-xl border border-slate-700/50 shadow-sm overflow-hidden`}>
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50" />
            <p className="text-xs text-slate-400 uppercase font-bold mb-2 tracking-wider flex items-center gap-2">
                <Focus className="w-3.5 h-3.5 text-indigo-400" /> {title}
            </p>
            <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-line font-medium">
                {children}
            </div>
        </div>
    );
}