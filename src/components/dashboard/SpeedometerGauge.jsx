import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

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
    // Map balance to angle based on risk level and balance
    // Balance >= 3000: green zone (-60°)
    // Balance 1000-3000: yellow zone (0°)
    // Balance < 1000: red zone (60°)
    
    let calculatedAngle;
    let calculatedColor;
    let calculatedGlow;
    
    // Use risk level as primary indicator if available
    if (riskLevel === 'green' || adjustedBalance >= 3000) {
      calculatedAngle = -60;
      calculatedColor = '#22c55e';
      calculatedGlow = 'rgba(34, 197, 94, 0.5)';
    } else if (riskLevel === 'yellow' || (adjustedBalance >= 1000 && adjustedBalance < 3000)) {
      // Linear interpolation between yellow (0°) and green (-60°)
      const ratio = (adjustedBalance - 1000) / 2000;
      calculatedAngle = -60 * ratio;
      calculatedColor = '#eab308';
      calculatedGlow = 'rgba(234, 179, 8, 0.5)';
    } else {
      // Red zone
      if (adjustedBalance < 0) {
        calculatedAngle = 60;
      } else {
        const ratio = adjustedBalance / 1000;
        calculatedAngle = 60 - (60 * ratio);
      }
      calculatedColor = '#ef4444';
      calculatedGlow = 'rgba(239, 68, 68, 0.5)';
    }
    
    return { 
      angle: calculatedAngle, 
      color: calculatedColor, 
      glowColor: calculatedGlow 
    };
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
        
        {/* Needle - Classic Speedometer Style */}
        <motion.g
          initial={{ rotate: 0 }}
          animate={{ rotate: angle }}
          transition={{ type: "spring", stiffness: 60, damping: 15 }}
          style={{ transformOrigin: '100px 100px' }}
        >
          {/* Needle pointer */}
            <path
              d="M 100 100 L 95 95 L 100 35 L 105 95 Z"
              fill="white"
              stroke="white"
              strokeWidth="1"
              filter="url(#glow)"
            />
            {/* Center cap */}
            <circle cx="100" cy="100" r="6" fill="white" filter="url(#glow)" />
            <circle cx="100" cy="100" r="3" fill="#1e293b" />
        </motion.g>
      </svg>
      
      {/* Balance Display */}
      <div className="text-center mt-2">
        <p className="text-xs text-slate-400 mb-1">יתרה צפויה לסוף החודש</p>
        <motion.p 
          key={adjustedBalance}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-3xl md:text-4xl font-bold text-white"
        >
          ₪{adjustedBalance.toLocaleString('he-IL')}
        </motion.p>
        
        {/* Risk Day Display */}
        {riskDay && (
          <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-xs text-red-400">
              <span className="font-medium">יום סיכון: </span>
              <span className="text-sm font-bold">{riskDay}</span>
            </p>
          </div>
        )}
        
        {/* Engine Stats */}
        {engineData && (
          <div className="mt-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
            <div className="text-xs text-slate-400 space-y-1.5">
              <div className="flex justify-between items-center">
                <span>רמת ביטחון:</span>
                <span className={`font-medium ${
                  engineData.confidence === 'high' ? 'text-green-400' :
                  engineData.confidence === 'medium' ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {engineData.confidence === 'high' ? 'גבוהה' :
                   engineData.confidence === 'medium' ? 'בינונית' : 'נמוכה'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>עסקאות נותחו:</span>
                <span className="text-slate-300 font-medium">{engineData.transactionCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>מנוע חיזוי:</span>
                <span className="text-cyan-400 text-[10px]">Hybrid SES</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}