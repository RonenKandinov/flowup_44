import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export default function SpeedometerGauge({ 
  currentBalance,
  projectedBalance, 
  riskLevel = 'green',
  riskDay,
  whatIfAmount = 0 
}) {
  // Calculate safe balance (17% buffer applied)
  const safeBalance = currentBalance * 0.83 - whatIfAmount;
  
  // Calculate position on semi-circle (0 to 180 degrees)
  // Map balance to angle: negative = 0°, positive = 180°
  const { angle, color } = useMemo(() => {
    const maxBalance = 10000; // Adjust based on typical user balance
    const minBalance = -2000;
    
    let normalizedBalance = (safeBalance - minBalance) / (maxBalance - minBalance);
    normalizedBalance = Math.max(0, Math.min(1, normalizedBalance)); // Clamp 0-1
    
    const calculatedAngle = normalizedBalance * 180; // 0° to 180°
    
    // Determine color based on safe balance
    let gaugeColor = '#10b981'; // Green
    if (safeBalance < 0) {
      gaugeColor = '#ef4444'; // Red
    } else if (safeBalance < 1000) {
      gaugeColor = '#f59e0b'; // Amber
    }
    
    return { angle: calculatedAngle, color: gaugeColor };
  }, [safeBalance]);

  return (
    <div className="relative flex flex-col items-center py-8">
      {/* Semi-Circle Arc Gauge */}
      <svg 
        viewBox="0 0 200 110" 
        className="w-full max-w-[300px]"
      >
        <defs>
          {/* Gradient from Red to Green */}
          <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.6" />
          </linearGradient>
          
          {/* Active gradient based on current position */}
          <linearGradient id="activeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.4" />
          </linearGradient>
        </defs>
        
        {/* Background arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="url(#arcGradient)"
          strokeWidth="16"
          strokeLinecap="round"
          opacity="0.3"
        />
        
        {/* Active arc (up to needle position) */}
        <motion.path
          d={`M 20 100 A 80 80 0 ${angle > 90 ? '1' : '0'} 1 ${
            100 + 80 * Math.cos((180 - angle) * Math.PI / 180)
          } ${
            100 - 80 * Math.sin((180 - angle) * Math.PI / 180)
          }`}
          fill="none"
          stroke="url(#activeGradient)"
          strokeWidth="16"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
        
        {/* Minimalist Needle */}
        <motion.g
          initial={{ rotate: 0 }}
          animate={{ rotate: angle }}
          transition={{ type: "spring", stiffness: 50, damping: 20 }}
          style={{ transformOrigin: '100px 100px' }}
        >
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="30"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="100" cy="100" r="6" fill={color} />
        </motion.g>
        
        {/* Center white dot */}
        <circle cx="100" cy="100" r="3" fill="white" />
      </svg>
      
      {/* Safe Balance Display */}
      <div className="text-center -mt-4">
        <p className="text-xs font-medium text-slate-500 mb-2 tracking-wide uppercase">יתרה בטוחה</p>
        <motion.p 
          key={safeBalance}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-5xl font-bold tracking-tight"
          style={{ 
            color,
            fontFamily: 'Inter, system-ui, sans-serif'
          }}
        >
          ₪{Math.round(safeBalance).toLocaleString('he-IL')}
        </motion.p>
        <p className="text-xs text-slate-400 mt-2">כולל מרווח בטיחות 17%</p>
        {riskDay && safeBalance < 1000 && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30"
          >
            <p className="text-xs text-amber-400">
              יום סיכון: {riskDay}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}