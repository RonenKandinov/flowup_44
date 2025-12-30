import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export default function SmoothGauge({ projectedBalance, riskDay }) {
  // Define range for gauge calculation
  const MIN_RANGE = -10000;
  const MAX_RANGE = 20000;
  
  // Calculate percentage and needle angle
  const { percentage, angle, color, riskLevel } = useMemo(() => {
    // Clamp percentage between 0-100
    let pct = ((projectedBalance - MIN_RANGE) / (MAX_RANGE - MIN_RANGE)) * 100;
    pct = Math.max(0, Math.min(100, pct));
    
    // Convert percentage to angle (-90deg to +90deg)
    const ang = -90 + (pct * 1.8); // 180 degrees total range
    
    // Determine color and risk based on value
    let col, risk;
    if (projectedBalance < 0) {
      col = '#ef4444'; // Red
      risk = 'red';
    } else if (projectedBalance < 5000) {
      col = '#eab308'; // Yellow
      risk = 'yellow';
    } else {
      col = '#22c55e'; // Green
      risk = 'green';
    }
    
    return { percentage: pct, angle: ang, color: col, riskLevel: risk };
  }, [projectedBalance]);

  return (
    <div className="relative flex flex-col items-center">
      {/* SVG Gauge */}
      <svg 
        viewBox="0 0 200 120" 
        className="w-full max-w-[300px]"
        style={{ filter: `drop-shadow(0 0 20px ${color}40)` }}
      >
        <defs>
          {/* Smooth Gradient Arc: Green -> Yellow -> Red */}
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          
          {/* Glow filter */}
          <filter id="gaugeGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Background Arc */}
        <path
          d="M 30 100 A 70 70 0 0 1 170 100"
          fill="none"
          stroke="#1e293b"
          strokeWidth="14"
          strokeLinecap="round"
        />
        
        {/* Gradient Arc */}
        <path
          d="M 30 100 A 70 70 0 0 1 170 100"
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="12"
          strokeLinecap="round"
          filter="url(#gaugeGlow)"
        />
        
        {/* Needle */}
        <motion.g
          initial={{ rotate: -90 }}
          animate={{ rotate: angle }}
          transition={{ type: "spring", stiffness: 50, damping: 20 }}
          style={{ transformOrigin: '100px 100px' }}
        >
          {/* Needle line */}
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="45"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            filter="url(#gaugeGlow)"
          />
          {/* Needle center circle */}
          <circle 
            cx="100" 
            cy="100" 
            r="6" 
            fill={color}
            filter="url(#gaugeGlow)"
          />
        </motion.g>
        
        {/* Center dot */}
        <circle cx="100" cy="100" r="3" fill="#fff" />
      </svg>
      
      {/* Value Display */}
      <div className="text-center mt-2">
        <p className="text-xs text-slate-400 mb-1">יתרה צפויה לסוף החודש</p>
        <motion.p 
          key={projectedBalance}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-4xl font-bold"
          style={{ 
            color, 
            textShadow: `0 0 20px ${color}40` 
          }}
        >
          ₪{projectedBalance.toLocaleString('he-IL')}
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