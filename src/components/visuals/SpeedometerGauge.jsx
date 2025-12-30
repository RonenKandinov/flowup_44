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
  else if (adjustedBalance < 2000) status = 'yellow';
  
  // Calculate needle rotation (-90 to 90 degrees)
  const maxBalance = Math.max(15000, Math.abs(adjustedBalance) * 1.5);
  const percentage = Math.max(-1, Math.min(1, adjustedBalance / maxBalance));
  const rotation = percentage * 90;
  
  const statusColors = {
    green: { arc: '#10b981', needle: '#059669', text: 'text-green-600' },
    yellow: { arc: '#f59e0b', needle: '#d97706', text: 'text-yellow-600' },
    red: { arc: '#ef4444', needle: '#dc2626', text: 'text-red-600' }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative p-8 bg-white rounded-2xl shadow-sm border border-slate-200"
      dir="rtl"
    >
      <h3 className="text-sm font-semibold text-slate-700 mb-6 text-center">
        מד בטיחות פיננסית
      </h3>
      
      <div className="relative w-full max-w-xs h-40 mx-auto">
        <svg viewBox="0 0 200 110" className="w-full h-full">
          {/* Background Arc */}
          <path
            d="M 20 95 A 80 80 0 0 1 180 95"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="20"
            strokeLinecap="round"
          />
          
          {/* Colored Arc */}
          <motion.path
            d="M 20 95 A 80 80 0 0 1 180 95"
            fill="none"
            stroke={statusColors[status].arc}
            strokeWidth="20"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
          
          {/* Center Pivot */}
          <circle cx="100" cy="95" r="6" fill={statusColors[status].needle} />
          
          {/* Needle */}
          <motion.line
            x1="100"
            y1="95"
            x2="100"
            y2="25"
            stroke={statusColors[status].needle}
            strokeWidth="4"
            strokeLinecap="round"
            initial={{ rotate: -90 }}
            animate={{ rotate: rotation }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ transformOrigin: '100px 95px' }}
          />
        </svg>
      </div>
      
      {/* Value Display */}
      <div className="text-center mt-2">
        <p className={`text-5xl font-bold ${statusColors[status].text}`}>
          ₪{adjustedBalance.toLocaleString('he-IL')}
        </p>
        <p className="text-sm text-slate-500 mt-2 font-medium">יתרה צפויה לסוף החודש</p>
      </div>
    </motion.div>
  );
}