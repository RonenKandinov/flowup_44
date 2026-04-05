import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Crosshair, TrendingUp, Wallet, BrainCircuit, PlayCircle, Loader2, ArrowLeftRight, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function DealRescuer({ onSimulate, baseMetrics }) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisComplete, setAnalysisComplete] = useState(false);
    const [activeStrategy, setActiveStrategy] = useState(null);

    // Ensure we don't crash if baseMetrics is missing
    const score = baseMetrics?.score || 0;
    const isUnderperforming = score < 60; // Just an example threshold based on the doc
    const status = baseMetrics?.status || 'GREEN';
    
    // Automatically trigger analysis if score is below a certain threshold or status is RED/ORANGE
    // Or we can just let the user click "Run Deal Rescuer"
    
    const runAnalysis = () => {
        setIsAnalyzing(true);
        // Simulate "Brute Force" and Goal Seek calculations
        setTimeout(() => {
            setIsAnalyzing(false);
            setAnalysisComplete(true);
            setActiveStrategy('cash_flow');
        }, 1500);
    };

    const strategies = {
        cash_flow: {
            id: 'cash_flow',
            title: 'התאמת יכולת החזר',
            subtitle: 'Cash-Flow Alignment',
            icon: ArrowLeftRight,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/30',
            strategy: 'פריסה מחדש של התשלומים להקטנת הנטל החודשי.',
            aiLogic: 'התאמת לוח הסילוקין ליכולת ההחזר הריאלית של הלווה. הפריסה מורידה את יחס ה-DTI לטווח הבטוח, תוך התבססות על מגמת הצמיחה בהכנסותיו.',
            simulatedBoost: 12
        },
        exposure: {
            id: 'exposure',
            title: 'הפחתת חשיפה',
            subtitle: 'Exposure Reduction',
            icon: Wallet,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/30',
            strategy: 'הגדלת המקדמה על בסיס הנזילות הקיימת בחשבון הלקוח.',
            aiLogic: 'צמצום החשיפה של החברה (LTV) על ידי שימוש בנכסים נזילים מזוהים בחשבון. המהלך משפר את יחס הביטחונות ומוריד את רמת הסיכון הכוללת בעסקה.',
            simulatedBoost: 15
        },
        behavioral: {
            id: 'behavioral',
            title: 'אישור מבוסס התנהגות',
            subtitle: 'Behavioral-Based Approval',
            icon: Activity,
            color: 'text-purple-400',
            bg: 'bg-purple-500/10',
            border: 'border-purple-500/30',
            strategy: 'אישור בתנאים המקוריים תוך מתן משקל להתנהלות פיננסית אחראית.',
            aiLogic: "הדחייה המקורית נבעה מ'רעש' תזרימי זמני. האנליזה מראה עמידה מלאה בהתחייבויות ב-11 מתוך 12 החודשים האחרונים. המלצה לאישור על בסיס יציבות התנהגותית.",
            simulatedBoost: 8
        }
    };

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
            className={`relative rounded-xl p-5 border bg-slate-800/30 backdrop-blur-sm transition-all h-full flex flex-col ${
                analysisComplete ? 'border-cyan-500/40 shadow-sm shadow-cyan-500/10' : 'border-slate-700/30'
            }`}
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-white text-sm font-medium flex items-center gap-2 uppercase tracking-wide">
                    <ShieldCheck size={16} className="text-cyan-400" />
                    Deal Rescuer Engine
                </h3>
                {analysisComplete && (
                    <Button
                        onClick={handleReset}
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-white text-xs h-6 px-2"
                    >
                        איפוס חילוץ
                    </Button>
                )}
            </div>

            <div className="flex-1 flex flex-col justify-center">
                {!analysisComplete && !isAnalyzing && (
                    <div className="text-center py-6">
                        <div className="mx-auto w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-700">
                            <Crosshair className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-sm text-slate-300 mb-2 font-medium">מערכת הצלת עסקאות</p>
                        <p className="text-xs text-slate-500 mb-6 leading-relaxed max-w-[200px] mx-auto">
                            מנוע חישוב מתקדם המבצע אופטימיזציה אקטיבית למציאת המבנה הפיננסי המדויק לסגירת העסקה.
                        </p>
                        <Button 
                            onClick={runAnalysis}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white w-full rounded-lg"
                            size="sm"
                        >
                            <PlayCircle className="w-4 h-4 mr-2 ml-2" />
                            הפעל מנוע אופטימיזציה
                        </Button>
                    </div>
                )}

                {isAnalyzing && (
                    <div className="text-center py-10 flex flex-col items-center">
                        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-4" />
                        <p className="text-sm text-cyan-400 font-medium">מריץ Goal Seek...</p>
                        <p className="text-xs text-slate-500 mt-2">מבצע מאות סימולציות במילישניות</p>
                    </div>
                )}

                {analysisComplete && (
                    <div className="flex flex-col h-full animate-in fade-in zoom-in duration-300">
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            {Object.values(strategies).map((strat) => {
                                const Icon = strat.icon;
                                const isActive = activeStrategy === strat.id;
                                return (
                                    <button
                                        key={strat.id}
                                        onClick={() => setActiveStrategy(strat.id)}
                                        className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                                            isActive 
                                                ? `${strat.bg} ${strat.border}` 
                                                : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800'
                                        }`}
                                    >
                                        <Icon className={`w-5 h-5 mb-1.5 ${isActive ? strat.color : 'text-slate-500'}`} />
                                        <span className={`text-[10px] text-center leading-tight ${isActive ? 'text-white font-medium' : 'text-slate-400'}`}>
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
                                    <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800/60 flex-1 flex flex-col">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className={`p-1.5 rounded-md ${activeStratData.bg}`}>
                                                <BrainCircuit className={`w-4 h-4 ${activeStratData.color}`} />
                                            </div>
                                            <h4 className="text-sm font-medium text-white">נימוק ה-AI</h4>
                                        </div>
                                        
                                        <div className="mb-4">
                                            <p className="text-xs text-slate-300 font-medium mb-1 border-r-2 border-slate-600 pr-2">האסטרטגיה:</p>
                                            <p className="text-[11px] text-slate-400 pr-2.5">{activeStratData.strategy}</p>
                                        </div>

                                        <div className="flex-1 bg-slate-950/50 rounded-lg p-3 border border-slate-800">
                                            <p className="text-[11px] leading-relaxed text-slate-300">
                                                "{activeStratData.aiLogic}"
                                            </p>
                                        </div>
                                    </div>

                                    <Button 
                                        onClick={() => handleApplyStrategy(activeStrategy)}
                                        className="w-full mt-4 bg-white hover:bg-slate-200 text-slate-900 rounded-lg h-9"
                                    >
                                        <ShieldCheck className="w-4 h-4 mr-2 ml-2" />
                                        החל מסלול וחילוץ עסקה
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