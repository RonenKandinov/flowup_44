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
    <div className="relative flex flex-col items-center py-8">
      {/* SVG Gauge */}
      <svg 
        viewBox="0 0 240 160" 
        className="w-full max-w-[320px] md:max-w-[400px]"
      >
        <defs>
          {/* Clear color zones gradient */}
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="35%" stopColor="#ef4444" />
            <stop offset="40%" stopColor="#f59e0b" />
            <stop offset="65%" stopColor="#f59e0b" />
            <stop offset="70%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          
          {/* Glow effect */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          {/* Needle glow */}
          <filter id="needleGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Red Zone (0-40%) */}
        <path
          d="M 40 130 A 80 80 0 0 0 91 56"
          fill="none"
          stroke="#ef4444"
          strokeWidth="20"
          strokeLinecap="round"
          filter="url(#glow)"
        />
        
        {/* Amber Zone (40-70%) */}
        <path
          d="M 93 55 A 80 80 0 0 0 147 55"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="20"
          strokeLinecap="round"
          filter="url(#glow)"
        />
        
        {/* Green Zone (70-100%) */}
        <path
          d="M 149 56 A 80 80 0 0 0 200 130"
          fill="none"
          stroke="#10b981"
          strokeWidth="20"
          strokeLinecap="round"
          filter="url(#glow)"
        />
        
        {/* Background arc (darker) */}
        <path
          d="M 40 130 A 80 80 0 0 1 200 130"
          fill="none"
          stroke="#1e293b"
          strokeWidth="22"
          strokeLinecap="round"
          opacity="0.3"
        />
        
        {/* Tick marks */}
        {[-45, -22.5, 0, 22.5, 45].map((tickAngle, i) => {
          const radians = (tickAngle - 90) * (Math.PI / 180);
          const innerRadius = 70;
          const outerRadius = 85;
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
              strokeWidth="2"
              strokeLinecap="round"
            />
          );
        })}
        
        {/* Animated Needle */}
        <motion.g
          initial={{ rotate: 0 }}
          animate={{ rotate: angle }}
          transition={{ type: "spring", stiffness: 50, damping: 20 }}
          style={{ transformOrigin: '120px 130px' }}
        >
          {/* Needle shadow */}
          <path
            d="M 120 130 L 118 75 L 120 70 L 122 75 Z"
            fill="#000"
            opacity="0.3"
            transform="translate(2, 2)"
          />
          
          {/* Needle body */}
          <path
            d="M 120 130 L 118 75 L 120 70 L 122 75 Z"
            fill="url(#needleGradient)"
            filter="url(#needleGlow)"
          />
          
          <defs>
            <linearGradient id="needleGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffd700" />
              <stop offset="100%" stopColor="#ff8c00" />
            </linearGradient>
          </defs>
        </motion.g>
        
        {/* Center hub */}
        <circle cx="120" cy="130" r="12" fill="#1e293b" />
        <circle cx="120" cy="130" r="8" fill="#ffd700" filter="url(#needleGlow)" />
        <circle cx="120" cy="130" r="4" fill="#fff" />
      </svg>
      
      {/* Balance Display */}
      <div className="text-center mt-4 flex flex-col items-center justify-center">
        <p className="text-sm text-slate-400 mb-2">יתרה בטוחה לסוף החודש</p>
        <motion.p 
          key={adjustedBalance}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-2xl md:text-3xl font-bold mb-2"
          style={{ 
            color: '#ffd700',
            textShadow: '0 0 30px rgba(255, 215, 0, 0.6)',
            direction: 'ltr'
          }}
        >
          ₪{adjustedBalance.toLocaleString('he-IL')}
        </motion.p>
        
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <span>מרווח בטיחות {Math.round(safetyBuffer * 100)}%</span>
        </div>
        
        {riskDay && (
          <p className="text-sm mt-3">
            <span className="text-slate-400">יום סיכון: </span>
            <span style={{ color }}>{riskDay}</span>
          </p>
        )}
      </div>
    </div>
  );
}