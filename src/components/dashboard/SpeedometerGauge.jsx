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
  // Use projected balance as-is (already calculated by forecasting logic)
  const adjustedBalance = projectedBalance;
  
  const { angle, color, glowColor } = useMemo(() => {
    // New Logic based on Risk Zones:
    // Green (Safe): Balance > 1500 -> Angle -20° to -60° (Left)
    // Yellow (Caution): Balance 0 to 1500 -> Angle +20° to -20° (Center)
    // Red (Danger): Balance < 0 -> Angle +20° to +60° (Right)

    let calculatedAngle;
    let calculatedColor;
    let calculatedGlow;

    const CAUTION_THRESHOLD = 1500;
    const MAX_SAFE_VAL = 6000; // Cap for max green angle
    const MAX_RISK_VAL = 3000; // Cap for max red angle

    if (adjustedBalance >= CAUTION_THRESHOLD) {
      // Green Zone
      const ratio = Math.min((adjustedBalance - CAUTION_THRESHOLD) / (MAX_SAFE_VAL - CAUTION_THRESHOLD), 1);
      calculatedAngle = -20 + (ratio * -40); // -20 to -60
      calculatedColor = '#22c55e';
      calculatedGlow = 'rgba(34, 197, 94, 0.5)';
    } else if (adjustedBalance >= 0) {
      // Yellow Zone
      const ratio = adjustedBalance / CAUTION_THRESHOLD; // 0 to 1
      // Map 0 -> +20 (Start of Red), 1 -> -20 (Start of Green)
      calculatedAngle = 20 - (ratio * 40); 
      calculatedColor = '#eab308';
      calculatedGlow = 'rgba(234, 179, 8, 0.5)';
    } else {
      // Red Zone
      const ratio = Math.min(Math.abs(adjustedBalance) / MAX_RISK_VAL, 1);
      calculatedAngle = 20 + (ratio * 40); // +20 to +60
      calculatedColor = '#ef4444';
      calculatedGlow = 'rgba(239, 68, 68, 0.5)';
    }
    
    return { 
      angle: calculatedAngle, 
      color: calculatedColor, 
      glowColor: calculatedGlow 
    };
  }, [adjustedBalance]);

  return (
    <div className="relative flex flex-col items-center justify-center w-full p-6 rounded-xl bg-slate-800/30 border border-slate-700/30 backdrop-blur-sm h-full">
      {/* Gauge SVG */}
      <svg 
        viewBox="0 0 200 120" 
        className="w-full max-w-[280px] md:max-w-[320px] mx-auto"
      >
        {/* Background arc segments */}
        <defs>
          <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="yellowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#eab308" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#eab308" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="redGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.8" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Green segment */}
        <path
          d="M 30 100 A 70 70 0 0 1 70 38"
          fill="none"
          stroke="url(#greenGrad)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        
        {/* Yellow segment */}
        <path
          d="M 75 35 A 70 70 0 0 1 125 35"
          fill="none"
          stroke="url(#yellowGrad)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        
        {/* Red segment */}
        <path
          d="M 130 38 A 70 70 0 0 1 170 100"
          fill="none"
          stroke="url(#redGrad)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        
        {/* Needle - Straight Classic Speedometer Style */}
        <motion.g
          initial={{ rotate: 0 }}
          animate={{ rotate: angle }}
          transition={{ type: "spring", stiffness: 90, damping: 12 }}
          style={{ transformOrigin: '100px 100px' }}
        >
          {/* Straight needle pointer */}
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="40"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Center cap */}
          <circle cx="100" cy="100" r="6" fill="white" />
          <circle cx="100" cy="100" r="3" fill="#1e293b" />
        </motion.g>
      </svg>
      
      {/* Balance Display */}
      <div className="text-center mt-2 md:mt-4 w-full relative z-10">
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