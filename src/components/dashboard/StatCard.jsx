import React from 'react';
import { motion } from 'framer-motion';

export default function StatCard({ title, value, icon: Icon, color = 'cyan', delay = 0 }) {
  // Define modern glassmorphism color styles
  const colorStyles = {
    cyan: {
      gradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(14, 165, 233, 0.05) 100%)',
      text: 'text-slate-700',
      icon: 'text-cyan-500',
      iconBg: 'bg-cyan-50'
    },
    green: {
      gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)',
      text: 'text-slate-700',
      icon: 'text-emerald-500',
      iconBg: 'bg-emerald-50'
    },
    red: {
      gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%)',
      text: 'text-slate-700',
      icon: 'text-rose-500',
      iconBg: 'bg-rose-50'
    },
    yellow: {
      gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.05) 100%)',
      text: 'text-slate-700',
      icon: 'text-amber-500',
      iconBg: 'bg-amber-50'
    }
  };

  const style = colorStyles[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 100 }}
      className="relative rounded-2xl p-5 bg-white/80 backdrop-blur-xl shadow-lg border border-white/20 hover:shadow-xl transition-shadow duration-300"
      style={{
        background: style.gradient,
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${style.iconBg}`}>
          {Icon && <Icon className={`w-5 h-5 ${style.icon}`} strokeWidth={2.5} />}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{title}</p>
        <p className={`text-2xl md:text-3xl font-bold ${style.text}`} style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          {value}
        </p>
      </div>
    </motion.div>
  );
}