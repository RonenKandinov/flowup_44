import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, ChevronDown, Info, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export default function LiquidAssetsCard({ cash, etf, trainingFund }) {
    const [isOpen, setIsOpen] = useState(false);

    // Weighted Formula
    const weightedTotal = (cash * 1.0) + (etf * 0.75) + (trainingFund * 0.55);

    const formatCurrency = (amount) => 
        new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount);

    const AssetRow = ({ label, amount, factor, description, liquidity }) => (
        <div className="flex items-center justify-between p-2 hover:bg-slate-800/50 rounded-lg transition-colors border-b border-slate-800/50 last:border-0">
            <div className="flex flex-col">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-200 font-medium">{label}</span>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <Info className="w-3 h-3 text-slate-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="text-xs">מבוסס על היסטוריית 12 חודשים אחרונים</p>
                                <h1 style="color:red">VERSION TEST</h1>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <span className="text-[10px] text-slate-400">{description}</span>
            </div>
            <div className="text-right">
                <div className="text-sm font-bold text-slate-100">{formatCurrency(amount)}</div>
                <div className={cn(
                    "text-[10px] flex items-center justify-end gap-1",
                    liquidity === 'high' ? "text-emerald-400" : "text-amber-400"
                )}>
                    {liquidity === 'high' ? <ShieldCheck className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    <span>{liquidity === 'high' ? 'נזילות גבוהה' : 'נזילות בינונית'}</span>
                    <span className="text-slate-600 mx-1">|</span>
                    <span className="text-slate-500">פקטור: {factor}%</span>
                </div>
            </div>
        </div>
    );

    return (
        <motion.div 
            layout
            onClick={() => setIsOpen(!isOpen)}
            className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl overflow-hidden cursor-pointer hover:border-slate-700 transition-all group h-full flex flex-col"
        >
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group-hover:border-blue-500/40 transition-colors">
                        <Wallet className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">נכסים נזילים</h3>
                        <div className="text-2xl font-bold text-white mt-0.5 font-mono">
                            {formatCurrency(weightedTotal)}
                        </div>
                    </div>
                </div>
                <ChevronDown className={cn("w-5 h-5 text-slate-500 transition-transform duration-300", isOpen && "rotate-180")} />
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-slate-950/30 border-t border-slate-800"
                    >
                        <div className="p-3 space-y-1">
                            <AssetRow 
                                label="עו״ש (Cash)" 
                                amount={cash} 
                                factor={100}
                                description="יתרה זמינה למשיכה מיידית"
                                liquidity="high"
                            />
                            <AssetRow 
                                label="השקעות סחירות" 
                                amount={etf} 
                                factor={75}
                                description="קרנות סל, מניות, אג״ח"
                                liquidity="medium"
                            />
                            <AssetRow 
                                label="קופות נזילות" 
                                amount={trainingFund} 
                                factor={55}
                                description="קרנות השתלמות נזילות / גמל להשקעה"
                                liquidity="medium"
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}