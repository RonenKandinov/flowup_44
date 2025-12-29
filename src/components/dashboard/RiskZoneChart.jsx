import React from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip } from 'recharts';
import { motion } from 'framer-motion';
import { TrendingDown, AlertTriangle } from 'lucide-react';

export default function RiskZoneChart({ data, riskThreshold = 0, criticalDate }) {
  const chartData = data.map(item => ({
    ...item,
    isRisk: item.balance < riskThreshold
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      const isRisk = value < riskThreshold;
      return (
        <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-slate-400 text-xs">{label}</p>
          <p className={`text-lg font-bold ${isRisk ? 'text-red-400' : 'text-cyan-400'}`}>
            ₪{value.toLocaleString('he-IL')}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="relative rounded-xl p-5 md:p-6 bg-white/5 backdrop-blur-xl border border-white/10"
      style={{
        boxShadow: '0 8px 40px 0 rgba(0, 0, 0, 0.4)'
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-2">
          <TrendingDown size={14} />
          אזור סיכון
        </h3>
      </div>

      <div className="h-40 md:h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.6}/>
                <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.6}/>
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="date" 
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={{ stroke: '#334155' }}
              tickLine={false}
            />
            <YAxis 
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={{ stroke: '#334155' }}
              tickLine={false}
              tickFormatter={(value) => `₪${(value/1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine 
              y={riskThreshold} 
              stroke="#ef4444" 
              strokeDasharray="5 5" 
              strokeOpacity={0.5}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="#22d3ee"
              strokeWidth={2}
              fill="url(#balanceGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {criticalDate && (
        <div className="flex items-center gap-2 mt-3 text-sm text-yellow-400">
          <AlertTriangle size={16} />
          <span>יתרה נמוכה קריטית: {criticalDate}</span>
        </div>
      )}
    </motion.div>
  );
}