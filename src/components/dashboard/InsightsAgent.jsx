import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Sparkles, X, ChevronRight, AlertTriangle, TrendingUp, Shield, Copy, Phone, Tv, Wallet, Heart, GraduationCap, Coffee, Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Icon Mapper
const getIcon = (iconName) => {
    const icons = {
        'AlertTriangle': AlertTriangle,
        'TrendingUp': TrendingUp,
        'Shield': Shield,
        'Copy': Copy,
        'Phone': Phone,
        'Tv': Tv,
        'Wallet': Wallet,
        'Heart': Heart,
        'GraduationCap': GraduationCap,
        'Coffee': Coffee,
        'Dumbbell': Dumbbell
    };
    return icons[iconName] || Bot;
};

export default function InsightsAgent({ insights = [] }) {
    const [isOpen, setIsOpen] = useState(true);
    const [dismissedCount, setDismissedCount] = useState(0);

    const activeInsights = insights.slice(dismissedCount);

    if (activeInsights.length === 0) {
        return (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center h-full min-h-[200px]">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                </div>
                <h3 className="text-white font-medium">המצב נראה מצוין!</h3>
                <p className="text-slate-500 text-sm mt-1">אין תובנות חדשות כרגע. הסוכן ממשיך לעקוב.</p>
            </div>
        );
    }

    const currentInsight = activeInsights[0];
    const Icon = getIcon(currentInsight.icon);

    return (
        <div className="relative h-full">
            {/* Main Card */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-cyan-500/20 rounded-xl overflow-hidden shadow-lg shadow-cyan-900/5 h-full flex flex-col">
                {/* Header */}
                <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-900/50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <div className="absolute inset-0 bg-cyan-500 blur-sm opacity-20 animate-pulse rounded-full" />
                            <Bot className="w-5 h-5 text-cyan-400 relative z-10" />
                        </div>
                        <span className="text-sm font-semibold text-slate-200">FlowUp AI Agent</span>
                    </div>
                    <span className="text-xs font-mono text-cyan-500 bg-cyan-950/30 px-2 py-0.5 rounded-full border border-cyan-900/30">
                        {activeInsights.length} תובנות
                    </span>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col relative">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentInsight.title + dismissedCount}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex-1"
                        >
                            <div className="flex items-start gap-4 mb-4">
                                <div className={`p-3 rounded-xl shrink-0 ${
                                    currentInsight.type === 'tax_refund' ? 'bg-emerald-500/10 text-emerald-400' :
                                    currentInsight.type === 'money_leak' ? 'bg-amber-500/10 text-amber-400' :
                                    'bg-cyan-500/10 text-cyan-400'
                                }`}>
                                    <Icon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white leading-tight mb-1">
                                        {currentInsight.title}
                                    </h3>
                                    <p className="text-slate-400 text-sm leading-relaxed">
                                        {currentInsight.description}
                                    </p>
                                </div>
                            </div>

                            {/* Impact Stats */}
                            {(currentInsight.monthlySavings > 0 || currentInsight.annualImpact > 0) && (
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-800">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">פוטנציאל חיסכון</p>
                                        <p className="text-emerald-400 font-mono font-bold">
                                            ₪{Math.round(currentInsight.annualImpact || currentInsight.monthlySavings * 12).toLocaleString()}
                                            <span className="text-[10px] text-slate-600 font-sans mr-1">/שנה</span>
                                        </p>
                                    </div>
                                    <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-800">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">סוג תובנה</p>
                                        <p className="text-slate-300 text-sm font-medium">
                                            {currentInsight.type === 'tax_refund' ? 'החזר מס' :
                                             currentInsight.type === 'money_leak' ? 'דליפת כסף' : 'התראה'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Actions */}
                    <div className="mt-auto pt-4 flex gap-3">
                        <Button 
                            variant="outline" 
                            className="w-full border-slate-700 hover:bg-slate-800 text-slate-300"
                            onClick={() => setDismissedCount(prev => Math.min(prev + 1, insights.length))}
                        >
                            הבנתי, תודה
                        </Button>
                    </div>
                </div>

                {/* Progress Indicators */}
                <div className="px-5 pb-4 flex gap-1 justify-center">
                    {insights.map((_, idx) => (
                        <div 
                            key={idx}
                            className={`h-1 rounded-full transition-all duration-300 ${
                                idx === dismissedCount ? 'w-6 bg-cyan-500' : 
                                idx < dismissedCount ? 'w-2 bg-slate-700' : 'w-2 bg-slate-800'
                            }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

import { CheckCircle } from 'lucide-react';