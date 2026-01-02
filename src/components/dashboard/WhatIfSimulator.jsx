import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, Calculator, DollarSign, TrendingDown, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function WhatIfSimulator({ onSimulate, currentBalance }) {
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseName, setExpenseName] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeName, setIncomeName] = useState('');
  const [monthlyChange, setMonthlyChange] = useState('');
  const [salaryDelay, setSalaryDelay] = useState('');
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

  const handleMonthlySimulate = () => {
    const amount = parseFloat(monthlyChange) || 0;
    if (amount !== 0) {
      onSimulate({ type: 'monthly', amount });
      setIsActive(true);
    }
  };

  const handleSalarySimulate = () => {
    const days = parseInt(salaryDelay) || 0;
    if (days > 0) {
      onSimulate({ type: 'salary_delay', days });
      setIsActive(true);
    }
  };

  const handleReset = () => {
    setExpenseAmount('');
    setExpenseName('');
    setIncomeAmount('');
    setIncomeName('');
    setMonthlyChange('');
    setSalaryDelay('');
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
        <TabsList className="grid w-full grid-cols-4 bg-slate-900/50">
          <TabsTrigger value="expense" className="text-xs">הוצאה</TabsTrigger>
          <TabsTrigger value="income" className="text-xs">הכנסה</TabsTrigger>
          <TabsTrigger value="monthly" className="text-xs">חודשי</TabsTrigger>
          <TabsTrigger value="salary" className="text-xs">משכורת</TabsTrigger>
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

        {/* Monthly Change Scenario */}
        <TabsContent value="monthly" className="space-y-3 mt-4">
          <p className="text-xs text-slate-400 mb-2">שינוי קבוע בהוצאות החודשיות</p>
          <div>
            <Label className="text-slate-400 text-xs mb-1.5 block">שינוי חודשי (חיובי = הוצאה, שלילי = חיסכון)</Label>
            <Input
              type="number"
              placeholder="₪0.00"
              value={monthlyChange}
              onChange={(e) => setMonthlyChange(e.target.value)}
              className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500"
              dir="ltr"
            />
          </div>
          <Button
            onClick={handleMonthlySimulate}
            className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white"
          >
            חשב השפעה חודשית
          </Button>
        </TabsContent>

        {/* Salary Delay Scenario */}
        <TabsContent value="salary" className="space-y-3 mt-4">
          <p className="text-xs text-slate-400 mb-2">דחיית מועד קבלת משכורת</p>
          <div>
            <Label className="text-slate-400 text-xs mb-1.5 block">עיכוב בימים</Label>
            <Input
              type="number"
              placeholder="0"
              value={salaryDelay}
              onChange={(e) => setSalaryDelay(e.target.value)}
              className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500"
              dir="ltr"
            />
          </div>
          <Button
            onClick={handleSalarySimulate}
            className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white"
          >
            חשב השפעת עיכוב
          </Button>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}