import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, Calculator, CheckCircle, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function WhatIfSimulator({ onSimulate, currentBalance }) {
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseName, setExpenseName] = useState('');
  const [result, setResult] = useState(null);

  const handleSimulate = () => {
    const amount = parseFloat(expenseAmount) || 0;
    if (amount > 0 && currentBalance) {
      // Apply 17% risk buffer to current balance
      const safeBalance = currentBalance * 0.83;
      const remainingBalance = safeBalance - amount;
      setResult({
        canAfford: remainingBalance > 0,
        remainingBalance
      });
    }
    onSimulate(amount, expenseName);
  };

  const handleReset = () => {
    setExpenseAmount('');
    setExpenseName('');
    setResult(null);
    onSimulate(0, '');
  };

  const quickAmounts = [500, 1000, 2500, 5000];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="relative rounded-xl p-5 md:p-6 bg-white/5 backdrop-blur-xl border border-white/10"
      style={{
        boxShadow: '0 8px 40px 0 rgba(0, 0, 0, 0.4)'
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-2">
          <Calculator size={14} />
          מה אם?
        </h3>
        <HelpCircle size={14} className="text-slate-600" />
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-[9px] uppercase tracking-widest text-slate-500 mb-2 block">תיאור ההוצאה (אופציונלי)</Label>
          <Input
            placeholder="לדוגמה: מחשב חדש"
            value={expenseName}
            onChange={(e) => setExpenseName(e.target.value)}
            className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
          />
        </div>

        <div>
          <Label className="text-[9px] uppercase tracking-widest text-slate-500 mb-2 block">סכום ההוצאה הצפויה</Label>
          <Input
            type="number"
            placeholder="₪0.00"
            value={expenseAmount}
            onChange={(e) => setExpenseAmount(e.target.value)}
            className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all text-base font-light tracking-tight"
            dir="ltr"
          />
        </div>

        {/* Quick amounts */}
        <div className="flex flex-wrap gap-2">
          {quickAmounts.map((amount) => (
            <button
              key={amount}
              onClick={() => setExpenseAmount(amount.toString())}
              className="px-3 py-1.5 rounded-lg text-[9px] font-light tracking-tight bg-white/5 border border-white/10 text-slate-300 hover:bg-cyan-500/10 hover:border-cyan-500/30 hover:text-cyan-400 transition-all duration-200"
            >
              ₪{amount.toLocaleString('he-IL')}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSimulate}
            className="flex-1 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-medium shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all"
          >
            חשב
          </Button>
          {expenseAmount && (
            <Button
              onClick={handleReset}
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              אפס
            </Button>
          )}
        </div>

        {/* Result Display */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-3 rounded-lg border ${
              result.canAfford 
                ? 'bg-green-500/10 border-green-500/30' 
                : 'bg-red-500/10 border-red-500/30'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {result.canAfford ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-green-400 font-medium">מאושר</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <span className="text-red-400 font-medium">התראת סיכון</span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-400">
              יתרה בטוחה לאחר הוצאה: {' '}
              <span className={result.canAfford ? 'text-green-400' : 'text-red-400'}>
                ₪{Math.round(result.remainingBalance).toLocaleString('he-IL')}
              </span>
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}