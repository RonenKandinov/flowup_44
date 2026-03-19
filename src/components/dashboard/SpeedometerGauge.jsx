import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Minus, Zap } from 'lucide-react';
import { SystemInfo } from '@/components/utils/forecastingLogic';

/**
 * Maps a score in [0, 100] to a needle angle in [-60, +60].
 * Score 0   → -60° (far left / red)
 * Score 54  → -20° (end of red)
 * Score 55  → -20° (start of orange)
 * Score 79  → +20° (end of orange)
 * Score 80  → +20° (start of green)
 * Score 100 → +60° (far right / green)
 *
 * Special case: score <= 0 is clamped to -60° (hard left).
 */
function scoreToAngle(score) {
    const s = Math.max(0, Math.min(100, score));
    if (s === 0) return -60;
    if (s < 55) {
        // Red zone: 0–54 → -60 to -20
        return -60 + (s / 54) * 40;
    } else if (s < 80) {
        // Orange zone: 55–79 → -20 to +20
        return -20 + ((s - 55) / 24) * 40;
    } else {
        // Green zone: 80–100 → +20 to +60
        return 20 + ((s - 80) / 20) * 40;
    }
}

function scoreToColors(score) {
    if (score < 55) return { color: '#ef4444', glowColor: 'rgba(239,68,68,0.5)', statusColor: 'red' };
    if (score < 80) return { color: '#f97316', glowColor: 'rgba(249,115,22,0.5)', statusColor: 'yellow' };
    return { color: '#22c55e', glowColor: 'rgba(34,197,94,0.5)', statusColor: 'green' };
}

/**
 * Applies a 20% income stress to the base metrics and recalculates the FlowUp score.
 * Returns { stressScore, stressDti }.
 */
function applyStressScenario(baseScore, baseDti, baseMetrics) {
    if (!baseMetrics) {
        // Fallback: DTI increases by ~25% when income drops 20%
        const stressDti = baseDti ? Math.round(baseDti / 0.8) : baseDti;
        if (stressDti >= 100) return { stressScore: 0, stressDti };
        const stressScore = Math.max(0, Math.round(baseScore * 0.65));
        return { stressScore, stressDti };
    }

    const stressedIncome = (baseMetrics.totalIncome || 0) * 0.8;
    const fixedExpenses = baseMetrics.totalFixedExpenses ?? baseMetrics.fixedExpenses ?? 0;
    const stressDti = stressedIncome > 0 ? Math.round((fixedExpenses / stressedIncome) * 100) : 9999;

    if (stressDti >= 100) return { stressScore: 0, stressDti };

    // Recalculate serviceability component
    let scoreServiceability = 0;
    if (stressDti <= 40) scoreServiceability = 80 + (40 - stressDti) * 0.5;
    else if (stressDti <= 57) scoreServiceability = 55 + (57 - stressDti) * (24 / 17);
    else scoreServiceability = Math.max(0, 54 - (stressDti - 57));

    const liquidAssets = baseMetrics.liquidAssets || 0;
    const totalExpenses = baseMetrics.totalExpenses || 1;
    const scoreLiquidity = Math.min(((liquidAssets / totalExpenses) / 6) * 100, 100);

    // Stability and volatility stay the same (we only stress income)
    const scoreStability = 70; // conservative under stress
    const scoreVolatility = 60;

    const stressScore = Math.max(0, Math.min(100, Math.round(
        0.35 * scoreStability +
        0.25 * scoreServiceability +
        0.25 * scoreLiquidity +
        0.15 * scoreVolatility
    )));

    return { stressScore, stressDti };
}

export default function SpeedometerGauge({ 
    projectedBalance,
    dti, 
    riskLevel = 'green',
    riskDay,
    whatIfAmount = 0,
    engineData,
    label,
    isScore = false,
    dtiTrend = null,
    baseMetrics = null
}) {
    const [stressMode, setStressMode] = useState(false);

    // Compute display score (stress or normal)
    const displayScore = useMemo(() => {
        if (!isScore) return projectedBalance;
        const rawScore = typeof projectedBalance === 'number' ? projectedBalance : 0;
        if (!stressMode) return rawScore;
        const { stressScore } = applyStressScenario(rawScore, dti, baseMetrics);
        return stressScore;
    }, [projectedBalance, isScore, stressMode, dti, baseMetrics]);

    const displayDti = useMemo(() => {
        if (!isScore || !stressMode) return dti;
        const rawScore = typeof projectedBalance === 'number' ? projectedBalance : 0;
        const { stressDti } = applyStressScenario(rawScore, dti, baseMetrics);
        return stressDti;
    }, [projectedBalance, isScore, stressMode, dti, baseMetrics]);

    const { angle, color, statusColor } = useMemo(() => {
        if (isScore) {
            const score = Math.max(0, displayScore ?? 0);
            return {
                angle: scoreToAngle(score),
                ...scoreToColors(score)
            };
        }

        // Balance mode (unchanged)
        const adjustedBalance = projectedBalance;
        if (adjustedBalance >= 2000) {
            const ratio = Math.min((adjustedBalance - 2000) / 2000, 1);
            return { angle: -40 + (ratio * -20), color: '#22c55e', glowColor: 'rgba(34,197,94,0.5)', statusColor: 'green' };
        } else if (adjustedBalance >= 1500) {
            const ratio = (adjustedBalance - 1500) / 500;
            return { angle: -20 + (ratio * -20), color: '#22c55e', glowColor: 'rgba(34,197,94,0.5)', statusColor: 'green' };
        } else if (adjustedBalance >= 0) {
            const ratio = adjustedBalance / 1500;
            return { angle: 20 - (ratio * 40), color: '#eab308', glowColor: 'rgba(234,179,8,0.5)', statusColor: 'yellow' };
        } else {
            const ratio = Math.min(Math.abs(adjustedBalance) / 2000, 1);
            return { angle: 20 + (ratio * 40), color: '#ef4444', glowColor: 'rgba(239,68,68,0.5)', statusColor: 'red' };
        }
    }, [displayScore, projectedBalance, isScore]);

    const safeDisplayScore = Math.max(0, displayScore ?? 0);

    return (
        <div className="relative flex flex-col items-center justify-center w-full p-6 rounded-xl bg-slate-800/30 border border-slate-700/30 backdrop-blur-sm h-full">

            {/* Stress Factor Toggle */}
            {isScore && (
                <button
                    onClick={() => setStressMode(v => !v)}
                    className={`absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${
                        stressMode
                            ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                            : 'bg-slate-800/60 border-slate-600/40 text-slate-500 hover:text-slate-300'
                    }`}
                    title="סטרס טסט: הכנסה -20%"
                >
                    <Zap className={`w-3 h-3 ${stressMode ? 'text-orange-400' : ''}`} />
                    {stressMode ? 'סטרס -20%' : 'סטרס טסט'}
                </button>
            )}

            {/* Gauge SVG */}
            <svg viewBox="0 0 200 120" className="w-full max-w-[280px] md:max-w-[320px] mx-auto">
                <defs>
                    <linearGradient id="redGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0.8" />
                    </linearGradient>
                    <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#f97316" stopOpacity="0.8" />
                    </linearGradient>
                    <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity="0.8" />
                    </linearGradient>
                </defs>

                {/* Red segment (Left) */}
                <path d="M 30 100 A 70 70 0 0 1 70 38" fill="none" stroke="url(#redGrad)" strokeWidth="12" strokeLinecap="round" />
                {/* Orange segment (Center) */}
                <path d="M 75 35 A 70 70 0 0 1 125 35" fill="none" stroke="url(#orangeGrad)" strokeWidth="12" strokeLinecap="round" />
                {/* Green segment (Right) */}
                <path d="M 130 38 A 70 70 0 0 1 170 100" fill="none" stroke="url(#greenGrad)" strokeWidth="12" strokeLinecap="round" />

                {/* Needle */}
                <g transform="translate(100, 100)">
                    <motion.g
                        initial={{ rotate: -60 }}
                        animate={{ rotate: angle }}
                        transition={{ type: "spring", stiffness: 90, damping: 12 }}
                    >
                        <line x1="0" y1="0" x2="0" y2="-60" stroke={stressMode ? '#f97316' : 'white'} strokeWidth="3" strokeLinecap="round" />
                    </motion.g>
                </g>

                <circle cx="100" cy="100" r="6" fill="white" />
                <circle cx="100" cy="100" r="3" fill="#1e293b" />
            </svg>

            {/* Score Display */}
            <div className="text-center mt-2 md:mt-4 w-full relative z-10">
                <p className="text-[10px] md:text-xs text-slate-400 mb-1 md:mb-2 uppercase tracking-wide">
                    {isScore ? (stressMode ? 'סטרס טסט — הכנסה -20%' : 'סטטוס אישור מימון') : (label || 'יתרה צפויה לסוף החודש')}
                </p>

                <motion.p
                    key={`${safeDisplayScore}-${stressMode}`}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`text-3xl md:text-4xl font-bold tracking-tight ${stressMode ? 'text-orange-300' : 'text-white'}`}
                >
                    {isScore
                        ? `${safeDisplayScore}/100`
                        : `₪${(projectedBalance ?? 0).toLocaleString('he-IL')}`
                    }
                </motion.p>

                {isScore && (
                    <div className="mt-2 text-sm font-semibold">
                        {statusColor === 'green' && <span className="text-green-400">העסקה ניתנת לאישור במסלול רגיל</span>}
                        {statusColor === 'yellow' && <span className="text-yellow-400">ניתן לאשר במסלול 72 חודשים או בלון</span>}
                        {statusColor === 'red' && safeDisplayScore === 0 && (
                            <span className="text-red-400">אין יכולת החזר — ההכנסה אינה מכסה את ההתחייבויות</span>
                        )}
                        {statusColor === 'red' && safeDisplayScore > 0 && (
                            <span className="text-red-400">נדרש שינוי מבנה העסקה</span>
                        )}
                    </div>
                )}

                {isScore && statusColor !== 'green' && (
                    <div className="mt-4 text-xs text-slate-300 bg-slate-800/50 p-3 rounded-lg text-right border border-slate-700/50">
                        {safeDisplayScore === 0 ? (
                            <>
                                <p className="font-semibold mb-1 text-red-300">אין תרחיש ליכולת החזר:</p>
                                <ul className="list-disc list-inside pr-2 space-y-1 text-slate-400">
                                    <li>ההכנסה הנוכחית אינה מספיקה לכיסוי ההחזר</li>
                                    <li>נדרש הגדלת הכנסה משמעותית לפני אישור</li>
                                    <li>יש לשקול ערב/בטוחה חלופית</li>
                                </ul>
                            </>
                        ) : (
                            <>
                                <p className="font-semibold mb-1 text-slate-200">כדי להגיע לירוק ניתן:</p>
                                <ul className="list-disc list-inside pr-2 space-y-1 text-slate-400">
                                    <li>להוסיף מקדמה</li>
                                    <li>לפרוס ל-72 חודשים</li>
                                    <li>לבחור במסלול בלון</li>
                                </ul>
                            </>
                        )}
                    </div>
                )}

                {isScore && displayDti !== undefined && (
                    <div className="mt-4 pt-3 border-t border-slate-700/50 text-xs font-medium text-slate-500 flex flex-col items-center">
                        <div>
                            <span className="opacity-70">DTI: </span>
                            <span className={displayDti >= 100 ? 'text-red-500 font-bold' : displayDti > 50 ? 'text-red-400' : displayDti > 35 ? 'text-orange-400' : 'text-emerald-400'}>
                                {displayDti >= 9999 ? '∞' : `${displayDti}%`}
                            </span>
                            {stressMode && <span className="text-orange-400 ml-1">(stress)</span>}
                        </div>
                        {!stressMode && dtiTrend !== null && Math.abs(dtiTrend) >= 0.1 && (
                            <div className={`mt-1 flex items-center text-[10px] ${Math.abs(dtiTrend) < 1 ? 'text-slate-500' : (dtiTrend > 0 ? 'text-red-400' : 'text-emerald-400')}`}>
                                {Math.abs(dtiTrend) < 1 ? <Minus className="w-3 h-3 mr-1" /> : (dtiTrend > 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />)}
                                <span dir="ltr">{Math.abs(dtiTrend).toFixed(1)}%</span>
                                <span className="ml-1 opacity-70">מול ממוצע קודם</span>
                            </div>
                        )}
                    </div>
                )}

                {riskDay && !isScore && (
                    <div className={`mt-3 md:mt-4 inline-flex items-center px-3 py-1.5 rounded-full border ${
                        statusColor === 'green' ? 'bg-green-500/10 border-green-500/20' :
                        statusColor === 'yellow' ? 'bg-yellow-500/10 border-yellow-500/20' :
                        'bg-red-500/10 border-red-500/20'
                    }`}>
                        <p className={`text-xs ${statusColor === 'green' ? 'text-green-400' : statusColor === 'yellow' ? 'text-yellow-400' : 'text-red-400'}`}>
                            <span className="opacity-75">יום סיכון צפוי: </span>
                            <span className="font-bold mr-1">{riskDay}</span>
                        </p>
                    </div>
                )}
            </div>

            {engineData && (
                <div className="w-full mt-auto pt-8 border-t border-slate-700/30">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2 rounded-lg bg-slate-800/40">
                            <span className="block text-slate-500 text-[10px] mb-0.5">רמת ביטחון</span>
                            <span className={`font-medium ${statusColor === 'green' ? 'text-green-400' : statusColor === 'yellow' ? 'text-yellow-400' : 'text-red-400'}`}>
                                {statusColor === 'green' ? 'גבוהה' : statusColor === 'yellow' ? 'בינונית' : 'נמוכה'}
                            </span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-800/40">
                            <span className="block text-slate-500 text-[10px] mb-0.5">עסקאות</span>
                            <span className="text-slate-300 font-medium">{engineData.transactionCount}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-800/40">
                            <span className="block text-slate-500 text-[10px] mb-0.5">מנוע</span>
                            <span className="text-cyan-400 font-medium">{SystemInfo.engine.split(' ')[0]}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}