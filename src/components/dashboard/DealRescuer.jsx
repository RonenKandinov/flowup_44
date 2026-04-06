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

    // Ensure we don't crash if baseMetrics is missing
    const score = baseMetrics?.score || 0;
    const isUnderperforming = score < 60; // Just an example threshold based on the doc
    const status = baseMetrics?.status || 'GREEN';
    
    useEffect(() => {
        if (baseMetrics && !isAnalyzing && !analysisComplete) {
            runAnalysis();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [baseMetrics?.score]);
    
    const runAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            const income = baseMetrics?.totalIncome || 10000;
            const liquidAssets = baseMetrics?.liquidAssets || 0;
            const fixedExpenses = baseMetrics?.totalFixedExpenses || 0;
            const incomeTrend = baseMetrics?.trends?.income || 0;
            
            const res = await base44.functions.invoke('dealRescuerEngine', {
                userId: "ronenk2424@gmail.com",
                principal: 50000,
                baseRate: 0.09
            });

            if (!res.data || !res.data.success) {
                throw new Error(res.data?.error || "Failed to run analysis");
            }

            const { strategies } = res.data;
            
            const ecoPath = { n: strategies.cash_flow.metrics.term, dp: strategies.cash_flow.metrics.downPayment, pmt: strategies.cash_flow.metrics.pmt, newDTI: strategies.cash_flow.metrics.dti, S_new: 85 };
            const secPath = { n: strategies.exposure.metrics.term, dp: strategies.exposure.metrics.downPayment, pmt: strategies.exposure.metrics.pmt, newDTI: strategies.exposure.metrics.dti, S_new: 90 };
            const aiPath = { n: strategies.behavioral.metrics.term, dp: strategies.behavioral.metrics.downPayment, pmt: strategies.behavioral.metrics.pmt, newDTI: strategies.behavioral.metrics.dti, S_new: 95 };

            // Helper to safely extract bullets from various possible AI return formats
            const extractBullets = (logicData) => {
                if (!logicData) return ["מסלול מאושר בהתאם לפרמטרים."];
                if (logicData.bullets && Array.isArray(logicData.bullets)) return logicData.bullets;
                if (typeof logicData === 'string') {
                    const split = logicData.split('\n').filter(l => l.trim().length > 0).map(l => l.replace(/^[-*•]\s*/, '').trim());
                    return split.length > 0 ? split : [logicData];
                }
                return ["מסלול מאושר בהתאם לפרמטרים."];
            };

            const aiLogics = {
                cash_flow: extractBullets(strategies.cash_flow.logic),
                exposure: extractBullets(strategies.exposure.logic),
                behavioral: extractBullets(strategies.behavioral.logic)
            };

            setGeneratedStrategies({
                cash_flow: {
                    id: 'cash_flow',
                    title: 'התאמת החזר',
                    subtitle: 'Lowest Monthly Payment',
                    icon: ArrowLeftRight,
                    color: 'text-blue-400',
                    bg: 'bg-blue-500/10',
                    border: 'border-blue-500/30',
                    strategy: `כלכלי: ${ecoPath.n} חוד', ${Math.round(ecoPath.dp).toLocaleString()}₪ מקדמה.`,
                    aiLogic: aiLogics.cash_flow,
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
                    strategy: `ביטחון: ${secPath.n} חוד', ${Math.round(secPath.dp).toLocaleString()}₪ מקדמה.`,
                    aiLogic: aiLogics.exposure,
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
                    strategy: `AI: ${aiPath.n} חוד', ${Math.round(aiPath.dp).toLocaleString()}₪ מקדמה.`,
                    aiLogic: aiLogics.behavioral,
                    simulatedBoost: Math.min(100 - score, Math.round(aiPath.S_new / 2)),
                    metrics: aiPath
                }
            });
            setIsAnalyzing(false);
            setAnalysisComplete(true);
            setActiveStrategy('cash_flow');
        } catch (err) {
            console.error('LLM error:', err);
            toast.error('שגיאה בניתוח AI');
            setIsAnalyzing(false);
        }
    };

    const strategies = generatedStrategies || {};

    const handleApplyStrategy = (stratKey) => {
        if (!baseMetrics) return;
        const strat = strategies[stratKey];
        
        toast.success(`מפעיל אסטרטגיה: ${strat.title}`);
        
        // Mock a simulation boost to show on the dashboard
        if (onSimulate) {
            onSimulate({
                ...baseMetrics,
                score: Math.min(100, baseMetrics.score + strat.simulatedBoost),
                status: 'GREEN', // Deal Rescuer converts to Green
                message: `עסקה חולצה בהצלחה ע"י אסטרטגית ${strat.title}`
            });
        }
    };

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
                        <div className="grid grid-cols-3 gap-1.5 mb-3">
                            {Object.values(strategies).map((strat) => {
                                const Icon = strat.icon;
                                const isActive = activeStrategy === strat.id;
                                return (
                                    <button
                                        key={strat.id}
                                        onClick={() => setActiveStrategy(strat.id)}
                                        className={`flex flex-col items-center justify-center p-1.5 rounded-lg border transition-all ${
                                            isActive 
                                                ? `${strat.bg} ${strat.border}` 
                                                : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800'
                                        }`}
                                    >
                                        <Icon className={`w-4 h-4 mb-1 ${isActive ? strat.color : 'text-slate-500'}`} />
                                        <span className={`text-[9px] text-center leading-tight ${isActive ? 'text-white font-medium' : 'text-slate-400'}`}>
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
                                        
                                        <div className="mb-2">
                                            <p className="text-[10px] text-slate-300 font-medium mb-0.5 border-r-2 border-slate-600 pr-2">האסטרטגיה:</p>
                                            <p className="text-[10px] text-slate-400 pr-2">{activeStratData.strategy}</p>
                                        </div>

                                        <div className="flex-1 bg-slate-950/50 rounded-md p-2.5 border border-slate-800">
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
                                        </div>
                                    </div>

                                    <Button 
                                        onClick={() => handleApplyStrategy(activeStrategy)}
                                        className="w-full mt-3 bg-white hover:bg-slate-200 text-slate-900 rounded-lg h-8 text-xs font-bold"
                                    >
                                        <ShieldCheck className="w-3.5 h-3.5 mr-2 ml-2" />
                                        החל מסלול
                                    </Button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </motion.div>
    );
}