import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { debounce } from 'lodash';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function WhatIfSimulator({ onSimulate, baseMetrics }) {
  const [activeTab, setActiveTab] = useState('standard_loan');
  const [isOpen, setIsOpen] = useState(false); 
  const [isDesktop, setIsDesktop] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);

  // Inputs for scenarios
  const [loanAmount, setLoanAmount] = useState('');
  const [annualRate, setAnnualRate] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [incomeReduction, setIncomeReduction] = useState('');
  const [expenseIncrease, setExpenseIncrease] = useState('');

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

  const runSimulation = async (scenario, params) => {
    if (!baseMetrics) return;
    setIsSimulating(true);
    try {
        const res = await base44.functions.invoke('whatIfEngine', {
            baseMetrics,
            scenario,
            params
        });
        if (res.data?.success) {
            setSimulationResult(res.data);
            if (onSimulate) onSimulate({ 
                ...res.data.metrics, 
                status: res.data.status,
                score: res.data.score
            });
        } else {
            toast.error(res.data?.error || 'שגיאה בסימולציה');
        }
    } catch (e) {
        toast.error('שגיאת תקשורת עם מנוע הסימולציה');
    } finally {
        setIsSimulating(false);
    }
  };

  const debouncedSimulate = useMemo(() => debounce(runSimulation, 500), [baseMetrics]);

  useEffect(() => {
      if (!baseMetrics) return;
      const amount = Number(loanAmount);
      const rate = Number(annualRate);
      const term = Number(termMonths);
      const incRed = Number(incomeReduction);
      const expInc = Number(expenseIncrease);

      if (activeTab === 'stress_test') {
          if (incRed > 0 || expInc > 0) {
              debouncedSimulate('stress_test', { incomeReduction: incRed, expenseIncrease: expInc });
          } else {
              setSimulationResult(null);
              if (onSimulate) onSimulate(null);
          }
      } else if (amount > 0 && rate > 0) {
          if (activeTab === 'balloon_loan') {
              debouncedSimulate('balloon_loan', { loanAmount: amount, annualRate: rate, termMonths: term });
          } else if (term > 0) {
              debouncedSimulate(activeTab, { loanAmount: amount, annualRate: rate, termMonths: term });
          } else {
              setSimulationResult(null);
              if (onSimulate) onSimulate(null);
          }
      } else {
          setSimulationResult(null);
          if (onSimulate) onSimulate(null);
      }
  }, [activeTab, loanAmount, annualRate, termMonths, incomeReduction, expenseIncrease, baseMetrics]);

  const handleReset = () => {
    setLoanAmount('');
    setAnnualRate('');
    setTermMonths('');
    setIncomeReduction('');
    setExpenseIncrease('');
    setSimulationResult(null);
    if (onSimulate) onSimulate(null);
  };

  const estimatedPayment = useMemo(() => {
    const amount = Number(loanAmount);
    const rate = Number(annualRate);
    const term = Number(termMonths);

    if (!amount || !rate || !term) return 0;

    if (activeTab === 'balloon_loan') {
      return (amount * (rate / 100)) / 12;
    } else {
      const i = (rate / 100) / 12;
      if (i === 0) return amount / term;
      return amount * ((i * Math.pow(1 + i, term)) / (Math.pow(1 + i, term) - 1));
    }
  }, [loanAmount, annualRate, termMonths, activeTab]);

  const isActive = simulationResult !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-xl p-5 border bg-slate-800/30 backdrop-blur-sm transition-all h-full flex flex-col ${
        isActive ? 'border-indigo-500/40 shadow-sm shadow-indigo-500/10' : 'border-slate-700/30'
      }`}
    >
      <div 
        className={`flex items-center justify-between mb-0 ${!isDesktop ? 'cursor-pointer' : ''}`}
        onClick={() => !isDesktop && setIsOpen(!isOpen)}
      >
        <h3 className="text-white text-sm font-medium flex items-center gap-2 uppercase tracking-wide">
          <Calculator size={16} className="text-indigo-400" />
          סימולטור הלוואות (What If)
        </h3>
        <div className="flex items-center gap-2">
          {isActive && (
            <Button
              onClick={(e) => { e.stopPropagation(); handleReset(); }}
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
            className="overflow-hidden flex-1 flex flex-col"
          >
            <div className="pt-4 flex-1 flex flex-col">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-slate-900/50 h-auto">
                  <TabsTrigger value="standard_loan" className="text-[10px] py-2 whitespace-normal leading-tight">רגיל</TabsTrigger>
                  <TabsTrigger value="extended_loan" className="text-[10px] py-2 whitespace-normal leading-tight">פריסה ארוכה</TabsTrigger>
                  <TabsTrigger value="balloon_loan" className="text-[10px] py-2 whitespace-normal leading-tight">בלון</TabsTrigger>
                  <TabsTrigger value="stress_test" className="text-[10px] py-2 whitespace-normal leading-tight text-red-400">מבחן לחץ</TabsTrigger>
                </TabsList>

                {/* Standard Loan */}
                <TabsContent value="standard_loan" className="space-y-3 mt-4">
                  <div className="text-[11px] text-slate-400 mb-2 border-r-2 border-indigo-500 pr-2">
                      מוצר בסיסי (שפיצר) ל-24 עד 60 חודשים. מטרתו: עלות ריבית כוללת נמוכה.
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs mb-1.5 block">סכום ההלוואה (₪)</Label>
                    <Input type="number" placeholder="₪0.00" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} className="bg-slate-900/50 border-slate-700 text-white focus:border-indigo-500 h-9" dir="ltr" />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs mb-1.5 block">ריבית שנתית (%)</Label>
                    <Input type="number" placeholder="%" value={annualRate} onChange={(e) => setAnnualRate(e.target.value)} className="bg-slate-900/50 border-slate-700 text-white focus:border-indigo-500 h-9" dir="ltr" />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs mb-1.5 block">תקופה בחודשים (24-60)</Label>
                    <Input type="number" placeholder="חודשים" value={termMonths} onChange={(e) => setTermMonths(e.target.value)} className="bg-slate-900/50 border-slate-700 text-white focus:border-indigo-500 h-9" dir="ltr" />
                  </div>
                </TabsContent>

                {/* Extended Loan */}
                <TabsContent value="extended_loan" className="space-y-3 mt-4">
                  <div className="text-[11px] text-slate-400 mb-2 border-r-2 border-indigo-500 pr-2">
                      פריסה ארוכה (שפיצר) ל-60 עד 84 חודשים. מטרתו: הקטנת הנטל החודשי.
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs mb-1.5 block">סכום ההלוואה (₪)</Label>
                    <Input type="number" placeholder="₪0.00" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} className="bg-slate-900/50 border-slate-700 text-white focus:border-indigo-500 h-9" dir="ltr" />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs mb-1.5 block">ריבית שנתית (%)</Label>
                    <Input type="number" placeholder="%" value={annualRate} onChange={(e) => setAnnualRate(e.target.value)} className="bg-slate-900/50 border-slate-700 text-white focus:border-indigo-500 h-9" dir="ltr" />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs mb-1.5 block">תקופה בחודשים (60-84)</Label>
                    <Input type="number" placeholder="חודשים" value={termMonths} onChange={(e) => setTermMonths(e.target.value)} className="bg-slate-900/50 border-slate-700 text-white focus:border-indigo-500 h-9" dir="ltr" />
                  </div>
                </TabsContent>

                {/* Balloon Loan */}
                <TabsContent value="balloon_loan" className="space-y-3 mt-4">
                  <div className="text-[11px] text-slate-400 mb-2 border-r-2 border-indigo-500 pr-2">
                      מסלול ריבית בלבד (12-36 חודשים). מטרתו: גמישות תזרימית מקסימלית למי שיש הון נזיל.
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs mb-1.5 block">סכום ההלוואה (₪)</Label>
                    <Input type="number" placeholder="₪0.00" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} className="bg-slate-900/50 border-slate-700 text-white focus:border-indigo-500 h-9" dir="ltr" />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs mb-1.5 block">ריבית שנתית (%)</Label>
                    <Input type="number" placeholder="%" value={annualRate} onChange={(e) => setAnnualRate(e.target.value)} className="bg-slate-900/50 border-slate-700 text-white focus:border-indigo-500 h-9" dir="ltr" />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs mb-1.5 block">תקופה בחודשים (12-36)</Label>
                    <Input type="number" placeholder="חודשים" value={termMonths} onChange={(e) => setTermMonths(e.target.value)} className="bg-slate-900/50 border-slate-700 text-white focus:border-indigo-500 h-9" dir="ltr" />
                  </div>
                </TabsContent>

                {/* Stress Test */}
                <TabsContent value="stress_test" className="space-y-3 mt-4">
                  <div className="text-[11px] text-slate-400 mb-2 border-r-2 border-red-500 pr-2">
                      בדיקת עמידות הלקוח בתרחישי קיצון של ירידה בהכנסות או עלייה בהוצאות.
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs mb-1.5 block">ירידה בהכנסות (%)</Label>
                    <Input type="number" placeholder="%" value={incomeReduction} onChange={(e) => setIncomeReduction(e.target.value)} className="bg-slate-900/50 border-slate-700 text-white focus:border-red-500 h-9" dir="ltr" />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs mb-1.5 block">עלייה בהוצאות (%)</Label>
                    <Input type="number" placeholder="%" value={expenseIncrease} onChange={(e) => setExpenseIncrease(e.target.value)} className="bg-slate-900/50 border-slate-700 text-white focus:border-red-500 h-9" dir="ltr" />
                  </div>
                </TabsContent>
              </Tabs>

              {estimatedPayment > 0 && (
                  <div className="mt-4 p-4 bg-slate-900/60 rounded-xl border border-indigo-500/20 flex flex-col items-center justify-center">
                      <span className="text-xs text-slate-400 mb-1">החזר חודשי משוער</span>
                      <span className="text-2xl font-bold text-white">₪{Math.round(estimatedPayment).toLocaleString('he-IL')}</span>
                  </div>
              )}

              {/* Status Message */}
              {isSimulating && (
                  <div className="mt-4 flex items-center justify-center p-3 bg-slate-900/30 rounded-lg">
                      <div className="animate-spin h-4 w-4 border-2 border-indigo-500 rounded-full border-t-transparent"></div>
                      <span className="mr-2 text-xs text-slate-400">מריץ סימולציית מנוע...</span>
                  </div>
              )}
              
              {!isSimulating && simulationResult && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mt-4 p-3 rounded-lg border ${
                        simulationResult.status === 'RED' ? 'bg-red-500/10 border-red-500/30' : 
                        simulationResult.status === 'GREEN' ? 'bg-green-500/10 border-green-500/30' : 
                        'bg-yellow-500/10 border-yellow-500/30'
                    }`}
                  >
                      <div className="flex items-start gap-2">
                          {simulationResult.status === 'RED' ? (
                              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          ) : simulationResult.status === 'ORANGE' ? (
                              <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                          ) : (
                              <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                          )}
                          <p className={`text-xs leading-relaxed ${
                                simulationResult.status === 'RED' ? 'text-red-200' : 
                                simulationResult.status === 'GREEN' ? 'text-green-200' : 
                                'text-yellow-200'
                          }`}>
                              {simulationResult.message}
                          </p>
                      </div>
                  </motion.div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}