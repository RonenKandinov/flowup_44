import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Anchor, Zap, Sparkles, ChevronDown, ChevronUp, PieChart as PieChartIcon } from 'lucide-react';

const FutureCake = ({ fixedExpenses = 0, flexExpenses = 0, taxRefundPotential = 0, currency = '₪' }) => {
  const [activeIndex, setActiveIndex] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkScreen = () => {
      const desktop = window.innerWidth >= 768;
      setIsDesktop(desktop);
      if (desktop) setIsOpen(true);
    };
    
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  // 1. Preview Mode Logic (Empty State)
  const isPreviewMode = fixedExpenses === 0 && flexExpenses === 0;

  const flexPercentage = !isPreviewMode && (fixedExpenses + flexExpenses > 0) 
      ? Math.round((flexExpenses / (fixedExpenses + flexExpenses)) * 100) 
      : 40;

  const chartData = isPreviewMode 
    ? [
        { name: 'הוצאות קשיחות', value: 6000, color: '#FF007F', icon: <Anchor className="w-5 h-5" />, type: 'fixed' },
        { name: 'הוצאות משתנות', value: 4000, color: '#14b8a6', icon: <Zap className="w-5 h-5" />, type: 'flex' }
      ]
    : [
        { name: 'הוצאות קשיחות', value: fixedExpenses, color: '#FF007F', icon: <Anchor className="w-5 h-5" />, type: 'fixed' },
        { name: 'הוצאות משתנות', value: flexExpenses, color: '#14b8a6', icon: <Zap className="w-5 h-5" />, type: 'flex' },
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
          <p className={item.type === 'tax' ? "text-amber-400 font-mono" : "text-teal-400 font-mono"}>
             {currency}{item.value.toLocaleString()} 
             {item.type !== 'tax' && ` (${Math.round((item.value / totalExpenses) * 100)}%)`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full bg-slate-800/40 rounded-xl border border-slate-700/40 overflow-hidden" dir="rtl">
      {/* Header */}
      <div 
        className={`px-5 py-4 border-b border-slate-700/40 transition-colors flex items-center justify-between ${!isDesktop ? 'cursor-pointer hover:bg-slate-800/50' : ''}`}
        onClick={() => !isDesktop && setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2.5">
            <PieChartIcon className="w-5 h-5 text-purple-400" />
            <div className="flex flex-col items-start">
                <h3 className="text-white text-sm font-medium uppercase tracking-wide leading-none">Future Cake</h3>
                <span className="text-xs text-slate-400 mt-0.5">תחזית הוצאות לחודש הבא</span>
            </div>
            {isPreviewMode && <span className="text-[9px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full mr-2">Preview</span>}
        </div>
        {!isDesktop && (isOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />)}
      </div>

      <AnimatePresence>
        {(isOpen || isDesktop) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 flex flex-col items-center justify-center min-h-[300px] relative">
              <div className="w-full h-[220px] relative">
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
                                        <span className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{activeItem.name}</span>
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
                                <>
                                    <span className="text-slate-500 text-[10px] uppercase">צפי הוצאה בחודש הבא</span>
                                    <span className="text-xl font-bold text-slate-200 font-mono">{currency}{totalExpenses.toLocaleString()}</span>
                                </>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
              </div>

              {/* Legend / Key */}
              <div className="grid grid-cols-2 gap-4 w-full mt-6 px-2">
                 {chartData.map((item, i) => (
                     <div 
                        key={i} 
                        className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${activeIndex === i ? 'bg-slate-800 border-slate-700 shadow-lg scale-[1.02]' : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50'} ${item.type === 'tax' ? 'col-span-2 justify-center border-amber-900/30 bg-amber-900/10' : ''}`}
                        onMouseEnter={() => setActiveIndex(i)}
                        onMouseLeave={() => setActiveIndex(null)}
                     >
                         <div 
                           className={`p-2 rounded-lg flex items-center justify-center ${item.type === 'tax' ? 'bg-amber-500/10' : 'bg-slate-900/50'}`}
                           style={{ color: item.color, boxShadow: item.isGlowing ? `0 0 15px ${item.color}40` : `0 0 10px ${item.color}10` }}
                         >
                           {item.icon}
                         </div>

                         <div className="flex flex-col">
                             <span className={`text-[11px] font-medium tracking-wide ${item.type === 'tax' ? 'text-amber-200' : 'text-slate-400'}`}>
                                 {item.name}
                             </span>
                             <span className={`text-sm font-bold font-mono leading-none mt-1 ${item.type === 'tax' ? 'text-amber-400' : 'text-white'}`}>
                                 {currency}{item.value.toLocaleString()}
                                 {item.type === 'tax' && <span className="text-[9px] text-amber-500/80 mr-1 font-sans font-normal">(שנתי)</span>}
                             </span>
                         </div>
                     </div>
                 ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FutureCake;