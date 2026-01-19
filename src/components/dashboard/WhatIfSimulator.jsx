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

  const handleExpenseSimulate = () => {
    const amount = parseFloat(expenseAmount) || 0;
    if (amount > 0) {
      onSimulate({ type: 'expense', amount, name: expenseName });
      setIsActive(true);
    }
  };

  const handleIncomeSimulate = () => {
    const amount = parseFloat(incomeAmount) || 0;
    if (amount > 0) {
      onSimulate({ type: 'income', amount, name: incomeName });
      setIsActive(true);
    }
  };

  const handleReset = () => {
    setExpenseAmount('');
    setExpenseName('');
    setIncomeAmount('');
    setIncomeName('');
    onSimulate({ type: 'reset' });
    setIsActive(false);
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
        className="flex items-center justify-between mb-0 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="text-cyan-400 text-sm font-medium flex items-center gap-2 uppercase tracking-wide">
          <Calculator size={16} />
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
          {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
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
          <Button
            onClick={handleExpenseSimulate}
            className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white"
          >
            חשב השפעת הוצאה
          </Button>
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
          <Button
            onClick={handleIncomeSimulate}
            className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white"
          >
            חשב השפעת הכנסה
          </Button>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}