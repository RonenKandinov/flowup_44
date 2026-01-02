import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Calendar, TrendingDown } from 'lucide-react';

export default function RiskDayDisplay({ riskDay, riskDaysCount, trend }) {
  if (!riskDay) return null;

  const isImmediate = riskDay === 'מיידי';
  
  // Color scheme based on trend or immediate risk
  const colorScheme = isImmediate
    ? {
        bg: 'bg-red-500/20',
        border: 'border-red-500',
        text: 'text-red-400',
        icon: 'text-red-500',
        glow: 'shadow-red-500/50'
      }
    : trend === 'negative'
    ? {
        bg: 'bg-red-500/10',
        border: 'border-red-500/50',
        text: 'text-red-400',
        icon: 'text-red-500',
        glow: 'shadow-red-500/30'
      }
    : trend === 'positive'
    ? {
        bg: 'bg-green-500/10',
        border: 'border-green-500/50',
        text: 'text-green-400',
        icon: 'text-green-500',
        glow: 'shadow-green-500/30'
      }
    : {
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/50',
        text: 'text-yellow-400',
        icon: 'text-yellow-500',
        glow: 'shadow-yellow-500/30'
      };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`relative p-4 rounded-xl border-2 ${colorScheme.border} ${colorScheme.bg} backdrop-blur-sm ${colorScheme.glow} shadow-lg`}
    >
      {/* Warning pulse for immediate risk */}
      {isImmediate && (
        <div className="absolute inset-0 rounded-xl border-2 border-red-500 animate-ping opacity-20" />
      )}
      
      <div className="relative flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-slate-900/50 ${colorScheme.icon}`}>
          {isImmediate ? (
            <AlertTriangle size={24} className="animate-pulse" />
          ) : (
            <Calendar size={24} />
          )}
        </div>
        
        <div className="flex-1">
          <p className="text-xs text-slate-400 mb-0.5">
            {isImmediate ? 'אזהרה קריטית' : 'יום סיכון צפוי'}
          </p>
          <div className="flex items-baseline gap-2">
            <p className={`text-2xl font-bold ${colorScheme.text}`}>
              {riskDay}
            </p>
            {riskDaysCount !== null && riskDaysCount !== undefined && !isImmediate && (
              <p className="text-xs text-slate-500">
                ({riskDaysCount} ימים)
              </p>
            )}
          </div>
        </div>

        {/* Trend indicator */}
        {trend && !isImmediate && (
          <div className={`text-xs px-2 py-1 rounded-md ${
            trend === 'negative' 
              ? 'bg-red-500/20 text-red-400' 
              : trend === 'positive'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-yellow-500/20 text-yellow-400'
          }`}>
            {trend === 'negative' ? '↓ גרוע' : trend === 'positive' ? '↑ טוב' : '→'}
          </div>
        )}
      </div>
      
      {isImmediate && (
        <p className="text-xs text-red-300 mt-2 text-center">
          היתרה צפויה להיות שלילית - דרוש תגבור מיידי
        </p>
      )}
    </motion.div>
  );
}