import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

const COLORS = {
    fixed: '#F43F5E',    // Rose 500
    flex: '#3B82F6',     // Blue 500
    tax: '#10B981',      // Emerald 500
    empty: '#1E293B'     // Slate 800
};

export default function FutureCake({ fixedExpenses, flexExpenses, taxRefundPotential }) {
    const [isOpen, setIsOpen] = useState(true);
    const [activeIndex, setActiveIndex] = useState(null);

    const data = [
        { name: 'קבועות', value: fixedExpenses, color: COLORS.fixed, desc: 'שכ"ד, חשבונות, הלוואות' },
        { name: 'משתנות', value: flexExpenses, color: COLORS.flex, desc: 'מזון, בילויים, קניות' },
        { name: 'החזר מס', value: taxRefundPotential, color: COLORS.tax, desc: 'פוטנציאל החזר (לא וודאי)' }
    ].filter(d => d.value > 0);

    const total = fixedExpenses + flexExpenses; // Don't include potential tax refund in base total for percentage
    const grandTotal = total + taxRefundPotential;

    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        if (percent < 0.05) return null; // Don't label small slices

        return (
            <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-[10px] font-bold">
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const d = payload[0].payload;
            return (
                <div className="bg-slate-900 border border-slate-700 p-2 rounded-lg shadow-xl text-xs">
                    <p className="font-bold text-slate-200">{d.name}</p>
                    <p className="font-mono text-slate-300">₪{d.value.toLocaleString()}</p>
                    <p className="text-slate-500 mt-1">{d.desc}</p>
                </div>
            );
        }
        return null;
    };

    if (grandTotal === 0) {
        return (
            <div className="h-full bg-slate-900/30 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center text-center opacity-70">
                <div className="w-16 h-16 rounded-full border-4 border-slate-800 border-t-slate-700 animate-spin mb-3" />
                <p className="text-slate-500 text-sm">מנתח נתונים...</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-lg h-full flex flex-col w-full">
            <div 
                className="px-4 py-3 border-b border-slate-800 flex justify-between items-center cursor-pointer hover:bg-slate-800/50 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    <span className="font-semibold text-slate-200 text-sm">מבנה הוצאות צפוי</span>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="flex-1 flex flex-col"
                    >
                        <div className="relative h-[180px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={45}
                                        outerRadius={70}
                                        paddingAngle={4}
                                        dataKey="value"
                                        onMouseEnter={(_, index) => setActiveIndex(index)}
                                        onMouseLeave={() => setActiveIndex(null)}
                                        stroke="none"
                                    >
                                        {data.map((entry, index) => (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                fill={entry.color} 
                                                className="transition-all duration-300"
                                                fillOpacity={activeIndex === index ? 1 : (activeIndex === null ? 0.9 : 0.4)}
                                                stroke={activeIndex === index ? '#fff' : 'none'}
                                                strokeWidth={activeIndex === index ? 2 : 0}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            
                            {/* Center Text */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest block">סה"כ</span>
                                <span className="text-sm font-bold text-white font-mono">
                                    {(grandTotal / 1000).toFixed(1)}k
                                </span>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="px-6 pb-6 pt-2 space-y-2">
                            {data.map((item, idx) => (
                                <div 
                                    key={idx} 
                                    className={`flex items-center justify-between text-xs p-2 rounded-lg transition-colors ${activeIndex === idx ? 'bg-slate-800' : ''}`}
                                    onMouseEnter={() => setActiveIndex(idx)}
                                    onMouseLeave={() => setActiveIndex(null)}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-slate-300">{item.name}</span>
                                    </div>
                                    <span className="font-mono text-slate-400">₪{item.value.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}