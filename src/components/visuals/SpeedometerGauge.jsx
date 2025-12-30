import React from 'react';
import { motion } from 'framer-motion';

export default function SpeedometerGauge({ 
  currentBalance, 
  projectedBalance, 
  riskStatus,
  whatIfValue = 0 
}) {
  // Calculate adjusted balance with what-if
  const adjustedBalance = projectedBalance - whatIfValue;
  
  // Determine status based on adjusted balance
  let status = 'green';
  if (adjustedBalance < 0) status = 'red';
  else if (adjustedBalance < 1000) status = 'yellow';
  
  // Calculate needle rotation (-90 to 90 degrees)
  const maxBalance = 10000;
  const percentage = Math.max(-1, Math.min(1, adjustedBalance / maxBalance));
  const rotation = percentage * 90;
  
  const statusColors = {
    green: { arc: '#22d3ee', glow: 'rgba(34, 211, 238, 0.1)' },
    yellow: { arc: '#fbbf24', glow: 'rgba(251, 191, 36, 0.1)' },
    red: { arc: '#fb7185', glow: 'rgba(251, 113, 133, 0.1)' }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative p-8 bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl"
    >
      <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-light mb-6">
        מד בטיחות פיננסית
      </h3>
      
      <div className="relative w-64 h-32 mx-auto">
        {/* SVG Gauge */}
        <svg viewBox="0 0 200 100" className="w-full h-full">
          {/* Background Arc */}
          <path
            d="M 20 90 A 80 80 0 0 1 180 90"
            fill="none"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          
          {/* Colored Arc */}
          <motion.path
            d="M 20 90 A 80 80 0 0 1 180 90"
            fill="none"
            stroke={statusColors[status].arc}
            strokeWidth="12"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 8px ${statusColors[status].glow})` }}
          />
          
          {/* Center Pivot */}
          <circle cx="100" cy="90" r="4" fill={statusColors[status].arc} />
          
          {/* Needle */}
          <motion.line
            x1="100"
            y1="90"
            x2="100"
            y2="30"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ rotate: -90 }}
            animate={{ rotate: rotation }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ transformOrigin: '100px 90px' }}
          />
        </svg>
      </div>
      
      {/* Value Display */}
      <div className="text-center mt-4">
        <p className={`text-4xl font-extralight ${statusColors[status].arc === '#22d3ee' ? 'text-cyan-400' : statusColors[status].arc === '#fbbf24' ? 'text-yellow-400' : 'text-rose-400'}`}>
          ₪{adjustedBalance.toLocaleString('he-IL')}
        </p>
        <p className="text-xs text-slate-500 mt-1">יתרה צפויה לסוף החודש</p>
      </div>
    </motion.div>
  );
}