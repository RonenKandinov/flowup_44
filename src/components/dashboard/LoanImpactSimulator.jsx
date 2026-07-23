import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { SlidersHorizontal } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

const fmt = (n) => Math.round(Number(n || 0)).toLocaleString('en-US');

// Real-time "what if" — how a requested loan amount changes the borrower's DSR
// and approval verdict. Pure client-side annuity math on top of live loanLogicV2 metrics.
export default function LoanImpactSimulator({ metrics }) {
  const [amount, setAmount] = useState(50000);
  const [term, setTerm] = useState(48);

  const sim = useMemo(() => {
    const income = metrics?.totalIncome || 0;
    const fixed = metrics?.totalFixedExpenses || 0;
    if (income <= 0) return null;

    const annualRate = 0.09;
    const r = annualRate / 12;
    const payment = (amount * r) / (1 - Math.pow(1 + r, -term));
    const newDSR = Math.round(((fixed + payment) / income) * 100);
    const baseDTI = Math.round(metrics?.dti || 0);

    let verdict, color;
    if (newDSR <= 45) { verdict = 'אישור מלא (Tier A)'; color = 'emerald'; }
    else if (newDSR <= 55) { verdict = 'אישור רגיל (Tier B)'; color = 'cyan'; }
    else if (newDSR <= 65) { verdict = 'Stretch — אישור מותנה (Tier C)'; color = 'amber'; }
    else { verdict = 'מעל יכולת החזר — נדרשת הקטנת סכום'; color = 'red'; }

    return { payment: Math.round(payment), newDSR, baseDTI, verdict, color };
  }, [metrics, amount, term]);

  if (!sim) return null;

  const colorMap = {
    emerald: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
    cyan: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10',
    amber: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
    red: 'text-red-400 border-red-500/40 bg-red-500/10',
  };
  const barColor = { emerald: 'bg-emerald-500', cyan: 'bg-cyan-500', amber: 'bg-amber-500', red: 'bg-red-500' }[sim.color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm p-5"
      dir="rtl"
    >
      <div className="flex items-center gap-2 mb-5">
        <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-500/30">
          <SlidersHorizontal className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">סימולטור השפעה בזמן אמת</h3>
          <p className="text-[10px] text-slate-500">איך סכום ההלוואה משנה את כושר ההחזר — Active Intervention</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-slate-400">סכום הלוואה מבוקש</span>
            <span className="text-white font-bold">₪{fmt(amount)}</span>
          </div>
          <Slider value={[amount]} onValueChange={([v]) => setAmount(v)} min={10000} max={500000} step={5000} />
        </div>
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-slate-400">תקופת החזר</span>
            <span className="text-white font-bold">{term} חודשים</span>
          </div>
          <Slider value={[term]} onValueChange={([v]) => setTerm(v)} min={12} max={84} step={6} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3 text-center">
          <p className="text-lg font-bold text-white">₪{fmt(sim.payment)}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">החזר חודשי (9% שנתי)</p>
        </div>
        <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3 text-center">
          <p className="text-lg font-bold text-slate-300">{sim.baseDTI}%</p>
          <p className="text-[10px] text-slate-500 mt-0.5">DTI נוכחי</p>
        </div>
        <div className={`rounded-xl border p-3 text-center ${colorMap[sim.color]}`}>
          <p className="text-lg font-bold">{sim.newDSR}%</p>
          <p className="text-[10px] opacity-70 mt-0.5">DSR לאחר ההלוואה</p>
        </div>
      </div>

      <div className="mb-3">
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <motion.div
            className={`h-full ${barColor}`}
            animate={{ width: `${Math.min(100, sim.newDSR)}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-slate-600 mt-1">
          <span>0%</span><span>45%</span><span>55%</span><span>65%</span><span>100%</span>
        </div>
      </div>

      <div className={`rounded-xl border px-3 py-2 text-xs font-semibold ${colorMap[sim.color]}`}>
        {sim.verdict}
      </div>
    </motion.div>
  );
}