import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export default function SpeedometerGauge({ 
  projectedBalance, 
  riskLevel = 'green',
  riskDay,
  whatIfAmount = 0 
}) {
  // Calculate needle angle based on projectedEOM
  const projectedEOM = projectedBalance - whatIfAmount;
  
  const { angle, color } = useMemo(() => {
    let needleAngle = 90; // Default yellow center
    let textColor = '#eab308'; // Yellow
    
    // SNAP-LOGIC:
    if (projectedEOM <= 0) {
      needleAngle = 150; // Red zone
      textColor = '#ef4444'; // Red
    } else if (projectedEOM > 0 && projectedEOM < 2000) {
      needleAngle = 90; // Yellow center
      textColor = '#eab308'; // Yellow
    } else if (projectedEOM >= 2000) {
      needleAngle = 30; // Green zone
      textColor = '#22c55e'; // Green
    }
    
    return { angle: needleAngle, color: textColor };
  }, [projectedEOM]);

  return (
    <div className="relative flex flex-col items-center">
      {/* Gauge SVG */}
      <svg 
        viewBox="0 0 200 120" 
        className="w-full max-w-[280px] md:max-w-[320px]"
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
        
        {/* White Needle with CSS transition */}
        <g
          style={{ 
            transformOrigin: '100px 100px',
            transform: `rotate(${angle}deg)`,
            transition: 'transform 0.3s ease-out'
          }}
        >
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="40"
            stroke="#FFFFFF"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
        
        {/* White pivot circle */}
        <circle cx="100" cy="100" r="6" fill="#FFFFFF" />
      </svg>
      
      {/* Balance Display */}
      <div className="text-center mt-2">
        <p className="text-xs text-slate-400 mb-1">יתרה צפויה לסוף החודש</p>
        <p 
          className="text-3xl md:text-4xl font-bold transition-colors duration-300"
          style={{ color }}
        >
          ₪{projectedEOM.toLocaleString('he-IL')}
        </p>
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