import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Calculator, DollarSign, TrendingDown, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  React.useEffect(() => {
    const checkScreen = () => {
      const desktop = window.innerWidth >= 768;
      setIsDesktop(desktop);
      // Open by default on mobile AND desktop as requested
      if (desktop || window.innerWidth < 768) {
        setIsOpen(true);
      }
    };
    
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  // Reactive Simulation Logic (Debounced)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const isExpense = activeTab === 'expense';
      const amount = parseFloat(isExpense ? expenseAmount : incomeAmount);
      const name = isExpense ? expenseName : incomeName;

      if (amount && amount > 0) {
        onSimulate({ 
          type: isExpense ? 'expense' : 'income', 
          amount, 
          name 
        });
        setIsActive(true);
      } else {
        // If cleared, reset
        if (isActive) {
           onSimulate({ type: 'reset' });
           setIsActive(false);
        }
      }
    }, 150); // Fast debounce for smooth feel

    return () => clearTimeout(timer);
  }, [expenseAmount, expenseName, incomeAmount, incomeName, activeTab]);

  const handleReset = () => {
    setExpenseAmount('');
    setExpenseName('');
    setIncomeAmount('');
    setIncomeName('');
    // Effect will handle the reset call
  };

  const quickAmounts = [500, 1000, 2500, 5000];

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
          </div>
          {/* Auto-calculating... */}
          <div className="text-[10px] text-slate-500 text-center pt-1 flex items-center justify-center gap-1">
             <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/50 animate-pulse" />
             מתעדכן אוטומטית בזמן אמת
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
          </div>
          {/* Auto-calculating... */}
          <div className="text-[10px] text-slate-500 text-center pt-1 flex items-center justify-center gap-1">
             <div className="w-1.5 h-1.5 rounded-full bg-green-500/50 animate-pulse" />
             מתעדכן אוטומטית בזמן אמת
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