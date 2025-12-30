import React, { useMemo } from 'react';

export default function SmoothGauge({ projectedBalance, riskDay }) {
  // Hard-coded snap logic: 150°/90°/30°
  const angle = useMemo(() => {
    if (projectedBalance <= 0) return 150;
    if (projectedBalance < 2000) return 90;
    return 30;
  }, [projectedBalance]);

  return (
    <div className="relative flex flex-col items-center">
      {/* SVG Gauge */}
      <svg 
        viewBox="0 0 200 120" 
        className="w-full max-w-[300px]"
      >
        <defs>
          {/* Smooth Gradient Arc */}
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          
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
        
        {/* White Needle - 80% of arc radius (70 * 0.8 = 56) */}
        <line
          x1="100"
          y1="100"
          x2="100"
          y2="44"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
          style={{
            transform: `rotate(${angle}deg)`,
            transformOrigin: '100px 100px',
            transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        />
        
        {/* Base circle */}
        <circle cx="100" cy="100" r="6" fill="#1e293b" />
        <circle cx="100" cy="100" r="3" fill="#FFFFFF" />
      </svg>
      
      {/* Value Display */}
      <div className="text-center mt-2">
        <p className="text-xs text-slate-400 mb-1">יתרה צפויה לסוף החודש</p>
        <p className="text-4xl font-bold text-white">
          ₪{projectedBalance.toLocaleString('he-IL')}
        </p>
        {riskDay && (
          <p className="text-sm mt-1">
            <span className="text-slate-400">יום סיכון: </span>
            <span className="text-yellow-400">{riskDay}</span>
          </p>
        )}
      </div>
    </div>
  );
}