import React from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

export default function RiskChart({ data }) {
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/90 backdrop-blur-sm border border-white/[0.1] rounded-lg p-3">
          <p className="text-slate-400 text-xs">{payload[0].payload.date}</p>
          <p className="text-cyan-400 text-lg font-light">
            ₪{payload[0].value.toLocaleString('he-IL')}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="relative p-8 bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl"
    >
      <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-light mb-6">
        מפת סיכונים - 30 יום
      </h3>
      
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <defs>
              <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="date" 
              tick={{ fill: '#475569', fontSize: 9 }}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.05)' }}
              tickLine={false}
            />
            <YAxis 
              tick={{ fill: '#475569', fontSize: 9 }}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.05)' }}
              tickLine={false}
              tickFormatter={(value) => `₪${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="#22d3ee"
              strokeWidth={1.5}
              fill="url(#balanceGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}