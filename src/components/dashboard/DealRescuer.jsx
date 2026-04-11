import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Crosshair, TrendingUp, Wallet, BrainCircuit, PlayCircle, Loader2, ArrowLeftRight, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function DealRescuer({ onSimulate, baseMetrics }) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisComplete, setAnalysisComplete] = useState(false);
    const [activeStrategy, setActiveStrategy] = useState(null);
    const [generatedStrategies, setGeneratedStrategies] = useState(null);
    const [recommendedStrategyId, setRecommendedStrategyId] = useState(null);

    // Ensure we don't crash if baseMetrics is missing
    const score = baseMetrics?.score || 0;
    const status = baseMetrics?.status || 'GREEN';
    const isUnderperforming = score < 70 || status === 'RED' || status === 'YELLOW';

    const metricsHash = baseMetrics ? `${Math.round(baseMetrics.totalIncome || 0)}-${Math.round(baseMetrics.liquidAssets || 0)}-${Math.round(baseMetrics.totalFixedExpenses || baseMetrics.totalExpenses || 0)}` : '';

    useEffect(() => {
        // Reset analysis when underlying metrics significantly change (e.g. account switch)
        setAnalysisComplete(false);
        setIsAnalyzing(false);
        setActiveStrategy(null);
        setGeneratedStrategies(null);
        if (onSimulate) onSimulate(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [metricsHash]);

    // useEffect removed to prevent automatic loop on reset
    
    // Automatically trigger analysis if score is below a certain threshold or status is RED/ORANGE
    // Or we can just let the user click "Run Deal Rescuer"
    
    const runAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            const income = baseMetrics?.totalIncome || 10000;
            const liquidAssets = baseMetrics?.liquidAssets || 0;
            const fixedExpenses = baseMetrics?.totalFixedExpenses || baseMetrics?.totalExpenses || 0;
            const incomeTrend = baseMetrics?.trends?.income || 0;
            
            const res = await base44.functions.invoke('dealRescuerEngine', {
                userId: baseMetrics?.userId || "ronenk2424@gmail.com",
                principal: 50000,
                baseRate: 0.09,
                income: income,
                liquidAssets: liquidAssets,
                fixedExpenses: fixedExpenses
            });

            if (!res.data || !res.data.success) {
                throw new Error(res.data?.error || "Failed to run analysis");
            }

            if (res.data.isRejected) {
                setIsAnalyzing(false);
                setAnalysisComplete(true);
                setGeneratedStrategies({});
                setRecommendedStrategyId(null);
                if (onSimulate) {
                    onSimulate({
                        ...baseMetrics,
                        score: 30,
                        status: 'RED',
                        message: `נדחה אוטומטית: המדדים אינם עומדים בסף המינימלי`
                    });
                }
                
                base44.functions.invoke('dealRescuerAI', { strategies: {}, context: res.data.context, isRejected: true }).then(aiRes => {
                    if (aiRes?.data?.success && aiRes.data.logic) {
                        setGeneratedStrategies({
                            rejected: {
                                id: 'rejected',
                                title: 'סיבת דחייה',
                                subtitle: 'Automated Rejection',
                                icon: ShieldCheck,
                                color: 'text-red-400',
                                bg: 'bg-red-500/10',
                                border: 'border-red-500/30',
                                strategy: 'לא נמצאה אסטרטגיה העומדת בסיכון הסף.',
                                aiLogic: aiRes.data.logic.rejected?.bullets || [aiRes.data.logic.rejected || "העסקה מסוכנת מדי."],
                                metrics: {}
                            }
                        });
                        setActiveStrategy('rejected');
                    }
                }).catch(err => console.error(err));
                return;
            }

            const { strategies, recommendedStrategyId, recommendedScore, context } = res.data;
            if (recommendedStrategyId) setRecommendedStrategyId(recommendedStrategyId);
            
            const ecoPath = { n: strategies.cash_flow.metrics.term, dp: strategies.cash_flow.metrics.downPayment, pmt: strategies.cash_flow.metrics.pmt, newDSR: strategies.cash_flow.metrics.dsr, rate: strategies.cash_flow.metrics.rate, S_new: strategies.cash_flow.score };
            const secPath = { n: strategies.exposure.metrics.term, dp: strategies.exposure.metrics.downPayment, pmt: strategies.exposure.metrics.pmt, newDSR: strategies.exposure.metrics.dsr, rate: strategies.exposure.metrics.rate, S_new: strategies.exposure.score };
            const aiPath = { n: strategies.behavioral.metrics.term, dp: strategies.behavioral.metrics.downPayment, pmt: strategies.behavioral.metrics.pmt, newDSR: strategies.behavioral.metrics.dsr, rate: strategies.behavioral.metrics.rate, S_new: strategies.behavioral.score };

            setGeneratedStrategies({
                cash_flow: {
                    id: 'cash_flow',
                    title: 'התאמת החזר',
                    subtitle: 'Lowest Monthly Payment',
                    icon: ArrowLeftRight,
                    color: 'text-blue-400',
                    bg: 'bg-blue-500/10',
                    border: 'border-blue-500/30',
                    strategy: `כלכלי: ${ecoPath.n} חוד', ${Math.round(ecoPath.dp).toLocaleString()}₪ מקדמה, ריבית ${((ecoPath.rate || 0) * 100).toFixed(1)}%.`,
                    aiLogic: null,
                    simulatedBoost: Math.min(100 - score, Math.round(ecoPath.S_new / 2)),
                    metrics: ecoPath
                },
                exposure: {
                    id: 'exposure',
                    title: 'הפחתת חשיפה',
                    subtitle: 'Exposure Reduction',
                    icon: Wallet,
                    color: 'text-emerald-400',
                    bg: 'bg-emerald-500/10',
                    border: 'border-emerald-500/30',
                    strategy: `ביטחון: ${secPath.n} חוד', ${Math.round(secPath.dp).toLocaleString()}₪ מקדמה, ריבית ${((secPath.rate || 0) * 100).toFixed(1)}%.`,
                    aiLogic: null,
                    simulatedBoost: Math.min(100 - score, Math.round(secPath.S_new / 2)),
                    metrics: secPath
                },
                behavioral: {
                    id: 'behavioral',
                    title: 'אופטימלי',
                    subtitle: 'AI Optimal Path',
                    icon: Activity,
                    color: 'text-purple-400',
                    bg: 'bg-purple-500/10',
                    border: 'border-purple-500/30',
                    strategy: `אופטימלי: ${aiPath.n} חוד', ${Math.round(aiPath.dp).toLocaleString()}₪ מקדמה, ריבית ${((aiPath.rate || 0) * 100).toFixed(1)}%.`,
                    aiLogic: null,
                    simulatedBoost: Math.min(100 - score, Math.round(aiPath.S_new / 2)),
                    metrics: aiPath
                }
            });
            setIsAnalyzing(false);
            setAnalysisComplete(true);
            const bestStrat = recommendedStrategyId || 'cash_flow';
            setActiveStrategy(bestStrat);
            
            if (onSimulate) {
                onSimulate({
                    ...baseMetrics,
                    score: recommendedScore || 85,
                    status: 'GREEN'
                });
            }

            // Fetch AI logic in the background
            base44.functions.invoke('dealRescuerAI', { strategies, context }).then(aiRes => {
                if (aiRes?.data?.success && aiRes.data.logic) {
                    const extractBullets = (logicData) => {
                        if (!logicData) return ["מסלול מאושר בהתאם לפרמטרים."];
                        if (logicData.bullets && Array.isArray(logicData.bullets)) return logicData.bullets;
                        if (typeof logicData === 'string') {
                            const split = logicData.split('\n').filter(l => l.trim().length > 0).map(l => l.replace(/^[-*•]\s*/, '').trim());
                            return split.length > 0 ? split : [logicData];
                        }
                        return ["מסלול מאושר בהתאם לפרמטרים."];
                    };

                    setGeneratedStrategies(prev => ({
                        ...prev,
                        cash_flow: { ...prev.cash_flow, aiLogic: extractBullets(aiRes.data.logic.cash_flow) },
                        exposure: { ...prev.exposure, aiLogic: extractBullets(aiRes.data.logic.exposure) },
                        behavioral: { ...prev.behavioral, aiLogic: extractBullets(aiRes.data.logic.behavioral) }
                    }));
                }
            }).catch(err => console.error("AI Logic fetch error:", err));

        } catch (err) {
            console.error('Analysis error:', err);
            toast.error('שגיאה בניתוח הנתונים');
            setIsAnalyzing(false);
        }
    };

    const strategies = generatedStrategies || {};

    const handleReset = () => {
        setAnalysisComplete(false);
        setActiveStrategy(null);
        if (onSimulate) onSimulate(null);
    };

    const activeStratData = activeStrategy ? strategies[activeStrategy] : null;

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
                    <Button
                        onClick={handleReset}
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-white text-[10px] h-6 px-2"
                    >
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
                        <p className="text-xs text-slate-300 mb-1 font-medium">מערכת הצלת עסקאות</p>
                        <p className="text-[10px] text-slate-500 mb-4 leading-relaxed max-w-[180px] mx-auto">
                            מנוע אופטימיזציה אקטיבית למציאת המבנה הפיננסי המדויק בעזרת AI.
                        </p>
                        <Button 
                            onClick={runAnalysis}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white w-full rounded-lg h-8 text-xs"
                            size="sm"
                        >
                            <PlayCircle className="w-3.5 h-3.5 mr-2 ml-2" />
                            הפעל חילוץ
                        </Button>
                    </div>
                )}

                {isAnalyzing && (
                    <div className="text-center py-8 flex flex-col items-center">
                        <Loader2 className="w-6 h-6 text-cyan-500 animate-spin mb-3" />
                        <p className="text-xs text-cyan-400 font-medium">מנתח תרחישים ב-AI...</p>
                    </div>
                )}

                {analysisComplete && (
                    <div className="flex flex-col h-full animate-in fade-in zoom-in duration-300">


                        {activeStrategy === 'rejected' && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 mb-3 flex items-center justify-center text-red-400 text-xs font-bold">
                                <ShieldCheck className="w-4 h-4 mr-2" />
                                נדחה אוטומטית - סיכון חיתומי גבוה
                            </div>
                        )}

                        <div className={`grid gap-1.5 mb-3 ${activeStrategy === 'rejected' ? 'grid-cols-1' : 'grid-cols-3'}`}>
                            {Object.values(strategies).map((strat) => {
                                const Icon = strat.icon;
                                const isActive = activeStrategy === strat.id;
                                const isRecommended = recommendedStrategyId === strat.id;
                                return (
                                    <button
                                        key={strat.id}
                                        onClick={() => setActiveStrategy(strat.id)}
                                        className={`relative flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                                            isActive 
                                                ? `${strat.bg} ${strat.border} ring-1 ring-cyan-500/30` 
                                                : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800'
                                        } ${isRecommended && !isActive ? 'border-amber-500/30 bg-amber-500/5' : ''}`}
                                    >
                                        {isRecommended && (
                                            <span className="absolute -top-2 bg-amber-500 text-slate-950 text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-lg border border-amber-400 z-10">
                                                נבחר אוטומטית
                                            </span>
                                        )}
                                        <Icon className={`w-4 h-4 mb-1 ${isActive ? strat.color : isRecommended ? 'text-amber-400' : 'text-slate-500'}`} />
                                        <span className={`text-[10px] text-center leading-tight ${isActive || isRecommended ? 'text-white font-medium' : 'text-slate-400'}`}>
                                            {strat.title}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <AnimatePresence mode="wait">
                            {activeStratData && (
                                <motion.div
                                    key={activeStratData.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="flex-1 flex flex-col"
                                >
                                    <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-800/60 flex-1 flex flex-col">
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <div className={`p-1 rounded-md ${activeStratData.bg}`}>
                                                <BrainCircuit className={`w-3.5 h-3.5 ${activeStratData.color}`} />
                                            </div>
                                            <h4 className="text-xs font-medium text-white">נימוק ה-AI</h4>
                                        </div>
                                        
                                        <div className="mb-3 space-y-2">
                                            <p className="text-[10px] text-slate-300 font-medium mb-0.5 border-r-2 border-slate-600 pr-2">האסטרטגיה:</p>
                                            <p className="text-[10px] text-slate-400 pr-2">{activeStratData.strategy}</p>
                                            {activeStratData.metrics?.rate !== undefined && (
                                                <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
                                                    <p className="text-[10px] text-cyan-300">ריבית שנתית</p>
                                                    <p className="text-lg font-bold text-cyan-400">{((activeStratData.metrics.rate || 0) * 100).toFixed(1)}%</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 bg-slate-950/50 rounded-md p-2.5 border border-slate-800">
                                            {!activeStratData.aiLogic ? (
                                                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    טוען נימוקי AI...
                                                </div>
                                            ) : (
                                                <ul className="space-y-2">
                                                    {Array.isArray(activeStratData.aiLogic) ? activeStratData.aiLogic.map((bullet, idx) => (
                                                        <li key={idx} className="flex items-start gap-2 text-[10px] leading-relaxed text-slate-300">
                                                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-cyan-500/50 shrink-0" />
                                                            <span>{bullet}</span>
                                                        </li>
                                                    )) : (
                                                        <li className="text-[10px] leading-relaxed text-slate-300">{activeStratData.aiLogic}</li>
                                                    )}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </motion.div>
    );
}