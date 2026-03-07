import React from 'react';
import { motion } from 'framer-motion';

export default function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  color = 'cyan',
  delay = 0
}) {
  const colorStyles = {
    cyan: {
      border: 'border-cyan-500/20',
      bg: 'bg-slate-800/40',
      text: 'text-cyan-400',
      glow: 'shadow-none'
    },
    green: {
      border: 'border-green-500/20',
      bg: 'bg-slate-800/40',
      text: 'text-green-400',
      glow: 'shadow-none'
    },
    red: {
      border: 'border-red-500/20',
      bg: 'bg-slate-800/40',
      text: 'text-red-400',
      glow: 'shadow-none'
    },
    yellow: {
      border: 'border-yellow-500/20',
      bg: 'bg-slate-800/40',
      text: 'text-yellow-400',
      glow: 'shadow-none'
    }
  };

  const styles = colorStyles[color] || colorStyles.cyan;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className={`
        relative overflow-hidden rounded-xl p-2 md:p-5
        border ${styles.border}
        ${styles.bg}
        backdrop-blur-sm
        hover:bg-slate-800/60 transition-all duration-300
        flex flex-col justify-between h-full
      `}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-1 md:mb-3">
        <p className="text-slate-400 text-[10px] md:text-xs font-medium uppercase tracking-wider truncate">{title}</p>
        {Icon && (
          <Icon className={`${styles.text} opacity-60 w-3 h-3 md:w-4 md:h-4 hidden md:block`} />
        )}
      </div>
      
      <div className="flex flex-col">
        <div className="flex items-baseline">
            <p className={`text-sm sm:text-base md:text-2xl font-bold ${styles.text} tracking-tight truncate`}>
            {value}
            </p>
        </div>
      </div>
    </motion.div>
  );
}