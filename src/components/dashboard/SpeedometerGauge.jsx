import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

import { SystemInfo } from '@/components/utils/forecastingLogic';

export default function SpeedometerGauge({ 
  projectedBalance, 
  riskLevel = 'green',
  riskDay,
  whatIfAmount = 0,
  engineData
}) {
  const adjustedBalance = projectedBalance;
  
  const { angle, color } = useMemo(() => {
    // UPDATED Logic:
    // Red (Left): Balance < 0 (-60° to -20°)
    // Orange (Center): 0 <= Balance <= 2000 (-20° to +20°)
    // Green (Right): Balance > 2000 (+20° to +60°)

    let calculatedAngle;
    let calculatedColor;

    const MAX_NEG_VAL = 3000;  // Cap for red zone
    const MAX_POS_VAL = 6000;  // Cap for green zone
    const MID_ZONE_LIMIT = 2000;

    if (adjustedBalance < 0) {
      // Red Zone (Left)
      // Map 0 -> -20, -3000 -> -60
      const ratio = Math.min(Math.abs(adjustedBalance) / MAX_NEG_VAL, 1);
      calculatedAngle = -20 - (ratio * 40);
      calculatedColor = '#ef4444';
    } else if (adjustedBalance <= MID_ZONE_LIMIT) {
      // Orange Zone (Center)
      // Map 0 -> -20, 2000 -> +20
      const ratio = adjustedBalance / MID_ZONE_LIMIT;
      calculatedAngle = -20 + (ratio * 40);
      calculatedColor = '#f97316'; // Orange-500
    } else {
      // Green Zone (Right)
      // Map 2000 -> +20, 6000 -> +60
      const ratio = Math.min((adjustedBalance - MID_ZONE_LIMIT) / (MAX_POS_VAL - MID_ZONE_LIMIT), 1);
      calculatedAngle = 20 + (ratio * 40);
      calculatedColor = '#22c55e';
    }
    
    return { 
      angle: calculatedAngle, 
      color: calculatedColor
    };
  }, [adjustedBalance]);

  return (
    <div className="relative w-full max-w-[320px] aspect-square mx-auto flex flex-col items-center justify-center p-4 rounded-xl bg-slate-800/30 border border-slate-700/30 backdrop-blur-sm">
      {/* Gauge SVG Container */}
      <div className="w-full h-full relative flex items-center justify-center">
        <svg 
          viewBox="0 0 200 120" 
          className="w-full h-auto max-h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Gradients */}
          <defs>
            <linearGradient id="redGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          
          {/* Left Segment (Red) */}
          <path
            d="M 30 100 A 70 70 0 0 1 70 38"
            fill="none"
            stroke="url(#redGrad)"
            strokeWidth="8"
            strokeLinecap="round"
            className="opacity-90"
          />
          
          {/* Center Segment (Orange) */}
          <path
            d="M 75 35 A 70 70 0 0 1 125 35"
            fill="none"
            stroke="url(#orangeGrad)"
            strokeWidth="8"
            strokeLinecap="round"
            className="opacity-90"
          />
          
          {/* Right Segment (Green) */}
          <path
            d="M 130 38 A 70 70 0 0 1 170 100"
            fill="none"
            stroke="url(#greenGrad)"
            strokeWidth="8"
            strokeLinecap="round"
            className="opacity-90"
          />
          
          {/* Needle */}
          <motion.g
            initial={{ rotate: 0 }}
            animate={{ rotate: angle }}
            transition={{ type: "tween", duration: 1, ease: [0.4, 0, 0.2, 1] }}
            style={{ transformOrigin: '100px 100px' }}
          >
            <line
              x1="100"
              y1="100"
              x2="100"
              y2="35"
              stroke="#f8fafc"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="100" cy="100" r="4" fill="#f8fafc" />
          </motion.g>
        </svg>
        
        {/* Centered Text Overlay */}
        <div className="absolute bottom-0 left-0 right-0 text-center pb-2 md:pb-6">
        <p className="text-[10px] md:text-xs text-slate-400 mb-1 md:mb-2 uppercase tracking-wide">יתרה צפויה לסוף החודש</p>
        <motion.p 
          key={adjustedBalance}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-3xl md:text-4xl font-bold text-white tracking-tight"
        >
          ₪{adjustedBalance.toLocaleString('he-IL')}
        </motion.p>
        
        {riskDay ? (
          <div className="mt-3 md:mt-4 inline-flex items-center px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-400">
              <span className="opacity-75">יום סיכון צפוי: </span>
              <span className="font-bold mr-1">{riskDay}</span>
            </p>
          </div>
        ) : (
           <div className="mt-3 md:mt-4 h-8"></div> 
        )}
        </div>
        </div>

        {engineData && (
        <div className="w-full mt-auto pt-8 border-t border-slate-700/30">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-lg bg-slate-800/40">
              <span className="block text-slate-500 text-[10px] mb-0.5">רמת ביטחון</span>
              <span className={`font-medium ${
                engineData.confidence === 'high' ? 'text-green-400' :
                engineData.confidence === 'medium' ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {engineData.confidence === 'high' ? 'גבוהה' :
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