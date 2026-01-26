import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, Anchor, Zap } from 'lucide-react';

const FutureCake = ({ fixedExpenses = 0, flexExpenses = 0, currency = '₪' }) => {
  const [activeIndex, setActiveIndex] = useState(null);

  const data = [
    { name: 'עוגנים (קבוע)', value: fixedExpenses, color: '#FF85A1', icon: <Anchor className="w-4 h-4" /> }, // Pink
    { name: 'פלקס (משתנה)', value: flexExpenses, color: '#2DD4BF', icon: <Zap className="w-4 h-4" /> },   // Turquoise
  ];

  const activeItem = activeIndex !== null ? data[activeIndex] : null;
  const total = fixedExpenses + flexExpenses;

  // Custom Tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-2 rounded-lg shadow-xl text-xs text-white">
          <p className="font-bold mb-1">{payload[0].name}</p>
          <p className="text-cyan-400 font-mono">
             {currency}{payload[0].value.toLocaleString()} ({Math.round((payload[0].value / total) * 100)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full bg-slate-800/40 rounded-xl border border-slate-700/40 p-5 relative overflow-hidden flex flex-col items-center justify-center min-h-[300px]" dir="rtl">
      
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <h3 className="text-white text-sm font-medium uppercase tracking-wide">עוגת העתיד</h3>
      </div>

      <div className="w-full h-[220px] relative mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={85}
              paddingAngle={5}
              dataKey="value"
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color} 
                    style={{
                        filter: activeIndex === index ? `drop-shadow(0 0 8px ${entry.color})` : 'none',
                        transition: 'all 0.3s ease'
                    }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center Insight Text */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none w-32">
            <AnimatePresence mode="wait">
                {activeItem ? (
                    <motion.div
                        key="active"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="flex flex-col items-center"
                    >
                        <span className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{activeItem.name.split(' ')[0]}</span>
                        <span className="text-xl font-bold text-white font-mono">{currency}{activeItem.value.toLocaleString()}</span>
                    </motion.div>
                ) : (
                    <motion.div
                        key="default"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center"
                    >
                        <span className="text-slate-500 text-[10px] uppercase">סך הכל</span>
                        <span className="text-lg font-bold text-slate-200 font-mono">{currency}{total.toLocaleString()}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
      </div>

      {/* Legend / Key */}
      <div className="grid grid-cols-2 gap-4 w-full mt-2">
         {data.map((item, i) => (
             <div 
                key={i} 
                className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors ${activeIndex === i ? 'bg-slate-700/50 border-slate-600' : 'bg-transparent border-transparent hover:bg-slate-800/50'}`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
             >
                 <div className="w-2 h-8 rounded-full" style={{ backgroundColor: item.color }}></div>
                 <div className="flex flex-col">
                     <span className="text-[10px] text-slate-400 flex items-center gap-1">
                         {item.icon}
                         {item.name}
                     </span>
                     <span className="text-xs font-bold text-slate-200">{currency}{item.value.toLocaleString()}</span>
                 </div>
             </div>
         ))}
      </div>
    </div>
  );
};

export default FutureCake;