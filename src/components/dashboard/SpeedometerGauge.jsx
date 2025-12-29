import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export default function SpeedometerGauge({ 
  projectedBalance, 
  riskLevel = 'green',
  riskDay,
  whatIfAmount = 0 
}) {
  // Calculate needle angle based on risk level and projected balance
  const adjustedBalance = projectedBalance - whatIfAmount;
  
  const { angle, color, glowColor } = useMemo(() => {
    let calculatedRisk = riskLevel;
    
    // Recalculate risk based on what-if
    if (adjustedBalance < 0) {
      calculatedRisk = 'red';
    } else if (adjustedBalance < 1000) {
      calculatedRisk = 'yellow';
    } else {
      calculatedRisk = 'green';
    }
    
    const riskConfig = {
      green: { angle: -60, color: '#22c55e', glowColor: 'rgba(34, 197, 94, 0.5)' },
      yellow: { angle: 0, color: '#eab308', glowColor: 'rgba(234, 179, 8, 0.5)' },
      red: { angle: 60, color: '#ef4444', glowColor: 'rgba(239, 68, 68, 0.5)' }
    };
    
    return riskConfig[calculatedRisk];
  }, [adjustedBalance, riskLevel]);

  return (
    <div className="relative flex flex-col items-center">
      {/* Gauge SVG */}
      <svg 
        viewBox="0 0 200 120" 
        className="w-full max-w-[280px] md:max-w-[320px]"
        style={{ filter: `drop-shadow(0 0 20px ${glowColor})` }}
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
          filter="url(#glow)"
        />
        
        {/* Yellow segment */}
        <path
          d="M 75 35 A 70 70 0 0 1 125 35"
          fill="none"
          stroke="url(#yellowGrad)"
          strokeWidth="12"
          strokeLinecap="round"
          filter="url(#glow)"
        />
        
        {/* Red segment */}
        <path
          d="M 130 38 A 70 70 0 0 1 170 100"
          fill="none"
          stroke="url(#redGrad)"
          strokeWidth="12"
          strokeLinecap="round"
          filter="url(#glow)"
        />
        
        {/* Needle */}
        <motion.g
          initial={{ rotate: -60 }}
          animate={{ rotate: angle }}
          transition={{ type: "spring", stiffness: 60, damping: 15 }}
          style={{ transformOrigin: '100px 100px' }}
        >
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="40"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            filter="url(#glow)"
          />
          <circle cx="100" cy="100" r="8" fill={color} filter="url(#glow)" />
        </motion.g>
        
        {/* Center dot */}
        <circle cx="100" cy="100" r="4" fill="#fff" />
      </svg>
      
      {/* Balance Display */}
      <div className="text-center mt-2">
        <p className="text-xs text-slate-400 mb-1">יתרה צפויה לסוף החודש</p>
        <motion.p 
          key={adjustedBalance}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-3xl md:text-4xl font-bold"
          style={{ color, textShadow: `0 0 20px ${glowColor}` }}
        >
          ₪{adjustedBalance.toLocaleString('he-IL')}
        </motion.p>
        {riskDay && (
          <p className="text-sm mt-1">
            <span className="text-slate-400">יום סיכון: </span>
            <span style={{ color }}>{riskDay}</span>
          </p>
        )}
      </div>
    </div>
  );
}