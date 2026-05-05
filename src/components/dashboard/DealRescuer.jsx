import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Crosshair, PlayCircle, Loader2, CheckCircle2, AlertTriangle, TrendingDown, Wallet, Brain, ArrowLeft, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import CreditJustificationBlock from './CreditJustificationBlock';
import XAIFactorsPanel from './XAIFactorsPanel';
import AggressiveProductCard from './AggressiveProductCard';

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
    },
    stretch_offer: {
        label: 'הצעת Stretch (Tier C)',
        icon: Zap,
        accent: 'text-amber-400',
        ring: 'border-amber-500/40'
    }
};

const STATUS_META = {
    approved: { label: 'אישור', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
    conditional: { label: 'אישור מותנה', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    failed: { label: 'לא עובר', color: 'bg-red-500/15 text-red-300 border-red-500/30' }
};

export default function DealRescuer({ onSimulate, baseMetrics, analysisInsights, cashFlowProfile }) {
    const [step, setStep] = useState('input'); // 'input' | 'analyzing' | 'result'
    const [loanAmount, setLoanAmount] = useState('');
    const [result, setResult] = useState(null);
    const [justifications, setJustifications] = useState([]);
    const [justificationsLoading, setJustificationsLoading] = useState(false);
    const [justificationsError, setJustificationsError] = useState(false);

    const score = baseMetrics?.score || 0;
    // Checking-account balance comes straight from banking data (liquidAssets, as synced by the Open-Banking provider)
    const checkingBalance = Number(baseMetrics?.liquidAssets ?? baseMetrics?.currentBalance ?? baseMetrics?.current_balance ?? 0);
    const maxDownPayment = Math.max(0, Math.floor(checkingBalance * 0.5));

    const metricsHash = baseMetrics ? `${Math.round(baseMetrics.totalIncome || 0)}-${Math.round(baseMetrics.liquidAssets || 0)}-${Math.round(baseMetrics.totalFixedExpenses || baseMetrics.totalExpenses || 0)}` : '';
    const lastHashRef = useRef(metricsHash);

    useEffect(() => {
        // Only reset when the underlying metrics truly change (new data loaded),
        // not on every render. This prevents the "loads and returns to normal" bug.
        if (lastHashRef.current !== metricsHash && lastHashRef.current !== '') {
            setStep('input');
            setResult(null);
            setLoanAmount('');
            if (onSimulate) onSimulate(null);
        }
        lastHashRef.current = metricsHash;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [metricsHash]);

    const runAnalysis = async () => {
        const amount = parseInt(loanAmount, 10);
        if (!amount || amount < 1000) {
            toast.error('יש להזין סכום הלוואה של לפחות ₪1,000');
            return;
        }

        setStep('analyzing');
        try {
            const income = baseMetrics?.totalIncome || 0;
            const existingDebtPayments = baseMetrics?.existingDebtPayments
                ?? baseMetrics?.debtPayments
                ?? baseMetrics?.totalDebtPayments
                ?? Math.round((baseMetrics?.totalFixedExpenses || 0) * 0.4);

            const res = await base44.functions.invoke('dealRescuerEngine', {
                requestedLoanAmount: amount,
                // No requestedTermMonths — engine picks the optimal term from its grid
                baseInterestRate: 0.09,
                income,
                existingDebtPayments,
                maxDownPayment,
                score: baseMetrics?.score,
                currentStatus: score < 55 ? 'rejected' : score < 75 ? 'borderline' : 'approved',
                analysisInsights: analysisInsights || null,
                // Granular OpenFinance cash-flow profile — when present, the engine uses
                // realRepaymentCapacity instead of the (income − 70%) heuristic.
                cashFlowProfile: cashFlowProfile || null
            });

            if (!res.data?.rescueStrategies) {
                throw new Error(res.data?.error || 'Failed to run analysis');
            }

            setResult(res.data);
            setStep('result');

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
            setStep('input');
        }
    };

    const handleReset = () => {
        setStep('input');
        setResult(null);
        setLoanAmount('');
        setJustifications([]);
        setJustificationsLoading(false);
        setJustificationsError(false);
        if (onSimulate) onSimulate(null);
    };

    // Fetch all credit justifications in a single parallel batch as soon as the analysis completes.
    // This replaces N separate round-trips (one per card) with one request that runs the LLM calls
    // in parallel server-side — cutting total latency roughly to the slowest single call instead of
    // the sum of all calls, plus removes N × auth/DB overhead.
    useEffect(() => {
        if (step !== 'result' || !result?.rescueStrategies?.length) return;

        let cancelled = false;
        const strategies = result.rescueStrategies;
        setJustifications(new Array(strategies.length).fill(null));
        setJustificationsLoading(true);
        setJustificationsError(false);

        (async () => {
            try {
                // Send a slim version of analysisInsights — full object can be heavy and the
                // function only needs metrics + tier + flags. Smaller payload = fewer prod errors.
                const slimInsights = analysisInsights ? {
                    metrics: analysisInsights.metrics || null,
                    risk_tier: analysisInsights.risk_tier || null,
                    behavioral_classification: analysisInsights.behavioral_classification || null,
                    risk_flags: Array.isArray(analysisInsights.risk_flags) ? analysisInsights.risk_flags.slice(0, 3) : null
                } : null;

                const res = await base44.functions.invoke('generateCreditJustification', {
                    strategies: strategies.map(s => ({
                        type: s.type,
                        status: s.status,
                        dsr: s.dsr
                    })),
                    analysisInsights: slimInsights,
                    originalStatus: score < 55 ? 'rejected' : score < 75 ? 'borderline' : 'approved',
                    policyThreshold: result?.meta?.dsr_limit || null,
                    // Pass the XAI factors (same ones shown in XAIFactorsPanel) so the LLM
                    // weaves the identified strengths/risks into the Hebrew justification text —
                    // the analyst sees a coherent story instead of two disconnected blocks.
                    xaiFactors: result?.xai_factors || null
                });
                if (cancelled) return;
                if (res.data?.success && Array.isArray(res.data.justifications)) {
                    setJustifications(res.data.justifications);
                } else {
                    console.warn('generateCreditJustification: unexpected response', res?.data);
                    setJustificationsError(true);
                }
            } catch (e) {
                console.error('generateCreditJustification failed:', e?.response?.data || e?.message || e);
                if (!cancelled) setJustificationsError(true);
            } finally {
                if (!cancelled) setJustificationsLoading(false);
            }
        })();

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, result]);

    const analysisComplete = step === 'result' && !!result;
    const formatILS = (n) => `₪${Number(n || 0).toLocaleString('he-IL')}`;

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
                {step === 'input' && (
                    <div className="py-2">
                        <div className="mx-auto w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center mb-3 border border-slate-700">
                            <Crosshair className="w-5 h-5 text-slate-400" />
                        </div>
                        <p className="text-xs text-slate-300 mb-1 font-medium text-center">איזו הלוואה לבדוק?</p>
                        <p className="text-[10px] text-slate-500 mb-4 leading-relaxed text-center">
                            הזן את סכום ההלוואה שהלקוח מבקש. נחפש את 3 המסלולים האופטימליים לאישור — כולל תקופה מיטבית.
                        </p>

                        <div className="space-y-3">
                            <div>
                                <div className="text-[10px] text-slate-400 mb-1">סכום הלוואה (₪)</div>
                                <Input
                                    type="number"
                                    placeholder="לדוגמה: 50000"
                                    value={loanAmount}
                                    onChange={(e) => setLoanAmount(e.target.value)}
                                    className="bg-slate-900/60 border-slate-700 text-white text-sm h-9"
                                    min="1000"
                                    step="1000"
                                />
                            </div>

                            <Button
                                onClick={runAnalysis}
                                className="bg-cyan-600 hover:bg-cyan-500 text-white w-full rounded-lg h-9 text-xs"
                                size="sm"
                                disabled={!loanAmount || parseInt(loanAmount, 10) < 1000}
                            >
                                <PlayCircle className="w-3.5 h-3.5 mr-2 ml-2" />
                                הפעל חילוץ
                                <ArrowLeft className="w-3 h-3 mr-1" />
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'analyzing' && (
                    <div className="text-center py-8 flex flex-col items-center">
                        <Loader2 className="w-6 h-6 text-cyan-500 animate-spin mb-3" />
                        <p className="text-xs text-cyan-400 font-medium">בונה אסטרטגיות חילוץ...</p>
                    </div>
                )}

                {analysisComplete && result && (
                    <div className="flex flex-col gap-3 animate-in fade-in zoom-in duration-300">
                        {/* XAI factors panel — shown once at the top so credit officers can see
                            the WHY behind the engine's decision, regardless of how many strategies returned. */}
                        {result.xai_factors && (result.xai_factors.positive?.length > 0 || result.xai_factors.negative?.length > 0) && (
                            <XAIFactorsPanel factors={result.xai_factors} />
                        )}
                        {result.rescueStrategies.length === 0 && result.fallback && (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100 leading-5">
                                <div className="font-semibold mb-1">הניסיון הקרוב ביותר</div>
                                <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300 mb-2">
                                    <div><div className="text-slate-500 text-[10px]">סכום</div><div className="text-white">{formatILS(result.fallback.closestAttempt.loanAmount)}</div></div>
                                    <div><div className="text-slate-500 text-[10px]">תקופה</div><div className="text-white">{result.fallback.closestAttempt.termMonths} ח׳</div></div>
                                    <div><div className="text-slate-500 text-[10px]">DSR</div><div className="text-red-300">{result.fallback.closestAttempt.dsr}%</div></div>
                                </div>
                                <p className="mb-2 text-amber-200">{result.fallback.whyFailed}</p>

                                {result.fallback.maxApprovableOffer && (
                                    <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2.5 mb-3">
                                        <div className="flex items-center gap-1.5 text-emerald-300 font-semibold mb-1.5">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            הסכום המקסימלי שכן ניתן לאשר
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-200 mb-1.5">
                                            <div><div className="text-slate-500 text-[10px]">סכום מקסימלי</div><div className="text-white font-bold">{formatILS(result.fallback.maxApprovableOffer.loanAmount)}</div></div>
                                            <div><div className="text-slate-500 text-[10px]">תקופה</div><div className="text-white">{result.fallback.maxApprovableOffer.termMonths} ח׳</div></div>
                                            <div><div className="text-slate-500 text-[10px]">החזר חודשי</div><div className="text-white">{formatILS(result.fallback.maxApprovableOffer.monthlyPayment)}</div></div>
                                            <div><div className="text-slate-500 text-[10px]">DSR</div><div className="text-emerald-300">{result.fallback.maxApprovableOffer.dsr}%</div></div>
                                        </div>
                                        <p className="text-[10px] text-emerald-100/80 leading-4">{result.fallback.maxApprovableOffer.note}</p>
                                    </div>
                                )}

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
                                            <div className="flex items-center gap-1.5">
                                                {/* Tier badge intentionally hidden from UI per CTO direction —
                                                    tier is preserved in s.tier for internal pricing/meta only. */}
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusMeta.color} flex items-center gap-1`}>
                                                    {s.status === 'approved' ? <CheckCircle2 className="w-3 h-3" /> : s.status === 'conditional' ? <AlertTriangle className="w-3 h-3" /> : null}
                                                    {statusMeta.label}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300 mb-2">
                                            <div>
                                                <div className="text-slate-500 text-[10px]">סכום</div>
                                                <div className="text-white font-medium">{formatILS(s.loanAmount)}</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500 text-[10px]">תקופה</div>
                                                <div className="text-white font-medium">{s.termMonths} ח׳</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500 text-[10px]">החזר חודשי</div>
                                                <div className="text-white font-medium">{formatILS(s.monthlyPayment)}</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500 text-[10px]">ריבית</div>
                                                <div className="text-white font-medium">{s.interestRate}%</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500 text-[10px]">מקדמה</div>
                                                <div className="text-white font-medium">{s.downPayment > 0 ? formatILS(s.downPayment) : '—'}</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500 text-[10px]">DSR חדש</div>
                                                <div className={`font-medium ${s.dsr <= 40 ? 'text-emerald-300' : s.dsr <= 45 ? 'text-amber-300' : 'text-red-300'}`}>{s.dsr}%</div>
                                            </div>
                                        </div>

                                        {/* Profitability label hidden from UI per CTO direction —
                                            kept internal in s.profitMargin for engine logic only. */}

                                        <CreditJustificationBlock
                                            aiText={justifications[idx]}
                                            isLoading={justificationsLoading}
                                            error={justificationsError && !justifications[idx]}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Aggressive Approval — rendered as a SEPARATE PRODUCT CARD,
                            not as one more strategy. Distinct framing emphasizes that
                            this offer has its own pricing rules and DSR ceiling. */}
                        {result.aggressiveProduct && (
                            <AggressiveProductCard product={result.aggressiveProduct} />
                        )}
                    </div>
                )}
            </div>
        </motion.div>
    );
}