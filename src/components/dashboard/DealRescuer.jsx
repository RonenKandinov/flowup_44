import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Crosshair, PlayCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

function DecisionRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

export default function DealRescuer({ onSimulate, baseMetrics }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [decision, setDecision] = useState(null);

  const metricsHash = baseMetrics ? `${Math.round(baseMetrics.totalIncome || 0)}-${Math.round(baseMetrics.liquidAssets || 0)}-${Math.round(baseMetrics.totalFixedExpenses || baseMetrics.totalExpenses || 0)}` : '';

  useEffect(() => {
    setAnalysisComplete(false);
    setIsAnalyzing(false);
    setDecision(null);
    if (onSimulate) onSimulate(null);
  }, [metricsHash, onSimulate]);

  const handleReset = () => {
    setAnalysisComplete(false);
    setDecision(null);
    if (onSimulate) onSimulate(null);
  };

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const income = baseMetrics?.totalIncome || 10000;
      const liquidAssets = baseMetrics?.liquidAssets || 0;
      const fixedExpenses = baseMetrics?.totalFixedExpenses || baseMetrics?.totalExpenses || 0;
      const principal = baseMetrics?.requestedLoanAmount || baseMetrics?.loanAmount || 50000;

      if (!income || fixedExpenses < 0) {
        throw new Error('Missing underwriting metrics');
      }

      const res = await base44.functions.invoke('dealRescuerEngine', {
        userId: baseMetrics?.userId || 'ronenk2424@gmail.com',
        principal,
        baseRate: 0.09,
        income,
        liquidAssets,
        fixedExpenses
      });

      if (!res.data?.success) {
        throw new Error(res.data?.error || 'Failed to run analysis');
      }

      setDecision(res.data.decision);
      setAnalysisComplete(true);
      if (onSimulate) {
        onSimulate({
          ...baseMetrics,
          score: res.data.decision?.approvalProbabilityAfter || 0,
          status: res.data.decision?.status === 'APPROVE' ? 'GREEN' : 'RED'
        });
      }
    } catch (err) {
      console.error('Analysis error:', err);
      toast.error('שגיאה בניתוח הנתונים');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-xl p-4 border bg-slate-800/30 backdrop-blur-sm transition-all flex flex-col ${analysisComplete ? 'border-cyan-500/40 shadow-sm shadow-cyan-500/10' : 'border-slate-700/30'}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white text-xs font-bold flex items-center gap-1.5 uppercase tracking-wide">
          <ShieldCheck size={14} className="text-cyan-400" />
          Decision Engine
        </h3>
        {analysisComplete && (
          <Button onClick={handleReset} variant="ghost" size="sm" className="text-slate-400 hover:text-white text-[10px] h-6 px-2">
            איפוס
          </Button>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center">
        {!analysisComplete && !isAnalyzing && (
          <div className="text-center py-4">
            <div className="mx-auto w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center mb-3 border border-slate-700">
              <Crosshair className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-xs text-slate-300 mb-1 font-medium">החלטת חיתום</p>
            <p className="text-[10px] text-slate-500 mb-4 leading-relaxed max-w-[220px] mx-auto">
              החלטה אחת. מסלול אחד. הסתברות האישור הגבוהה ביותר.
            </p>
            <Button onClick={runAnalysis} className="bg-cyan-600 hover:bg-cyan-500 text-white w-full rounded-lg h-8 text-xs" size="sm">
              <PlayCircle className="w-3.5 h-3.5 mr-2 ml-2" />
              הפעל החלטה
            </Button>
          </div>
        )}

        {isAnalyzing && (
          <div className="text-center py-8 flex flex-col items-center">
            <Loader2 className="w-6 h-6 text-cyan-500 animate-spin mb-3" />
            <p className="text-xs text-cyan-400 font-medium">בודק עסקה...</p>
          </div>
        )}

        {analysisComplete && decision && (
          <div className="space-y-3 animate-in fade-in zoom-in duration-300">
            <div className={`rounded-lg border px-3 py-3 text-center ${decision.status === 'APPROVE' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em]">Decision</div>
              <div className="mt-1 text-lg font-black">{decision.status === 'APPROVE' ? 'APPROVE' : 'DECLINE'}</div>
            </div>

            <div className="grid gap-2">
              <DecisionRow label="Suggested loan amount" value={decision.suggestedLoanAmount ? `₪${decision.suggestedLoanAmount.toLocaleString()}` : '-'} />
              <DecisionRow label="Term (months)" value={decision.term ? String(decision.term) : '-'} />
              <DecisionRow label="Monthly payment" value={decision.monthlyPayment ? `₪${decision.monthlyPayment.toLocaleString()}` : '-'} />
              <DecisionRow label="DSR before" value={`${decision.dsrBefore ?? '-'}%`} />
              <DecisionRow label="DSR after" value={decision.dsrAfter !== null && decision.dsrAfter !== undefined ? `${decision.dsrAfter}%` : '-'} />
              <DecisionRow label="Approval probability before" value={`${decision.approvalProbabilityBefore ?? 0}%`} />
              <DecisionRow label="Approval probability after" value={`${decision.approvalProbabilityAfter ?? 0}%`} />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}