import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export default function SpeedometerGauge({ 
  projectedBalance, 
  riskLevel = 'green',
  riskDay,
  whatIfAmount = 0 
}) {
  // Use projected balance as-is (already calculated by forecasting logic)
  const adjustedBalance = projectedBalance;
  
  const { angle, color, glowColor } = useMemo(() => {
    // Optimized Mapping: 0 = Center (0°), +3000 = Green (-60°), Negative = Red (+60°)
    let calculatedAngle;
    let calculatedColor;
    let calculatedGlow;
    
    if (adjustedBalance >= 3000) {
      // Green zone: Full left
      calculatedAngle = -60;
      calculatedColor = '#22c55e';
      calculatedGlow = 'rgba(34, 197, 94, 0.5)';
    } else if (adjustedBalance > 0) {
      // Yellow zone: Linear interpolation from 0° (at 0) to -60° (at 3000)
      const ratio = adjustedBalance / 3000;
      calculatedAngle = -60 * ratio;
      calculatedColor = adjustedBalance >= 1500 ? '#eab308' : '#f59e0b';
      calculatedGlow = 'rgba(234, 179, 8, 0.5)';
    } else {
      // Red zone: Balance is negative, map to right side (0° to +60°)
      const negativeAmount = Math.abs(adjustedBalance);
      const ratio = Math.min(negativeAmount / 3000, 1); // Cap at 60°
      calculatedAngle = 60 * ratio;
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
    <div className="relative flex flex-col items-center justify-center w-full">
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
          transition={{ type: "spring", stiffness: 60, damping: 15 }}
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
      <div className="text-center mt-2 w-full">
        <p className="text-xs text-slate-400 mb-1">יתרה צפויה לסוף החודש</p>
        <motion.p 
          key={adjustedBalance}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-3xl md:text-4xl font-bold text-white"
        >
          ₪{adjustedBalance.toLocaleString('he-IL')}
        </motion.p>
        {riskDay && (
          <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-xs text-red-400">
              <span className="font-medium">יום סיכון: </span>
              <span className="text-sm font-bold">{riskDay}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}