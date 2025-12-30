import React from 'react';
import { motion } from 'framer-motion';

export default function StatCard({ label, value, icon: Icon, color = 'blue', delay = 0 }) {
  const colors = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    red: 'text-red-600',
    slate: 'text-slate-600'
  };

  const bgColors = {
    blue: 'bg-blue-50',
    green: 'bg-green-50',
    red: 'bg-red-50',
    slate: 'bg-slate-50'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="relative p-6 bg-white rounded-2xl shadow-sm border border-slate-200"
      dir="rtl"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          {label}
        </span>
        {Icon && (
          <div className={`p-2 rounded-lg ${bgColors[color]}`}>
            <Icon className={`w-5 h-5 ${colors[color]}`} strokeWidth={2} />
          </div>
        )}
      </div>
      <p className={`text-4xl font-bold ${colors[color]}`}>
        {value}
      </p>
    </motion.div>
  );
}