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

                                {/* Decision Banner - WOW Effect */}
                                <div className={`relative overflow-hidden rounded-xl border p-5 flex items-center justify-between shadow-2xl ${
                                    recommendation.decision === 'APPROVE' ? 'bg-gradient-to-br from-emerald-950/80 to-emerald-900/40 border-emerald-500/50 shadow-emerald-900/20' :
                                    recommendation.decision === 'REVIEW' ? 'bg-gradient-to-br from-amber-950/80 to-amber-900/40 border-amber-500/50 shadow-amber-900/20' :
                                    'bg-gradient-to-br from-red-950/80 to-rose-900/40 border-red-500/50 shadow-red-900/20'
                                }`}>
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10" />
                                    
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className={`p-3 rounded-full flex items-center justify-center shadow-inner ${
                                            recommendation.decision === 'APPROVE' ? 'bg-emerald-500/20 text-emerald-400' :
                                            recommendation.decision === 'REVIEW' ? 'bg-amber-500/20 text-amber-400' :
                                            'bg-red-500/20 text-red-400'
                                        }`}>
                                            {recommendation.decision === 'APPROVE' ? <ShieldCheck className="w-8 h-8" /> :
                                             recommendation.decision === 'REVIEW' ? <AlertTriangle className="w-8 h-8" /> :
                                             <AlertOctagon className="w-8 h-8" />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className={`w-2 h-2 rounded-full animate-pulse ${
                                                    recommendation.decision === 'APPROVE' ? 'bg-emerald-400' :
                                                    recommendation.decision === 'REVIEW' ? 'bg-amber-400' :
                                                    'bg-red-400'
                                                }`} />
                                                <p className="text-[11px] text-slate-300 uppercase font-bold tracking-wider">המלצת מערכת חיתום (AI)</p>
                                            </div>
                                            <p className={`text-3xl font-black tracking-tight ${
                                                recommendation.decision === 'APPROVE' ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]' :
                                                recommendation.decision === 'REVIEW' ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]' :
                                                'text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.4)]'
                                            }`}>
                                                {recommendation.decision === 'APPROVE' ? 'אישור מומלץ' :
                                                 recommendation.decision === 'REVIEW' ? 'בחינה נוספת נדרשת' : 'דחייה מוחלטת'}
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

                                {/* Core Risk Metrics - WOW Effect */}
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

                                {/* Behavior Analysis - WOW Effect */}
                                {llm_analysis?.behavior_analysis && (
                                    <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-transparent via-slate-500/20 to-transparent" />
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <BrainCircuit className="w-4 h-4 text-indigo-400" />
                                                <p className="text-xs text-slate-300 uppercase font-bold tracking-wider">ניתוח התנהגות עומק (AI Deep Scan)</p>
                                            </div>
                                            {llm_analysis.behavior_analysis.trend && (
                                                <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border ${
                                                    llm_analysis.behavior_analysis.trend === 'IMPROVING' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                    llm_analysis.behavior_analysis.trend === 'DETERIORATING' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                    'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                                }`}>
                                                    מגמה: {llm_analysis.behavior_analysis.trend}
                                                </span>
                                            )}
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {llm_analysis.behavior_analysis.key_positive_signals?.length > 0 && (
                                                <div className="bg-emerald-950/20 p-3 rounded-lg border border-emerald-900/30">
                                                    <p className="text-[10px] text-emerald-400 mb-2 uppercase font-bold tracking-wider flex items-center gap-1.5"><TrendingUp className="w-3 h-3"/> חוזקות שזוהו:</p>
                                                    <ul className="space-y-1.5">
                                                        {llm_analysis.behavior_analysis.key_positive_signals.map((sig, i) => (
                                                            <li key={i} className="text-xs text-emerald-100/80 flex items-start gap-2">
                                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0"/>
                                                                <span>{sig}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            {llm_analysis.behavior_analysis.key_risks?.length > 0 && (
                                                <div className="bg-red-950/20 p-3 rounded-lg border border-red-900/30">
                                                    <p className="text-[10px] text-red-400 mb-2 uppercase font-bold tracking-wider flex items-center gap-1.5"><TrendingDown className="w-3 h-3"/> סיכונים לגידור:</p>
                                                    <ul className="space-y-1.5">
                                                        {llm_analysis.behavior_analysis.key_risks.map((risk, i) => (
                                                            <li key={i} className="text-xs text-red-100/80 flex items-start gap-2">
                                                                <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0"/>
                                                                <span>{risk}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Policy Engine Rules - WOW Effect */}
                                {policy_explanations && policy_explanations.length > 0 && (
                                    <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 shadow-inner">
                                        <div className="flex items-center gap-2 mb-3">
                                            <FileText className="w-4 h-4 text-slate-400" />
                                            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">החלטות מנוע מדיניות קשיחה (Policy Engine)</p>
                                        </div>
                                        <div className="space-y-2 font-mono">
                                            {policy_explanations.map((exp, idx) => {
                                                const isReject = exp.includes('נדחה');
                                                const isWarning = exp.includes('בחינה');
                                                const isSecondChance = exp.includes('הזדמנות שנייה');
                                                
                                                let itemBg = "bg-slate-900/50";
                                                let itemBorder = "border-slate-800";
                                                let textColor = "text-slate-300";
                                                let IconCmp = CheckCircle2;
                                                let iconColor = "text-emerald-500";

                                                if (isReject) {
                                                    itemBg = "bg-red-950/30";
                                                    itemBorder = "border-red-900/50";
                                                    textColor = "text-red-200";
                                                    IconCmp = XCircle;
                                                    iconColor = "text-red-500";
                                                } else if (isWarning) {
                                                    itemBg = "bg-amber-950/30";
                                                    itemBorder = "border-amber-900/50";
                                                    textColor = "text-amber-200";
                                                    IconCmp = AlertTriangle;
                                                    iconColor = "text-amber-500";
                                                } else if (isSecondChance) {
                                                    itemBg = "bg-indigo-950/30";
                                                    itemBorder = "border-indigo-900/50";
                                                    textColor = "text-indigo-200";
                                                    IconCmp = Zap;
                                                    iconColor = "text-indigo-500";
                                                }

                                                return (
                                                    <div key={idx} className={`flex items-start gap-3 text-[11px] p-2.5 rounded border ${itemBg} ${itemBorder} transition-colors hover:brightness-110`}>
                                                        <IconCmp className={`w-4 h-4 ${iconColor} shrink-0`} />
                                                        <span className={`${textColor} leading-relaxed`}>{exp}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

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