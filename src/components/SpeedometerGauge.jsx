import React from 'react';
import { motion } from 'framer-motion';

export default function SpeedometerGauge({ 
  projectedBalance = 0, 
  label = "תחזית יתרה", 
  riskLevel = "green",
  riskDay = null,
  whatIfAmount = 0,
  engineData = null
}) {
  // Normalize values for the gauge (assuming -10000 to +10000 range for visual scaling)
  const minVal = -10000;
  const maxVal = 10000;
  
  // Clamp value
  const clampedValue = Math.max(minVal, Math.min(maxVal, projectedBalance));
  
  // Convert to percentage (0 to 1)
  const percentage = (clampedValue - minVal) / (maxVal - minVal);
  
  // Convert to degrees (180 degree gauge, -90 to +90)
  const rotation = (percentage * 180) - 90;

  // Colors
  const colors = {
    green: "text-emerald-500",
    yellow: "text-amber-500",
    red: "text-red-500"
  };

  const bgColors = {
    green: "bg-emerald-500",
    yellow: "bg-amber-500",
    red: "bg-red-500"
  };

  const colorClass = colors[riskLevel] || colors.green;
  const bgColorClass = bgColors[riskLevel] || bgColors.green;

  return (
    <div className="relative w-full max-w-[320px] aspect-[2/1] mx-auto mt-4 mb-8">
      {/* Gauge Background Arc */}
      <div className="absolute inset-0 overflow-hidden rounded-t-full bg-slate-800/50">
        <div className="w-full h-full border-[20px] border-slate-800 rounded-t-full" />
      </div>

      {/* Ticks */}
      <div className="absolute bottom-0 left-[10%] text-xs text-slate-500 font-mono">-10k</div>
      <div className="absolute bottom-0 left-[50%] -translate-x-1/2 text-xs text-slate-600 font-mono">0</div>
      <div className="absolute bottom-0 right-[10%] text-xs text-slate-500 font-mono">+10k</div>

      {/* Needle Wrapper (Rotation) */}
      <motion.div 
        className="absolute bottom-0 left-1/2 w-full h-full origin-bottom-center"
        initial={{ rotate: -90 }}
        animate={{ rotate: rotation }}
        transition={{ type: "spring", stiffness: 50, damping: 15 }}
        style={{ transformOrigin: 'bottom center' }}
      >
        {/* The Needle */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-[90%] bg-slate-200 rounded-full shadow-lg shadow-black/50" />
        {/* Needle Base */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full translate-y-1/2 z-10" />
      </motion.div>

      {/* Value Display Overlay */}
      <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 text-center w-full">
        <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">{label}</p>
        <motion.h3 
          className={`text-4xl font-bold font-mono ${colorClass} drop-shadow-lg`}
          key={projectedBalance}
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
        >
          ₪{Math.round(projectedBalance).toLocaleString()}
        </motion.h3>
        
        {riskDay && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${bgColorClass} bg-opacity-10 border border-${riskLevel === 'red' ? 'red' : 'amber'}-500/20`}
          >
            <span className={`w-2 h-2 rounded-full ${bgColorClass} animate-pulse`} />
            <span className={`text-xs font-bold ${colorClass}`}>
              צפי למינוס ב-{riskDay}
            </span>
          </motion.div>
        )}

        {/* Engine Meta Info (Confidence) */}
        {engineData && engineData.confidence && (
            <div className="mt-2 text-[10px] text-slate-600 font-mono flex items-center justify-center gap-2">
                <span>Confidence: {engineData.confidence}%</span>
                <span>•</span>
                <span>TXs: {engineData.transactionCount || 0}</span>
                <span>•</span>
                <span className="opacity-50">v1.0</span>
            </div>
        )}
      </div>
    </div>
  );
}