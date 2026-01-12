import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, Calculator, DollarSign, TrendingDown, Calendar } from 'lucide-react';
import { Input, Button, Label, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';

export default function WhatIfSimulator({ onSimulate, currentBalance }) {
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseName, setExpenseName] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeName, setIncomeName] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [activeTab, setActiveTab] = useState('expense');

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
      className={`relative rounded-2xl p-4 md:p-5 border bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm transition-all ${
        isActive ? 'border-yellow-500/50 shadow-lg shadow-yellow-500/20' : 'border-cyan-500/20'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-cyan-400 font-medium flex items-center gap-2">
          <Calculator size={18} />
          סימולטור מה אם?
        </h3>
        {isActive && (
          <Button
            onClick={handleReset}
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-white text-xs"
          >
            אפס הכל
          </Button>
        )}
      </div>

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