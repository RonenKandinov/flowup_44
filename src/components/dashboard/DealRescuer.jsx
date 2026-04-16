import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Crosshair, BrainCircuit, PlayCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function DealRescuer({ onSimulate, baseMetrics }) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisComplete, setAnalysisComplete] = useState(false);
    const [result, setResult] = useState(null);

    // Ensure we don't crash if baseMetrics is missing
    const score = baseMetrics?.score || 0;
    const status = baseMetrics?.status || 'GREEN';
    const isUnderperforming = score < 70 || status === 'RED' || status === 'YELLOW';

    const metricsHash = baseMetrics ? `${Math.round(baseMetrics.totalIncome || 0)}-${Math.round(baseMetrics.liquidAssets || 0)}-${Math.round(baseMetrics.totalFixedExpenses || baseMetrics.totalExpenses || 0)}` : '';

    useEffect(() => {
        // Reset analysis when underlying metrics significantly change (e.g. account switch)
        setAnalysisComplete(false);
        setIsAnalyzing(false);
        setResult(null);
        if (onSimulate) onSimulate(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [metricsHash]);

    // useEffect removed to prevent automatic loop on reset
    
    // Automatically trigger analysis if score is below a certain threshold or status is RED/ORANGE
    // Or we can just let the user click "Run Deal Rescuer"
    
    const runAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            const income = baseMetrics?.totalIncome || 0;
            const liquidAssets = baseMetrics?.liquidAssets || 0;
            const fixedExpenses = baseMetrics?.totalExpenses || baseMetrics?.totalFixedExpenses || 0;

            const res = await base44.functions.invoke('dealRescuerEngine', {
                principal: 50000,
                durationMonths: 48,
                baseRate: 0.09,
                income,
                liquidAssets,
                fixedExpenses,
                dsr: baseMetrics?.dsr,
                score: baseMetrics?.score,
                currentStatus: score < 55 ? 'rejected' : score < 75 ? 'borderline' : 'approved',
                projectedEomBalance: baseMetrics?.projectedEOM || 0,
                riskStatus: baseMetrics?.status,
                forecastConfidence: baseMetrics?.confidence || 50,
                avgDailySpending: baseMetrics?.avgDailySpending || 0,
                riskDay: baseMetrics?.riskDay || null
            });

            if (!res.data?.after) {
                throw new Error(res.data?.error || 'Failed to run analysis');
            }

            setResult(res.data);
            setAnalysisComplete(true);

            if (onSimulate) {
                onSimulate({
                    ...baseMetrics,
                    score: res.data.after.score,
                    dsr: res.data.after.dsr,
                    status: res.data.after.status === 'likely_approved' ? 'GREEN' : res.data.after.status === 'conditionally_approved' || res.data.after.status === 'improved' ? 'ORANGE' : 'RED'
                });
            }
        } catch (err) {
            console.error('Analysis error:', err);
            toast.error('שגיאה בניתוח הנתונים');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleReset = () => {
        setAnalysisComplete(false);
        setResult(null);
        if (onSimulate) onSimulate(null);
    };

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

                {analysisComplete && result && (
                    <div className="flex flex-col h-full animate-in fade-in zoom-in duration-300">
                        <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-800/60 flex-1 flex flex-col gap-3">
                            <div className="flex items-center gap-1.5">
                                <div className="p-1 rounded-md bg-cyan-500/10">
                                    <BrainCircuit className="w-3.5 h-3.5 text-cyan-400" />
                                </div>
                                <h4 className="text-sm font-semibold text-white">תרחיש חילוץ מיטבי</h4>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-2">
                                    <div className="text-slate-400 mb-1">לפני</div>
                                    <div className="text-white">סטטוס: {result.before.status}</div>
                                    <div className="text-white">DSR: {result.before.dsr}%</div>
                                    <div className="text-white">Score: {result.before.score}</div>
                                </div>
                                <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-2">
                                    <div className="text-slate-400 mb-1">אחרי</div>
                                    <div className="text-white">סטטוס: {result.after.status}</div>
                                    <div className="text-white">DSR: {result.after.dsr}%</div>
                                    <div className="text-white">Score: {result.after.score}</div>
                                </div>
                            </div>

                            <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-2 text-sm text-slate-200 leading-6">
                                <div>תקופה: {result.after.duration_months} חודשים</div>
                                <div>החזר חודשי: ₪{Number(result.after.monthly_payment || 0).toLocaleString('he-IL')}</div>
                                <div>{result.impact.dsr_change <= 0 ? 'שיפור DSR' : 'עליית DSR'}: {Math.abs(result.impact.dsr_change)}%</div>
                                <div>שיפור הסתברות אישור: {result.impact.approval_probability_increase}</div>
                            </div>

                            <div className="rounded-lg bg-cyan-500/5 border border-cyan-500/20 p-2 text-sm text-slate-100 leading-6">
                                {result.explanation}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
}