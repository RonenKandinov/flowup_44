import React from 'react';
import { motion } from 'framer-motion';

export default function StatCard({ label, value, icon: Icon, color = 'mint', delay = 0 }) {
  const colorStyles = {
    mint: {
      iconBg: 'rgba(0, 217, 148, 0.1)',
      iconColor: '#00D994',
      textColor: '#00D994'
    },
    red: {
      iconBg: 'rgba(255, 79, 79, 0.1)',
      iconColor: '#FF4F4F',
      textColor: '#FF4F4F'
    },
    white: {
      iconBg: 'rgba(255, 255, 255, 0.1)',
      iconColor: '#FFFFFF',
      textColor: '#FFFFFF'
    }
  };

  const style = colorStyles[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="relative p-6 rounded-2xl"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(20px)'
      }}
      dir="rtl"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          {label}
        </span>
        {Icon && (
          <div
            className="p-2.5 rounded-lg"
            style={{ backgroundColor: style.iconBg }}
          >
            <Icon className="w-4 h-4" style={{ color: style.iconColor }} strokeWidth={2.5} />
          </div>
        )}
      </div>
      <p className="text-3xl font-bold" style={{ color: style.textColor }}>
        {value}
      </p>
    </motion.div>
  );
}