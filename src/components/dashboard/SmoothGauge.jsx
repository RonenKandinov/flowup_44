import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export default function SmoothGauge({ projectedBalance, riskDay }) {
  // Define range for gauge calculation
  const MIN_RANGE = -10000;
  const MAX_RANGE = 20000;
  
  // Snap-to-angle logic: 150°/90°/30° based on projectedEOM
  const { angle, color, riskLevel } = useMemo(() => {
    let ang, col, risk;
    
    if (projectedBalance <= 0) {
      // RED ZONE: 150°
      ang = 150;
      col = '#ef4444';
      risk = 'red';
    } else if (projectedBalance < 2000) {
      // YELLOW ZONE: 90° (center)
      ang = 90;
      col = '#eab308';
      risk = 'yellow';
    } else {
      // GREEN ZONE: 30°
      ang = 30;
      col = '#22c55e';
      risk = 'green';
    }
    
    return { angle: ang, color: col, riskLevel: risk };
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
          
          {/* Needle shadow gradient */}
          <linearGradient id="needleShadow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#000" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </linearGradient>
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
        
        {/* Professional Needle */}
        <motion.g
          initial={{ rotate: 90 }}
          animate={{ rotate: angle }}
          transition={{ type: "spring", stiffness: 70, damping: 18 }}
          style={{ transformOrigin: '100px 100px' }}
        >
          {/* Tapered needle (triangle) */}
          <path
            d="M 100 100 L 97 45 L 103 45 Z"
            fill={color}
            filter="url(#gaugeGlow)"
          />
          {/* Needle shadow for depth */}
          <path
            d="M 100 100 L 97 45 L 103 45 Z"
            fill="url(#needleShadow)"
            opacity="0.3"
          />
        </motion.g>
        
        {/* Decorative base circle */}
        <circle 
          cx="100" 
          cy="100" 
          r="8" 
          fill={color}
          filter="url(#gaugeGlow)"
          opacity="0.8"
        />
        <circle cx="100" cy="100" r="5" fill="#1e293b" />
        <circle cx="100" cy="100" r="3" fill={color} />
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