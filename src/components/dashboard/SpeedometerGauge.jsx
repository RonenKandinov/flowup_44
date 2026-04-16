import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

import { SystemInfo } from '@/components/utils/forecastingLogic';

export default function SpeedometerGauge({ 
  projectedBalance,
  dti, 
  riskLevel = 'green',
  riskDay,
  whatIfAmount = 0,
  engineData,
  label,
  isScore = false,
  dtiTrend = null
}) {
  // Use projected balance as-is (already calculated by forecasting logic)
  const adjustedBalance = projectedBalance;
  
  const { angle, color, glowColor, statusColor } = useMemo(() => {
    let calculatedAngle;
    let calculatedColor;
    let calculatedGlow;
    let statusColor;

    if (isScore) {
        // FLOWUP SCORING LOGIC (0-100)
        // Red: Score 0-54 -> Left (-60 to -20)
        // Orange: Score 55-79 -> Center (-20 to 20)
        // Green: Score 80-100 -> Right (20 to 60)
        const score = adjustedBalance; // adjustedBalance is passed as score

        const colorMap = {
            'RED': { color: '#ef4444', glow: 'rgba(239, 68, 68, 0.5)', status: 'red' },
            'ORANGE': { color: '#f97316', glow: 'rgba(249, 115, 22, 0.5)', status: 'yellow' },
            'YELLOW': { color: '#f97316', glow: 'rgba(249, 115, 22, 0.5)', status: 'yellow' },
            'GREEN': { color: '#22c55e', glow: 'rgba(34, 197, 94, 0.5)', status: 'green' }
        };
        const rl = riskLevel ? riskLevel.toUpperCase() : null;
        const theme = colorMap[rl];

        let visualScore = score;
        // Override visual angle if AI analyst decided a different risk tier
        if (rl === 'RED' && score >= 55) visualScore = 54;
        if ((rl === 'ORANGE' || rl === 'YELLOW') && (score < 55 || score >= 80)) visualScore = 75;
        if (rl === 'GREEN' && score < 80) visualScore = 85;

        if (visualScore < 55) {
            const ratio = visualScore / 55;
            calculatedAngle = -60 + (ratio * 40);
            calculatedColor = theme ? theme.color : '#ef4444';
            calculatedGlow = theme ? theme.glow : 'rgba(239, 68, 68, 0.5)';
            statusColor = theme ? theme.status : 'red';
        } else if (visualScore < 80) {
            const ratio = (visualScore - 55) / 25;
            calculatedAngle = -20 + (ratio * 40);
            calculatedColor = theme ? theme.color : '#f97316'; 
            calculatedGlow = theme ? theme.glow : 'rgba(249, 115, 22, 0.5)';
            statusColor = theme ? theme.status : 'yellow';
        } else {
            const ratio = (visualScore - 80) / 20;
            calculatedAngle = 20 + (ratio * 40);
            calculatedColor = theme ? theme.color : '#22c55e';
            calculatedGlow = theme ? theme.glow : 'rgba(34, 197, 94, 0.5)';
            statusColor = theme ? theme.status : 'green';
        }

    } else {
        // ORIGINAL BALANCE LOGIC
        // 1. Balance < 0 (Red): 0 -> +20°, -1000 -> +40° (Middle), -2000+ -> +60°
        // 2. 0 <= Balance < 1500 (Yellow): 0 -> +20°, 1500 -> -20°
        // 3. Balance >= 1500 (Green):
        //    - 1500 to 2000: -20° to -40° (Middle)
        //    - 2000+: -40° to -60°

        if (adjustedBalance >= 2000) {
        // Super Safe (Middle of Green to End)
        // 2000 -> -40, 4000 -> -60
        const ratio = Math.min((adjustedBalance - 2000) / 2000, 1);
        calculatedAngle = -40 + (ratio * -20);
        calculatedColor = '#22c55e';
        calculatedGlow = 'rgba(34, 197, 94, 0.5)';
        statusColor = 'green';
        } else if (adjustedBalance >= 1500) {
        // Safe Entry (Start of Green to Middle)
        // 1500 -> -20, 2000 -> -40
        const ratio = (adjustedBalance - 1500) / 500;
        calculatedAngle = -20 + (ratio * -20);
        calculatedColor = '#22c55e';
        calculatedGlow = 'rgba(34, 197, 94, 0.5)';
        statusColor = 'green';
        } else if (adjustedBalance >= 0) {
        // Caution (Yellow)
        // 0 -> +20, 1500 -> -20
        const ratio = adjustedBalance / 1500;
        calculatedAngle = 20 - (ratio * 40);
        calculatedColor = '#eab308';
        calculatedGlow = 'rgba(234, 179, 8, 0.5)';
        statusColor = 'yellow';
        } else {
        // Danger (Red)
        // 0 -> +20, -1000 -> +40 (Middle), -2000 -> +60
        const negativeVal = Math.abs(adjustedBalance);
        const ratio = Math.min(negativeVal / 2000, 1);
        calculatedAngle = 20 + (ratio * 40);
        calculatedColor = '#ef4444';
        calculatedGlow = 'rgba(239, 68, 68, 0.5)';
        statusColor = 'red';
        }
    }
    
    return { 
      angle: calculatedAngle, 
      color: calculatedColor, 
      glowColor: calculatedGlow,
      statusColor
    };
  }, [adjustedBalance, isScore]);

  return (
    <div className="relative flex flex-col items-center justify-center w-full p-6 rounded-xl bg-slate-800/30 border border-slate-700/30 backdrop-blur-sm h-full">
      {/* Gauge SVG */}
      <svg 
        viewBox="0 0 200 120" 
        className="w-full max-w-[280px] md:max-w-[320px] mx-auto"
      >
        {/* Background arc segments */}
        <defs>
          {/* RED Gradient (Left) */}
          <linearGradient id="redGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.8" />
          </linearGradient>
          {/* ORANGE Gradient (Center) */}
          <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.8" />
          </linearGradient>
          {/* GREEN Gradient (Right) */}
          <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.8" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Red segment (Left) */}
        <path
          d="M 30 100 A 70 70 0 0 1 70 38"
          fill="none"
          stroke="url(#redGrad)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        
        {/* Orange segment (Center) */}
        <path
          d="M 75 35 A 70 70 0 0 1 125 35"
          fill="none"
          stroke="url(#orangeGrad)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        
        {/* Green segment (Right) */}
        <path
          d="M 130 38 A 70 70 0 0 1 170 100"
          fill="none"
          stroke="url(#greenGrad)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        
        {/* Needle - Straight Classic Speedometer Style */}
        {/* Geometric Centering: Translate to center, rotate, then draw relative to 0,0 */}
        <g transform="translate(100, 100)">
          <motion.g
            initial={{ rotate: 0 }}
            animate={{ rotate: angle }}
            transition={{ type: "spring", stiffness: 90, damping: 12 }}
          >
            {/* Visible Needle (Upwards) */}
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="-60"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Invisible Counterbalance (Downwards) - Forces center of rotation to be exactly 0,0 */}
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="60"
              stroke="transparent"
              strokeWidth="0"
            />
          </motion.g>
        </g>

        {/* Static Center Cap - Anchored at (100,100) */}
        <circle cx="100" cy="100" r="6" fill="white" />
        <circle cx="100" cy="100" r="3" fill="#1e293b" />
      </svg>
      
      {/* Balance Display */}
      <div className="text-center mt-2 md:mt-4 w-full relative z-10">
        <p className="text-[10px] md:text-xs text-slate-400 mb-1 md:mb-2 uppercase tracking-wide">{isScore ? "סטטוס אישור מימון" : (label || "יתרה צפויה לסוף החודש")}</p>
        <motion.p 
          key={adjustedBalance}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-3xl md:text-4xl font-bold text-white tracking-tight"
        >
          {isScore ? `${adjustedBalance}/100` : `₪${adjustedBalance.toLocaleString('he-IL')}`}
        </motion.p>

        {isScore && (
          <div className="mt-2 text-sm font-semibold">
            {statusColor === 'green' && <span className="text-green-400">העסקה ניתנת לאישור במסלול רגיל</span>}
            {statusColor === 'yellow' && <span className="text-yellow-400">ניתן לאשר במסלול 72 חודשים או בלון</span>}
            {statusColor === 'red' && <span className="text-red-400">נדרש שינוי מבנה העסקה</span>}
          </div>
        )}

        {isScore && statusColor !== 'green' && (
          <div className="mt-4 text-xs text-slate-300 bg-slate-800/50 p-3 rounded-lg text-right border border-slate-700/50">
            <p className="font-semibold mb-1 text-slate-200">המשמעות כרגע:</p>
            <ul className="list-disc list-inside pr-2 space-y-1 text-slate-400">
              <li>{statusColor === 'red' ? 'אין כרגע מבנה עסקה בטוח לאישור אוטומטי' : 'נדרש מבנה עסקה שמרני יותר'}</li>
              <li>{statusColor === 'red' ? 'צריך לשפר הכנסה, להקטין התחייבויות או להגדיל הון עצמי' : 'אפשר לבחון פריסה ארוכה יותר או הקטנת סכום'}</li>
              <li>{statusColor === 'red' ? 'לא להציג זאת כעסקה מחולצת אם יחס ההחזר הורע' : 'העסקה עדיין דורשת בחינה ידנית'}</li>
            </ul>
          </div>
        )}
        
        {isScore && dti !== undefined && (
             <div className="mt-4 pt-3 border-t border-slate-700/50 text-xs font-medium text-slate-500 flex flex-col items-center">
                <div>
                  <span className="opacity-70">DTI: </span>
                  <span className={dti > 50 ? 'text-red-400' : dti > 35 ? 'text-orange-400' : 'text-emerald-400'}>{dti}%</span>
                </div>
                {dtiTrend !== null && Math.abs(dtiTrend) >= 0.1 && (
                   <div className={`mt-1 flex items-center text-[10px] ${Math.abs(dtiTrend) < 1 ? 'text-slate-500' : (dtiTrend > 0 ? 'text-red-400' : 'text-emerald-400')}`}>
                      {Math.abs(dtiTrend) < 1 ? <Minus className="w-3 h-3 mr-1" /> : (dtiTrend > 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />)}
                      <span dir="ltr">{Math.abs(dtiTrend).toFixed(1)}%</span>
                      <span className="ml-1 opacity-70">מול ממוצע קודם</span>
                   </div>
                )}
             </div>
        )}

        {riskDay ? (
          <div className={`mt-3 md:mt-4 inline-flex items-center px-3 py-1.5 rounded-full border ${
            statusColor === 'green' ? 'bg-green-500/10 border-green-500/20' :
            statusColor === 'yellow' ? 'bg-yellow-500/10 border-yellow-500/20' :
            'bg-red-500/10 border-red-500/20'
          }`}>
            <p className={`text-xs ${
              statusColor === 'green' ? 'text-green-400' :
              statusColor === 'yellow' ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              <span className="opacity-75">יום סיכון צפוי: </span>
              <span className="font-bold mr-1">{riskDay}</span>
            </p>
          </div>
        ) : (
           !isScore && <div className="mt-3 md:mt-4 h-8"></div> 
        )}
      </div>

      {engineData && (
        <div className="w-full mt-auto pt-8 border-t border-slate-700/30">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-lg bg-slate-800/40">
              <span className="block text-slate-500 text-[10px] mb-0.5">רמת ביטחון</span>
              <span className={`font-medium ${
                (statusColor === 'green' || engineData.confidence === 'high') ? 'text-green-400' :
                engineData.confidence === 'medium' ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {(statusColor === 'green' || engineData.confidence === 'high') ? 'גבוהה' :
                 engineData.confidence === 'medium' ? 'בינונית' : 'נמוכה'}
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