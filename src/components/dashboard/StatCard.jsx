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
        relative overflow-hidden rounded-xl p-5
        border ${styles.border}
        ${styles.bg}
        backdrop-blur-sm
        hover:bg-slate-800/60 transition-all duration-300
      `}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{title}</p>
        {Icon && (
          <Icon size={16} className={`${styles.text} opacity-60`} />
        )}
      </div>
      
      <div className="flex items-baseline">
        <p className={`text-2xl font-semibold ${styles.text} tracking-tight`}>
          {value}
        </p>
      </div>
    </motion.div>
  );
}