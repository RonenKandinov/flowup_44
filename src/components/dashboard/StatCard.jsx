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
      border: 'border-cyan-500/30',
      bg: 'from-cyan-500/10 to-transparent',
      text: 'text-cyan-400',
      glow: 'shadow-cyan-500/20'
    },
    green: {
      border: 'border-green-500/30',
      bg: 'from-green-500/10 to-transparent',
      text: 'text-green-400',
      glow: 'shadow-green-500/20'
    },
    red: {
      border: 'border-red-500/30',
      bg: 'from-red-500/10 to-transparent',
      text: 'text-red-400',
      glow: 'shadow-red-500/20'
    },
    yellow: {
      border: 'border-yellow-500/30',
      bg: 'from-yellow-500/10 to-transparent',
      text: 'text-yellow-400',
      glow: 'shadow-yellow-500/20'
    }
  };

  const styles = colorStyles[color] || colorStyles.cyan;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="relative overflow-hidden p-8"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px'
      }}
    >
      {/* Decorative circuit lines */}
      <div className="absolute top-0 right-0 w-20 h-20 opacity-20">
        <svg viewBox="0 0 80 80" className="w-full h-full">
          <path
            d="M0 20 L20 20 L20 0 M60 0 L60 20 L80 20 M80 60 L60 60 L60 80 M20 80 L20 60 L0 60"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className={styles.text}
          />
        </svg>
      </div>

      <div className="flex items-start justify-between" dir="rtl">
        <div className="text-right flex-1 flex flex-col justify-center">
            <p className="text-[#94a3b8] text-[10px] mb-3 uppercase tracking-[1px]">{title}</p>
            <p className={`text-3xl md:text-4xl ${styles.text}`} style={{ fontWeight: 300 }}>
              {value}
            </p>
          </div>
        {Icon && (
          <div className={`p-2 rounded-lg bg-slate-800/50 ${styles.text}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
    </motion.div>
  );
}