import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Anchor, Zap, Sparkles } from 'lucide-react';

const FutureCake = ({ fixedExpenses = 0, flexExpenses = 0, taxRefundPotential = 0, currency = '₪' }) => {
  const [activeIndex, setActiveIndex] = useState(null);

  // 1. Preview Mode Logic (Empty State)
  const isPreviewMode = fixedExpenses === 0 && flexExpenses === 0;

  const chartData = isPreviewMode 
    ? [
        { name: 'עוגנים (קשיח)', value: 6000, color: '#FF85A1', icon: <Anchor className="w-4 h-4" />, type: 'fixed' },
        { name: 'פלקס (גמיש)', value: 4000, color: '#2DD4BF', icon: <Zap className="w-4 h-4" />, type: 'flex' }
      ]
    : [
        { name: 'עוגנים (קשיח)', value: fixedExpenses, color: '#FF85A1', icon: <Anchor className="w-4 h-4" />, type: 'fixed' },
        { name: 'פלקס (גמיש)', value: flexExpenses, color: '#2DD4BF', icon: <Zap className="w-4 h-4" />, type: 'flex' },
      ];

  // 2. Add Tax Segment if exists (The Saderan Layer)
  if (!isPreviewMode && taxRefundPotential > 0) {
      chartData.push({
          name: 'החזרי מס (פוטנציאל)',
          value: taxRefundPotential,
          color: '#F59E0B', // Amber/Gold for found money
          icon: <Sparkles className="w-4 h-4" />,
          type: 'tax',
          isGlowing: true
      });
  }

  const activeItem = activeIndex !== null ? chartData[activeIndex] : null;
  const totalExpenses = (isPreviewMode ? 10000 : fixedExpenses + flexExpenses);

  // Custom Tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 p-2 rounded-lg shadow-xl text-xs text-white z-50">
          <p className="font-bold mb-1">{item.name}</p>
          <p className={item.type === 'tax' ? "text-amber-400 font-mono" : "text-cyan-400 font-mono"}>
             {currency}{item.value.toLocaleString()} 
             {item.type !== 'tax' && ` (${Math.round((item.value / totalExpenses) * 100)}%)`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full bg-slate-800/40 rounded-xl border border-slate-700/40 p-5 relative overflow-hidden flex flex-col items-center justify-center min-h-[300px]" dir="rtl">
      
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <div className="flex flex-col items-end">
          <h3 className="text-white text-lg font-bold uppercase tracking-tight font-sans">Future Cake</h3>
          <span className="text-xs text-slate-400">תחזית הוצאות לחודש הבא</span>
        </div>
        {isPreviewMode && <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">Preview Mode</span>}
      </div>

      <div className="w-full h-[220px] relative mt-6">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
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
              {chartData.map((entry, index) => (
                <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color} 
                    style={{
                        filter: entry.isGlowing 
                            ? `drop-shadow(0 0 10px ${entry.color})` 
                            : activeIndex === index ? `drop-shadow(0 0 8px ${entry.color})` : 'none',
                        transition: 'all 0.3s ease',
                        opacity: activeIndex !== null && activeIndex !== index ? 0.6 : 1
                    }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center Insight Text */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none w-40 z-10">
            <AnimatePresence mode="wait">
                {activeItem ? (
                    <motion.div
                        key="active"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="flex flex-col items-center"
                    >
                        {activeItem.type === 'tax' ? (
                            <>
                                <span className="text-amber-400 text-[10px] uppercase tracking-wider mb-1 font-bold">החזרי מס והטבות</span>
                                <span className="text-sm font-medium text-slate-200 leading-tight">
                                    זיהיתי <span className="font-bold text-amber-400">{currency}{activeItem.value.toLocaleString()}</span> שמגיעים לך מהמדינה
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{activeItem.name.split(' ')[0]}</span>
                                <span className="text-2xl font-bold text-white font-mono">{currency}{activeItem.value.toLocaleString()}</span>
                            </>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="default"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center"
                    >
                        {isPreviewMode ? (
                             <>
                                <span className="text-slate-500 text-[10px] uppercase">צפי חודשי</span>
                                <span className="text-xl font-bold text-slate-200 font-mono">{currency}10,000</span>
                             </>
                        ) : (
                            <>
                                <span className="text-slate-500 text-[10px] uppercase">צפי חודשי</span>
                                <span className="text-xl font-bold text-slate-200 font-mono">{currency}{totalExpenses.toLocaleString()}</span>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
      </div>

      {/* Legend / Key */}
      <div className="grid grid-cols-2 gap-3 w-full mt-2 px-2">
         {chartData.map((item, i) => (
             <div 
                key={i} 
                className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors ${activeIndex === i ? 'bg-slate-700/50 border-slate-600' : 'bg-transparent border-transparent hover:bg-slate-800/50'} ${item.type === 'tax' ? 'col-span-2 justify-center border-amber-900/30 bg-amber-900/10' : ''}`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
             >
                 <div className={`w-2 h-2 rounded-full ${item.isGlowing ? 'animate-pulse' : ''}`} style={{ backgroundColor: item.color, boxShadow: item.isGlowing ? `0 0 8px ${item.color}` : 'none' }}></div>
                 <div className="flex flex-col">
                     <span className={`text-[10px] flex items-center gap-1 ${item.type === 'tax' ? 'text-amber-200 font-bold' : 'text-slate-400'}`}>
                         {item.icon}
                         {item.name}
                     </span>
                     <span className={`text-xs font-bold font-mono ${item.type === 'tax' ? 'text-amber-400' : 'text-slate-200'}`}>
                         {currency}{item.value.toLocaleString()}
                         {item.type === 'tax' && <span className="text-[9px] text-amber-500/80 mr-1 font-sans font-normal">(שנתי)</span>}
                     </span>
                 </div>
             </div>
         ))}
      </div>
    </div>
  );
};

export default FutureCake;