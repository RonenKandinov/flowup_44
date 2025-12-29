import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export default function SpeedometerGauge({ 
  projectedBalance, 
  riskLevel = 'green',
  riskDay,
  whatIfAmount = 0,
  safetyBuffer = 0.17
}) {
  const adjustedBalance = projectedBalance - whatIfAmount;
  
  const { angle, color, status } = useMemo(() => {
    let calculatedStatus = riskLevel;
    
    if (adjustedBalance < 0) {
      calculatedStatus = 'red';
    } else if (adjustedBalance < 1000) {
      calculatedStatus = 'yellow';
    } else {
      calculatedStatus = 'green';
    }
    
    const statusConfig = {
      green: { angle: 45, color: '#10b981', status: 'בטוח' },
      yellow: { angle: 0, color: '#f59e0b', status: 'זהירות' },
      red: { angle: -45, color: '#ef4444', status: 'סיכון' }
    };
    
    return statusConfig[calculatedStatus];
  }, [adjustedBalance, riskLevel]);

  return (
    <div className="relative flex flex-col items-center justify-center py-10">
      {/* SVG Gauge */}
      <svg 
        viewBox="0 0 240 160" 
        className="w-full max-w-[320px] md:max-w-[380px]"
      >
        <defs>
          {/* Glow effects */}
          <filter id="segmentGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          <filter id="needleGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Risk Zone (Red) - Left segment */}
        <path
          d="M 40 130 A 80 80 0 0 1 85 62"
          fill="none"
          stroke="#ef4444"
          strokeWidth="16"
          strokeLinecap="round"
          filter="url(#segmentGlow)"
          opacity="0.85"
        />
        
        {/* Warning Zone (Amber) - Middle segment */}
        <path
          d="M 91 59 A 80 80 0 0 1 149 59"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="16"
          strokeLinecap="round"
          filter="url(#segmentGlow)"
          opacity="0.85"
        />
        
        {/* Safe Zone (Emerald) - Right segment */}
        <path
          d="M 155 62 A 80 80 0 0 1 200 130"
          fill="none"
          stroke="#10b981"
          strokeWidth="16"
          strokeLinecap="round"
          filter="url(#segmentGlow)"
          opacity="0.85"
        />
        
        {/* Subtle tick marks */}
        {[-45, 0, 45].map((tickAngle, i) => {
          const radians = (tickAngle - 90) * (Math.PI / 180);
          const innerRadius = 72;
          const outerRadius = 82;
          const x1 = 120 + Math.cos(radians) * innerRadius;
          const y1 = 130 + Math.sin(radians) * innerRadius;
          const x2 = 120 + Math.cos(radians) * outerRadius;
          const y2 = 130 + Math.sin(radians) * outerRadius;
          
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#475569"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.5"
            />
          );
        })}
        
        {/* Elegant Needle */}
        <motion.g
          initial={{ rotate: 0 }}
          animate={{ rotate: angle }}
          transition={{ type: "spring", stiffness: 60, damping: 15 }}
          style={{ transformOrigin: '120px 130px' }}
        >
          {/* Needle line */}
          <line
            x1="120"
            y1="130"
            x2="120"
            y2="60"
            stroke="url(#needleGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            filter="url(#needleGlow)"
          />
          
          <defs>
            <linearGradient id="needleGradient" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#ffd700" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#ffd700" stopOpacity="1" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
            </linearGradient>
          </defs>
        </motion.g>
        
        {/* Center hub */}
        <circle cx="120" cy="130" r="8" fill="#1e293b" opacity="0.9" />
        <circle cx="120" cy="130" r="5" fill="#ffd700" filter="url(#needleGlow)" opacity="0.95" />
        <circle cx="120" cy="130" r="2" fill="#fff" />
      </svg>
      
      {/* Balance Display */}
      <div className="text-center mt-6 flex flex-col items-center justify-center w-full">
        <p className="text-xs text-slate-400 mb-2 tracking-wide">יתרה בטוחה לסוף החודש</p>
        <motion.p 
          key={adjustedBalance}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-3xl md:text-4xl font-bold mb-1"
          style={{ 
            color: '#ffd700',
            textShadow: '0 0 20px rgba(255, 215, 0, 0.4)',
            direction: 'ltr',
            letterSpacing: '-0.02em'
          }}
        >
          ₪{adjustedBalance.toLocaleString('he-IL')}
        </motion.p>
        
        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 mt-1">
          <span>מרווח בטיחות {Math.round(safetyBuffer * 100)}%</span>
        </div>
        
        {riskDay && (
          <p className="text-xs mt-3">
            <span className="text-slate-400">יום סיכון: </span>
            <span style={{ color }}>{riskDay}</span>
          </p>
        )}
      </div>
    </div>
  );
}