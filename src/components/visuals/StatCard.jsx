import React from 'react';
import { motion } from 'framer-motion';

export default function StatCard({ label, value, icon: Icon, color = 'cyan', delay = 0 }) {
  const colors = {
    cyan: 'text-cyan-400',
    rose: 'text-rose-400',
    slate: 'text-slate-400'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="relative p-6 bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-light">
          {label}
        </span>
        {Icon && <Icon className={`w-4 h-4 ${colors[color]}`} strokeWidth={1.5} />}
      </div>
      <p className={`text-3xl font-extralight ${colors[color]}`}>
        {value}
      </p>
    </motion.div>
  );
}