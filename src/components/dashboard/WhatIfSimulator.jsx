import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, Calculator } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { estimatePrice } from '../utils/forecastingLogic';

export default function WhatIfSimulator({ onSimulate, currentBalance }) {
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseName, setExpenseName] = useState('');

  // Auto-update when description changes
  useEffect(() => {
    const estimatedPrice = estimatePrice(expenseName);
    if (estimatedPrice > 0) {
      setExpenseAmount(estimatedPrice.toString());
      onSimulate(estimatedPrice, expenseName);
    }
  }, [expenseName]);

  // Auto-update when amount changes
  useEffect(() => {
    const amount = parseFloat(expenseAmount) || 0;
    onSimulate(amount, expenseName);
  }, [expenseAmount]);

  const handleReset = () => {
    setExpenseAmount('');
    setExpenseName('');
    onSimulate(0, '');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="relative rounded-2xl p-4 md:p-5 border border-cyan-500/20 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-cyan-400 font-medium flex items-center gap-2">
          <Calculator size={18} />
          מה אם?
        </h3>
        <HelpCircle size={16} className="text-slate-500" />
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-slate-400 text-xs mb-1.5 block">תיאור ההוצאה (אופציונלי)</Label>
          <Input
            placeholder="לדוגמה: מחשב חדש"
            value={expenseName}
            onChange={(e) => setExpenseName(e.target.value)}
            className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500"
          />
        </div>

        <div>
          <Label className="text-slate-400 text-xs mb-1.5 block">סכום ההוצאה הצפויה</Label>
          <Input
            type="number"
            placeholder="₪0.00"
            value={expenseAmount}
            onChange={(e) => setExpenseAmount(e.target.value)}
            className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500 text-lg"
            dir="ltr"
          />
        </div>

        {(expenseAmount || expenseName) && (
          <Button
            onClick={handleReset}
            variant="outline"
            className="w-full border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            אפס
          </Button>
        )}
      </div>
    </motion.div>
  );
}