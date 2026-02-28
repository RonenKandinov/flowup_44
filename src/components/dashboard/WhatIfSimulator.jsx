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

  // Standard Loan
  const [loanPayment, setLoanPayment] = useState('');

  // Lifestyle Pivot
  const [pivotPayment, setPivotPayment] = useState('');
  const [reductionPercentage, setReductionPercentage] = useState([20]);

  // Closing Tool
  const [balloonPayment, setBalloonPayment] = useState('');
  const [futureSavings, setFutureSavings] = useState('');

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
            if (onSimulate) onSimulate(res.data.metrics);
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
      if (activeTab === 'standard_loan') {
          if (loanPayment && !isNaN(loanPayment)) {
              debouncedSimulate('standard_loan', { loanPayment: Number(loanPayment) });
          } else {
              setSimulationResult(null);
              if (onSimulate) onSimulate(null);
          }
      } else if (activeTab === 'lifestyle_pivot') {
          if (pivotPayment && !isNaN(pivotPayment)) {
              debouncedSimulate('lifestyle_pivot', { loanPayment: Number(pivotPayment), reductionPercentage: reductionPercentage[0] });
          } else {
              setSimulationResult(null);
              if (onSimulate) onSimulate(null);
          }
      } else if (activeTab === 'closing_tool') {
           if (balloonPayment && !isNaN(balloonPayment)) {
              debouncedSimulate('closing_tool', { monthlyPayment: Number(balloonPayment), futureSavings: Number(futureSavings || 0) });
          } else {
              setSimulationResult(null);
              if (onSimulate) onSimulate(null);
          }
      }
  }, [activeTab, loanPayment, pivotPayment, reductionPercentage, balloonPayment, futureSavings, baseMetrics]);

  const handleReset = () => {
    setLoanPayment('');
    setPivotPayment('');
    setReductionPercentage([20]);
    setBalloonPayment('');
    setFutureSavings('');
    setSimulationResult(null);
    if (onSimulate) onSimulate(null);
  };

  const isActive = simulationResult !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-xl p-5 border bg-slate-800/30 backdrop-blur-sm transition-all ${
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
            className="overflow-hidden"
          >
            <div className="pt-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-slate-900/50 h-auto">
                  <TabsTrigger value="standard_loan" className="text-[10px] py-2 whitespace-normal leading-tight">מסלול רגיל</TabsTrigger>
                  <TabsTrigger value="lifestyle_pivot" className="text-[10px] py-2 whitespace-normal leading-tight">לייף-סטייל</TabsTrigger>
                  <TabsTrigger value="closing_tool" className="text-[10px] py-2 whitespace-normal leading-tight">מסלול בלון</TabsTrigger>
                </TabsList>

                {/* Standard Loan */}
                <TabsContent value="standard_loan" className="space-y-3 mt-4">
                  <div className="text-[11px] text-slate-400 mb-2 border-r-2 border-indigo-500 pr-2">
                      הזנת החזר חודשי חדש לתזרים האמיתי לבחינת יציבות.
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs mb-1.5 block">החזר חודשי צפוי</Label>
                    <Input
                      type="number"
                      placeholder="₪0.00"
                      value={loanPayment}
                      onChange={(e) => setLoanPayment(e.target.value)}
                      className="bg-slate-900/50 border-slate-700 text-white focus:border-indigo-500 h-9"
                      dir="ltr"
                    />
                  </div>
                </TabsContent>

                {/* Lifestyle Pivot */}
                <TabsContent value="lifestyle_pivot" className="space-y-4 mt-4">
                  <div className="text-[11px] text-slate-400 mb-2 border-r-2 border-indigo-500 pr-2">
                      בדיקת היתכנות על ידי צמצום הוצאות גמישות ווולט/פנאי.
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs mb-1.5 block">החזר חודשי צפוי</Label>
                    <Input
                      type="number"
                      placeholder="₪0.00"
                      value={pivotPayment}
                      onChange={(e) => setPivotPayment(e.target.value)}
                      className="bg-slate-900/50 border-slate-700 text-white focus:border-indigo-500 h-9"
                      dir="ltr"
                    />
                  </div>
                  <div className="pt-2 bg-slate-900/30 p-3 rounded-lg border border-slate-800">
                    <Label className="text-slate-300 text-xs flex justify-between mb-3">
                        <span>צמצום הוצאות פנאי</span>
                        <span className="text-indigo-400 font-bold">{reductionPercentage[0]}%</span>
                    </Label>
                    <Slider 
                        value={reductionPercentage} 
                        onValueChange={setReductionPercentage} 
                        max={100} 
                        step={5} 
                        className="my-2"
                    />
                  </div>
                </TabsContent>

                {/* Closing Tool (Balloon) */}
                <TabsContent value="closing_tool" className="space-y-3 mt-4">
                  <div className="text-[11px] text-slate-400 mb-2 border-r-2 border-indigo-500 pr-2">
                      הלוואת גישור עם החזר חודשי נמוך ופירעון ממקור חיסכון עתידי.
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs mb-1.5 block">החזר חודשי (ריבית)</Label>
                    <Input
                      type="number"
                      placeholder="₪0.00"
                      value={balloonPayment}
                      onChange={(e) => setBalloonPayment(e.target.value)}
                      className="bg-slate-900/50 border-slate-700 text-white focus:border-indigo-500 h-9"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs mb-1.5 block">הזרמת הון עתידית צפויה (₪)</Label>
                    <Input
                      type="number"
                      placeholder="₪0.00"
                      value={futureSavings}
                      onChange={(e) => setFutureSavings(e.target.value)}
                      className="bg-slate-900/50 border-slate-700 text-white focus:border-indigo-500 h-9"
                      dir="ltr"
                    />
                  </div>
                </TabsContent>
              </Tabs>

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