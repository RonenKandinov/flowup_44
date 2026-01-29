import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Sparkles, X, ChevronRight, ChevronDown, ChevronUp, AlertTriangle, TrendingUp, Shield, Copy, Phone, Tv, Wallet, Heart, GraduationCap, Coffee, Dumbbell, RefreshCw } from 'lucide-react';
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
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) setIsOpen(false); // Default closed on mobile
            else setIsOpen(true);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // If no real insights, use educational tips
    const hasRealInsights = insights.length > 0;
    const educationalTips = [
        {
            type: 'info',
            title: 'טיפ לחיסכון: כלל ה-50/30/20',
            description: 'נסה לחלק את ההכנסה: 50% להוצאות קבועות, 30% לרצונות אישיים, ו-20% לחיסכון והשקעה.',
            icon: 'Wallet',
            monthlySavings: 0,
            annualImpact: 0
        },
        {
            type: 'info',
            title: 'טיפ להשקעה: ריבית דריבית',
            description: 'התחלה מוקדמת של חיסכון, אפילו בסכומים קטנים, מאפשרת לאפקט הריבית דריבית להגדיל את ההון משמעותית לאורך זמן.',
            icon: 'TrendingUp',
            monthlySavings: 0,
            annualImpact: 0
        },
        {
            type: 'info',
            title: 'בדיקת ביטוחים שנתית',
            description: 'מומלץ לבדוק פעם בשנה את תיק הביטוחים ב"הר הביטוח" כדי למנוע כפל ביטוחים ותשלומים מיותרים.',
            icon: 'Shield',
            monthlySavings: 0,
            annualImpact: 0
        }
    ];

    // Use tips if no insights, otherwise use insights
    const displayInsights = hasRealInsights ? insights : educationalTips;
    const activeInsights = displayInsights.slice(dismissedCount);

    if (activeInsights.length === 0) {
        return (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center h-full min-h-[200px]">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                </div>
                <h3 className="text-white font-medium">עברנו על הכל!</h3>
                <p className="text-slate-500 text-sm mt-1 mb-4">הסוכן ממשיך לעקוב ויעדכן כשיהיה משהו חדש.</p>
                
                <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30"
                    onClick={() => setDismissedCount(0)}
                >
                    <RefreshCw className="w-4 h-4 ml-2" />
                    צפה בתובנות שוב
                </Button>
            </div>
        );
    }

    const currentInsight = activeInsights[0];
    const Icon = getIcon(currentInsight.icon);

    return (
        <div className="relative h-full">
            {/* Main Card */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-cyan-500/20 rounded-xl overflow-hidden shadow-lg shadow-cyan-900/5 h-full flex flex-col">
                {/* Header - Clickable on Mobile */}
                <div 
                    className={`px-4 py-3 border-b border-slate-800/60 bg-slate-900/50 flex justify-between items-center ${isMobile ? 'cursor-pointer hover:bg-slate-800' : ''}`}
                    onClick={() => isMobile && setIsOpen(!isOpen)}
                >
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <div className="absolute inset-0 bg-cyan-500 blur-sm opacity-20 animate-pulse rounded-full" />
                            <Bot className="w-5 h-5 text-cyan-400 relative z-10" />
                        </div>
                        <span className="text-sm font-semibold text-slate-200">FlowUp AI Agent</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-cyan-500 bg-cyan-950/30 px-2 py-0.5 rounded-full border border-cyan-900/30">
                            {activeInsights.length} {hasRealInsights ? 'תובנות' : 'טיפים'}
                        </span>
                        {isMobile && (
                            isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                    </div>
                </div>

                {/* Content */}
                <AnimatePresence>
                    {isOpen && (
                        <motion.div 
                            initial={isMobile ? { height: 0, opacity: 0 } : false}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={isMobile ? { height: 0, opacity: 0 } : false}
                            className="overflow-hidden flex-1 flex flex-col"
                        >
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
                                                currentInsight.type === 'lifestyle' ? 'bg-pink-500/10 text-pink-400' :
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
                                                        currentInsight.type === 'money_leak' ? 'דליפת כסף' : 
                                                        currentInsight.type === 'lifestyle' ? 'סגנון חיים' : 'התראה'}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                </AnimatePresence>

                                {/* Actions */}
                                <div className="mt-auto pt-4 flex gap-3">
                                    <Button 
                                        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/50 shadow-sm"
                                        onClick={() => setDismissedCount(prev => prev + 1)}
                                    >
                                        הבנתי, תודה
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Progress Indicators (Only show if open) */}
                {isOpen && (
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
                )}
            </div>
        </div>
    );
}

import { CheckCircle } from 'lucide-react';