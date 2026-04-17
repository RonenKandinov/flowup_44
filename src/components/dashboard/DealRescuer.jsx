import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Crosshair, PlayCircle, Loader2, CheckCircle2, AlertTriangle, TrendingDown, Wallet, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

const STRATEGY_META = {
    cash_flow_alignment: {
        label: 'התאמת תזרים',
        icon: Wallet,
        accent: 'text-blue-400',
        ring: 'border-blue-500/30'
    },
    exposure_reduction: {
        label: 'הפחתת חשיפה',
        icon: TrendingDown,
        accent: 'text-emerald-400',
        ring: 'border-emerald-500/30'
    },
    behavioral_approval: {
        label: 'אישור מבוסס התנהגות',
        icon: Brain,
        accent: 'text-purple-400',
        ring: 'border-purple-500/30'
    }
};

const STATUS_META = {
    approved: { label: 'אישור', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
    conditional: { label: 'אישור מותנה', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    failed: { label: 'לא עובר', color: 'bg-red-500/15 text-red-300 border-red-500/30' }
};

export default function DealRescuer({ onSimulate, baseMetrics, analysisInsights }) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState(null);

    const score = baseMetrics?.score || 0;

    const metricsHash = baseMetrics ? `${Math.round(baseMetrics.totalIncome || 0)}-${Math.round(baseMetrics.liquidAssets || 0)}-${Math.round(baseMetrics.totalFixedExpenses || baseMetrics.totalExpenses || 0)}` : '';

    useEffect(() => {
        setIsAnalyzing(false);
        setResult(null);
        if (onSimulate) onSimulate(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [metricsHash]);

    const runAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            const income = baseMetrics?.totalIncome || 0;
            // Existing debt payments only (NOT general expenses) per DSR spec
            const existingDebtPayments = baseMetrics?.existingDebtPayments
                ?? baseMetrics?.debtPayments
                ?? baseMetrics?.totalDebtPayments
                ?? Math.round((baseMetrics?.totalFixedExpenses || 0) * 0.4);

            const res = await base44.functions.invoke('dealRescuerEngine', {
                requestedLoanAmount: 50000,
                requestedTermMonths: 48,
                baseInterestRate: 0.09,
                income,
                existingDebtPayments,
                score: baseMetrics?.score,
                currentStatus: score < 55 ? 'rejected' : score < 75 ? 'borderline' : 'approved',
                analysisInsights: analysisInsights || null
            });

            if (!res.data?.rescueStrategies) {
                throw new Error(res.data?.error || 'Failed to run analysis');
            }

            setResult(res.data);

            const hasWin = res.data.rescueStrategies.some(s => s.status === 'approved' || s.status === 'conditional');
            if (onSimulate && hasWin) {
                onSimulate({
                    ...baseMetrics,
                    score: res.data.after.score,
                    dsr: res.data.after.dsr,
                    status: res.data.after.status === 'approved' ? 'GREEN' : 'ORANGE'
                });
            } else if (onSimulate) {
                onSimulate(null);
            }
        } catch (err) {
            console.error('Analysis error:', err);
            toast.error('שגיאה בניתוח הנתונים');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleReset = () => {
        setResult(null);
        if (onSimulate) onSimulate(null);
    };

    const analysisComplete = !!result;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative rounded-xl p-4 border bg-slate-800/30 backdrop-blur-sm transition-all flex flex-col ${
                analysisComplete ? 'border-cyan-500/40 shadow-sm shadow-cyan-500/10' : 'border-slate-700/30'
            }`}
        >
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-white text-xs font-bold flex items-center gap-1.5 uppercase tracking-wide">
                    <ShieldCheck size={14} className="text-cyan-400" />
                    Deal Rescuer
                </h3>
                {analysisComplete && (
                    <Button onClick={handleReset} variant="ghost" size="sm" className="text-slate-400 hover:text-white text-[10px] h-6 px-2">
                        איפוס
                    </Button>
                )}
            </div>

            <div className="flex-1 flex flex-col justify-center">
                {!analysisComplete && !isAnalyzing && (
                    <div className="text-center py-4">
                        <div className="mx-auto w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center mb-3 border border-slate-700">
                            <Crosshair className="w-5 h-5 text-slate-400" />
                        </div>
                        <p className="text-xs text-slate-300 mb-1 font-medium">3 מסלולים לאישור העסקה</p>
                        <p className="text-[10px] text-slate-500 mb-4 leading-relaxed max-w-[200px] mx-auto">
                            ה-Rescuer בונה עד 3 אסטרטגיות מובחנות על בסיס תובנות ה-Analyst.
                        </p>
                        <Button onClick={runAnalysis} className="bg-cyan-600 hover:bg-cyan-500 text-white w-full rounded-lg h-8 text-xs" size="sm">
                            <PlayCircle className="w-3.5 h-3.5 mr-2 ml-2" />
                            הפעל חילוץ
                        </Button>
                    </div>
                )}

                {isAnalyzing && (
                    <div className="text-center py-8 flex flex-col items-center">
                        <Loader2 className="w-6 h-6 text-cyan-500 animate-spin mb-3" />
                        <p className="text-xs text-cyan-400 font-medium">בונה אסטרטגיות חילוץ...</p>
                    </div>
                )}

                {analysisComplete && result && (
                    <div className="flex flex-col gap-3 animate-in fade-in zoom-in duration-300">
                        <div className={`rounded-lg p-2.5 border text-xs leading-5 ${result.rescueStrategies.length > 0 ? 'bg-cyan-500/5 border-cyan-500/20 text-slate-200' : 'bg-amber-500/5 border-amber-500/20 text-amber-100'}`}>
                            {result.explanation}
                        </div>

                        {result.rescueStrategies.length === 0 && result.fallback && (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100 leading-5">
                                <div className="font-semibold mb-1">הניסיון הקרוב ביותר</div>
                                <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300 mb-2">
                                    <div><div className="text-slate-500 text-[10px]">סכום</div><div className="text-white">₪{result.fallback.closestAttempt.loanAmount.toLocaleString('he-IL')}</div></div>
                                    <div><div className="text-slate-500 text-[10px]">תקופה</div><div className="text-white">{result.fallback.closestAttempt.termMonths} ח׳</div></div>
                                    <div><div className="text-slate-500 text-[10px]">DSR</div><div className="text-red-300">{result.fallback.closestAttempt.dsr}%</div></div>
                                </div>
                                <p className="mb-2 text-amber-200">{result.fallback.whyFailed}</p>
                                <div className="font-semibold text-slate-200 mb-1">דרכים לשיפור:</div>
                                <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                                    {result.fallback.improvements.map((it, i) => <li key={i}>{it}</li>)}
                                </ul>
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            {result.rescueStrategies.map((s, idx) => {
                                const meta = STRATEGY_META[s.type] || { label: s.title, icon: ShieldCheck, accent: 'text-slate-300', ring: 'border-slate-700/40' };
                                const statusMeta = STATUS_META[s.status] || STATUS_META.conditional;
                                const Icon = meta.icon;
                                return (
                                    <div key={`${s.type}-${idx}`} className={`rounded-lg border bg-slate-900/60 p-3 ${meta.ring}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className={`flex items-center gap-1.5 text-xs font-semibold ${meta.accent}`}>
                                                <Icon className="w-3.5 h-3.5" />
                                                {meta.label}
                                            </div>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusMeta.color} flex items-center gap-1`}>
                                                {s.status === 'approved' ? <CheckCircle2 className="w-3 h-3" /> : s.status === 'conditional' ? <AlertTriangle className="w-3 h-3" /> : null}
                                                {statusMeta.label}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300 mb-2">
                                            <div>
                                                <div className="text-slate-500 text-[10px]">סכום</div>
                                                <div className="text-white font-medium">₪{s.loanAmount.toLocaleString('he-IL')}</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500 text-[10px]">תקופה</div>
                                                <div className="text-white font-medium">{s.termMonths} ח׳</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500 text-[10px]">החזר חודשי</div>
                                                <div className="text-white font-medium">₪{s.monthlyPayment.toLocaleString('he-IL')}</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500 text-[10px]">ריבית</div>
                                                <div className="text-white font-medium">{s.interestRate}%</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500 text-[10px]">מקדמה</div>
                                                <div className="text-white font-medium">{s.downPayment > 0 ? `₪${s.downPayment.toLocaleString('he-IL')}` : '—'}</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500 text-[10px]">DSR חדש</div>
                                                <div className={`font-medium ${s.dsr <= 40 ? 'text-emerald-300' : s.dsr <= 45 ? 'text-amber-300' : 'text-red-300'}`}>{s.dsr}%</div>
                                            </div>
                                        </div>

                                        <p className="text-[11px] text-slate-300 leading-5 mb-1.5">{s.reason}</p>
                                        <div className="text-[10px] text-slate-500 border-t border-slate-800 pt-1.5">
                                            <span className="text-slate-400">מבוסס על תובנה: </span>{s.basedOn}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
}