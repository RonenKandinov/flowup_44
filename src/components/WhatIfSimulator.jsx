import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, ChevronDown, ChevronUp, RefreshCw, DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";

export default function WhatIfSimulator({ onSimulate, currentBalance }) {
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState('expense'); // expense | income
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [isSimulating, setIsSimulating] = useState(false);

    // Debounce simulation to avoid excessive calcs
    const handleSimulate = (val, type, desc) => {
        const numVal = parseFloat(val);
        if (!isNaN(numVal) && numVal > 0) {
            setIsSimulating(true);
            onSimulate({
                type: type,
                amount: numVal,
                name: desc || (type === 'expense' ? 'הוצאה חריגה' : 'הכנסה נוספת')
            });
        } else {
            setIsSimulating(false);
            onSimulate({ type: 'reset' });
        }
    };

    const handleAmountChange = (e) => {
        const val = e.target.value;
        setAmount(val);
        handleSimulate(val, mode, description);
    };

    const handleModeChange = (newMode) => {
        setMode(newMode);
        setAmount('');
        setDescription('');
        onSimulate({ type: 'reset' });
        setIsSimulating(false);
    };

    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-lg h-full flex flex-col">
            <div 
                className="p-4 border-b border-slate-800 flex justify-between items-center cursor-pointer hover:bg-slate-800/50 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                        <Calculator className="w-4 h-4 text-indigo-400" />
                    </div>
                    <span className="font-semibold text-slate-200">סימולטור What-If</span>
                </div>
                <div className="flex items-center gap-2">
                    {isSimulating && (
                        <span className="text-[10px] text-indigo-400 bg-indigo-950/30 px-2 py-0.5 rounded-full border border-indigo-900/30 animate-pulse">
                            פעיל
                        </span>
                    )}
                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-slate-900/30"
                    >
                        <div className="p-4 space-y-4">
                            <Tabs defaultValue="expense" value={mode} onValueChange={handleModeChange} className="w-full">
                                <TabsList className="w-full bg-slate-800 grid grid-cols-2">
                                    <TabsTrigger value="expense" className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400">
                                        <TrendingDown className="w-3 h-3 mr-1.5" />
                                        הוצאה
                                    </TabsTrigger>
                                    <TabsTrigger value="income" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
                                        <TrendingUp className="w-3 h-3 mr-1.5" />
                                        הכנסה
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>

                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-slate-500 mb-1.5 block">תיאור (אופציונלי)</label>
                                    <Input
                                        value={description}
                                        onChange={(e) => {
                                            setDescription(e.target.value);
                                            if (amount) handleSimulate(amount, mode, e.target.value);
                                        }}
                                        placeholder={mode === 'expense' ? "לדוגמה: טיפול לרכב" : "לדוגמה: בונוס"}
                                        className="bg-slate-950 border-slate-700 h-9 text-sm"
                                    />
                                </div>
                                
                                <div>
                                    <label className="text-xs text-slate-500 mb-1.5 block">סכום</label>
                                    <div className="relative">
                                        <DollarSign className="absolute right-3 top-2.5 w-4 h-4 text-slate-500" />
                                        <Input
                                            type="number"
                                            value={amount}
                                            onChange={handleAmountChange}
                                            placeholder="0"
                                            className="bg-slate-950 border-slate-700 pr-9 h-10 font-mono text-lg"
                                        />
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => {
                                            setAmount('');
                                            setDescription('');
                                            onSimulate({ type: 'reset' });
                                            setIsSimulating(false);
                                        }}
                                        className="w-full border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 h-8 text-xs"
                                        disabled={!isSimulating}
                                    >
                                        <RefreshCw className="w-3 h-3 mr-1.5" />
                                        אפס סימולציה
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="bg-indigo-900/10 border border-indigo-500/10 rounded-lg p-3">
                                <p className="text-xs text-indigo-300 leading-relaxed">
                                    הסימולטור מחשב מחדש את התחזית והסיכון באופן מיידי.
                                    <br/>
                                    <span className="opacity-70">הנתונים לא נשמרים בדאטהבייס.</span>
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Collapsed Preview */}
            {!isOpen && isSimulating && (
                <div className="px-4 pb-3 flex items-center justify-between text-sm">
                    <span className="text-slate-400 truncate max-w-[120px]">{description || (mode === 'expense' ? 'הוצאה' : 'הכנסה')}</span>
                    <span className={`font-mono font-bold ${mode === 'expense' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {mode === 'expense' ? '-' : '+'}₪{parseInt(amount).toLocaleString()}
                    </span>
                </div>
            )}
        </div>
    );
}