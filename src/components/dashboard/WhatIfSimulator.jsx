import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, CheckCircle, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function WhatIfSimulator({ onSimulate, currentBalance }) {
  const [expenseAmount, setExpenseAmount] = useState('');
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
    onSimulate(amount, '');
  };

  const handleReset = () => {
    setExpenseAmount('');
    setResult(null);
    onSimulate(0, '');
  };

  const quickAmounts = [500, 1000, 2500, 5000];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="relative rounded-3xl p-6 bg-white/80 backdrop-blur-xl shadow-lg border border-white/20"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
      }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-violet-50">
          <ShoppingBag className="w-5 h-5 text-violet-500" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-slate-900 font-semibold text-lg">סימולטור קניה</h3>
          <p className="text-xs text-slate-500">בדוק האם אתה יכול להרשות לעצמך</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Input
            type="number"
            placeholder="כמה אתה רוצה להוציא?"
            value={expenseAmount}
            onChange={(e) => setExpenseAmount(e.target.value)}
            className="h-14 text-xl font-semibold border-slate-200 focus:border-violet-400 focus:ring-violet-400 bg-white"
            style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            dir="ltr"
          />
        </div>

        {/* Quick amounts */}
        <div className="flex flex-wrap gap-2">
          {quickAmounts.map((amount) => (
            <button
              key={amount}
              onClick={() => setExpenseAmount(amount.toString())}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-700 hover:bg-violet-100 hover:text-violet-600 transition-all"
            >
              ₪{amount.toLocaleString('he-IL')}
            </button>
          ))}
        </div>

        <Button
          onClick={handleSimulate}
          disabled={!expenseAmount}
          className="w-full h-12 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/25"
        >
          בדוק עכשיו
        </Button>

        {/* Result Display */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`p-5 rounded-2xl ${
                result.canAfford 
                  ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200' 
                  : 'bg-gradient-to-br from-rose-50 to-red-50 border-2 border-rose-200'
              }`}
            >
              {result.canAfford ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-6 h-6 text-emerald-500" strokeWidth={2.5} />
                    <span className="text-emerald-700 font-bold text-lg">בטוח להוצאה</span>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">
                    יתרה בטוחה שתישאר:
                  </p>
                  <p className="text-3xl font-bold text-emerald-600">
                    ₪{Math.round(result.remainingBalance).toLocaleString('he-IL')}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-6 h-6 text-rose-500" strokeWidth={2.5} />
                    <span className="text-rose-700 font-bold text-lg">סכנת משיכת יתר</span>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">
                    גירעון צפוי:
                  </p>
                  <p className="text-3xl font-bold text-rose-600">
                    ₪{Math.round(Math.abs(result.remainingBalance)).toLocaleString('he-IL')}-
                  </p>
                </>
              )}
              <Button
                onClick={handleReset}
                variant="ghost"
                className="w-full mt-3 text-slate-600 hover:bg-slate-100"
              >
                נסה סכום אחר
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}