import React from 'react';
import { motion } from 'framer-motion';

export default function SpeedometerGauge({ 
  projectedBalance, 
  riskLevel,
  whatIfAmount = 0 
}) {
  const adjustedBalance = projectedBalance - whatIfAmount;

  // Determine color based on risk level
  let gaugeColor = '#00D994'; // Mint Green
  let status = 'בטוח';
  
  if (adjustedBalance < 0) {
    gaugeColor = '#FF4F4F'; // Soft Red
    status = 'סיכון גבוה';
  } else if (adjustedBalance < 1000) {
    gaugeColor = '#FFA500'; // Yellow/Orange
    status = 'זהירות';
  }

  // Calculate needle rotation (-90 to 90)
  const maxBalance = Math.max(15000, Math.abs(adjustedBalance) * 2);
  const percentage = Math.max(-1, Math.min(1, adjustedBalance / maxBalance));
  const rotation = percentage * 90;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="relative p-8 rounded-2xl"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(20px)'
      }}
      dir="rtl"
    >
      <h3 className="text-sm font-semibold text-slate-300 mb-8 text-center">
        יתרה בטוחה צפויה לסוף חודש
      </h3>

      {/* SVG Gauge */}
      <div className="relative w-full max-w-sm h-48 mx-auto mb-6">
        <svg viewBox="0 0 200 120" className="w-full h-full">
          {/* Background Arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="24"
            strokeLinecap="round"
          />

          {/* Colored Arc with Glow */}
          <motion.path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={gaugeColor}
            strokeWidth="24"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{
              filter: `drop-shadow(0 0 12px ${gaugeColor}80)`
            }}
          />

          {/* Center Pivot */}
          <circle cx="100" cy="100" r="8" fill={gaugeColor} />

          {/* Needle */}
          <motion.line
            x1="100"
            y1="100"
            x2="100"
            y2="30"
            stroke="#FFFFFF"
            strokeWidth="4"
            strokeLinecap="round"
            initial={{ rotate: -90 }}
            animate={{ rotate: rotation }}
            transition={{ duration: 0.8, ease: "easeOut", type: "spring" }}
            style={{ 
              transformOrigin: '100px 100px',
              filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.5))'
            }}
          />
        </svg>
      </div>

      {/* Balance Display */}
      <div className="text-center">
        <motion.p
          key={adjustedBalance}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-6xl font-bold mb-2"
          style={{ color: gaugeColor }}
        >
          ₪{adjustedBalance.toLocaleString('he-IL')}
        </motion.p>
        <p className="text-sm font-medium" style={{ color: gaugeColor }}>
          {status}
        </p>
      </div>
    </motion.div>
  );
}