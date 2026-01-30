import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Calculator, DollarSign, TrendingDown, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { debounce } from 'lodash';

export default function WhatIfSimulator({ onSimulate, currentBalance }) {
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseName, setExpenseName] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeName, setIncomeName] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [activeTab, setActiveTab] = useState('expense');
  const [isOpen, setIsOpen] = useState(false); 
  const [isDesktop, setIsDesktop] = useState(false);

  // Initial State Logic
  useEffect(() => {
    const checkScreen = () => {
      const desktop = window.innerWidth >= 768;
      setIsDesktop(desktop);
      if (desktop || window.innerWidth < 768) {
        setIsOpen(true);
      }
    };
    
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  // Haptic Feedback Helper
  const handleSliderChange = (vals, type) => {
    const val = vals[0];
    if (type === 'expense') setExpenseAmount(val.toString());
    else setIncomeAmount(val.toString());

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        const projected = type === 'expense' 
            ? (currentBalance || 0) - val 
            : (currentBalance || 0) + val;

        if (projected < 0) {
            navigator.vibrate([50, 30, 50]); // Red Zone Warning
        } else {
            navigator.vibrate(5); // Tactile Click
        }
    }
  };

  // Stable debounce logic
  const onSimulateRef = useRef(onSimulate);
  useEffect(() => { onSimulateRef.current = onSimulate; }, [onSimulate]);

  const debouncedSimulate = useMemo(
    () => debounce((data) => {
        onSimulateRef.current(data);
    }, 100), // Fast debounce for responsiveness
    []
  );

  // Real-time update effect
  useEffect(() => {
    const isExpense = activeTab === 'expense';
    const amount = parseFloat(isExpense ? expenseAmount : incomeAmount);
    const name = isExpense ? expenseName : incomeName;

    if (!isNaN(amount) && amount > 0) {
        debouncedSimulate({ type: activeTab, amount, name });
        setIsActive(true);
    } else {
        // Only reset if we were active to avoid initial reset loop
        if (isActive || amount === 0) {
            debouncedSimulate({ type: 'reset' });
            setIsActive(false);
        }
    }
  }, [expenseAmount, expenseName, incomeAmount, incomeName, activeTab]);

  // Cleanup
  useEffect(() => {
    return () => debouncedSimulate.cancel();
  }, [debouncedSimulate]);

  const handleReset = () => {
    setExpenseAmount('');
    setExpenseName('');
    setIncomeAmount('');
    setIncomeName('');
    // onSimulate will be triggered by the effect when amounts clear
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className={`relative rounded-xl p-5 border bg-slate-800/30 backdrop-blur-sm transition-all ${
        isActive ? 'border-yellow-500/40 shadow-sm shadow-yellow-500/10' : 'border-slate-700/30'
      }`}
    >
      {/* Collapsible Header */}
      <div 
        className={`flex items-center justify-between mb-0 ${!isDesktop ? 'cursor-pointer' : ''}`}
        onClick={() => !isDesktop && setIsOpen(!isOpen)}
      >
        <h3 className="text-white text-sm font-medium flex items-center gap-2 uppercase tracking-wide">
          <Calculator size={16} className="text-cyan-400" />
          סימולטור מה אם?
        </h3>
        <div className="flex items-center gap-2">
          {isActive && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleReset();
              }}
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white text-xs h-6 px-2"
            >
              אפס
            </Button>
          )}
          {!isDesktop && (isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />)}
        </div>
      </div>

      <AnimatePresence>
        {(isOpen || isDesktop) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-900/50">
          <TabsTrigger value="expense" className="text-xs">הוצאה</TabsTrigger>
          <TabsTrigger value="income" className="text-xs">הכנסה</TabsTrigger>
        </TabsList>

        {/* Expense Scenario */}
        <TabsContent value="expense" className="space-y-3 mt-4">
          <div>
            <Label className="text-slate-400 text-xs mb-1.5 block">תיאור ההוצאה</Label>
            <Input
              placeholder="לדוגמה: מחשב חדש"
              value={expenseName}
              onChange={(e) => setExpenseName(e.target.value)}
              className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500"
            />
          </div>
          <div>
            <Label className="text-slate-400 text-xs mb-1.5 block">סכום ההוצאה</Label>
            <Input
              type="number"
              placeholder="₪0.00"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500"
              dir="ltr"
            />
            <div className="flex items-center gap-2 mt-3 justify-end opacity-80">
                <span className="text-[10px] text-cyan-400">מתעדכן בזמן אמת</span>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500"></span>
                </span>
            </div>
          </div>
        </TabsContent>

        {/* Income Scenario */}
        <TabsContent value="income" className="space-y-3 mt-4">
          <div>
            <Label className="text-slate-400 text-xs mb-1.5 block">תיאור ההכנסה</Label>
            <Input
              placeholder="לדוגמה: בונוס שנתי"
              value={incomeName}
              onChange={(e) => setIncomeName(e.target.value)}
              className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500"
            />
          </div>
          <div>
            <Label className="text-slate-400 text-xs mb-1.5 block">סכום ההכנסה</Label>
            <Input
              type="number"
              placeholder="₪0.00"
              value={incomeAmount}
              onChange={(e) => setIncomeAmount(e.target.value)}
              className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500"
              dir="ltr"
            />
             <div className="flex items-center gap-2 mt-3 justify-end opacity-80">
                <span className="text-[10px] text-cyan-400">מתעדכן בזמן אמת</span>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500"></span>
                </span>
            </div>
          </div>
        </TabsContent>
      </Tabs>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}