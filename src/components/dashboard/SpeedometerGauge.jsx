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
    // Visual Mapping: 0-180° scale where 0₪ = 90° (center)
    // Range: -3000₪ (0°) → 0₪ (90°) → +5000₪ (180°)
    let calculatedAngle;
    let calculatedColor;
    let calculatedGlow;
    
    if (adjustedBalance >= 5000) {
      // Maximum green: 180°
      calculatedAngle = 180;
      calculatedColor = '#22c55e';
      calculatedGlow = 'rgba(34, 197, 94, 0.5)';
    } else if (adjustedBalance > 0) {
      // Positive zone: 90° → 180° (green/yellow)
      const ratio = adjustedBalance / 5000;
      calculatedAngle = 90 + (90 * ratio);
      calculatedColor = adjustedBalance >= 2500 ? '#22c55e' : '#eab308';
      calculatedGlow = adjustedBalance >= 2500 ? 'rgba(34, 197, 94, 0.5)' : 'rgba(234, 179, 8, 0.5)';
    } else if (adjustedBalance === 0) {
      // Exact center
      calculatedAngle = 90;
      calculatedColor = '#eab308';
      calculatedGlow = 'rgba(234, 179, 8, 0.5)';
    } else {
      // Negative zone: 0° → 90° (red/yellow)
      const negativeAmount = Math.abs(adjustedBalance);
      const ratio = Math.min(negativeAmount / 3000, 1);
      calculatedAngle = 90 - (90 * ratio);
      calculatedColor = negativeAmount > 1500 ? '#ef4444' : '#f59e0b';
      calculatedGlow = negativeAmount > 1500 ? 'rgba(239, 68, 68, 0.5)' : 'rgba(234, 179, 8, 0.5)';
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
        
        {/* Red segment (0° - 90°) */}
        <path
          d="M 30 100 A 70 70 0 0 1 100 30"
          fill="none"
          stroke="url(#redGrad)"
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Yellow segment (90° center) */}
        <path
          d="M 100 30 A 70 70 0 0 1 100 30"
          fill="none"
          stroke="url(#yellowGrad)"
          strokeWidth="14"
          strokeLinecap="round"
        />

        {/* Green segment (90° - 180°) */}
        <path
          d="M 100 30 A 70 70 0 0 1 170 100"
          fill="none"
          stroke="url(#greenGrad)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        
        {/* Needle - Straight Classic Speedometer Style */}
        <motion.g
          initial={{ rotate: 90 }}
          animate={{ rotate: angle }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
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