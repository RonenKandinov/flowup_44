import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, TrendingUp, TrendingDown, AlertTriangle, Lightbulb, PiggyBank, Sparkles } from 'lucide-react';
import { analyzeFinancialPatterns } from '../utils/aiAnalysis';

export default function AIInsights({ transactions, currentBalance, projectedBalance }) {
  // הרצת האנליזה (Memoized כדי למנוע חישובים מיותרים)
  const insights = useMemo(() => {
    return analyzeFinancialPatterns(transactions, currentBalance, projectedBalance);
  }, [transactions, currentBalance, projectedBalance]);

  if (!insights || insights.length === 0) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'warning': return <TrendingUp className="w-5 h-5 text-orange-400" />;
      case 'danger': return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'success': return <TrendingDown className="w-5 h-5 text-green-400" />;
      case 'opportunity': return <PiggyBank className="w-5 h-5 text-emerald-400" />;
      case 'tip': return <Lightbulb className="w-5 h-5 text-yellow-400" />;
      default: return <Brain className="w-5 h-5 text-cyan-400" />;
    }
  };

  const getColorClass = (type) => {
    switch (type) {
      case 'warning': return 'bg-orange-500/10 border-orange-500/20 text-orange-200';
      case 'danger': return 'bg-red-500/10 border-red-500/20 text-red-200';
      case 'success': return 'bg-green-500/10 border-green-500/20 text-green-200';
      case 'opportunity': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200';
      case 'tip': return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-200';
      default: return 'bg-slate-800/50 border-slate-700 text-slate-200';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-slate-700/50 bg-slate-900/50">
        <div className="p-2 rounded-lg bg-indigo-500/20">
          <Sparkles className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">FlowUp AI Analyst</h3>
          <p className="text-[10px] text-slate-400">ניתוח דפוסים חכם (Local Privacy-First)</p>
        </div>
      </div>

      {/* Insights List */}
      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
        {insights.map((insight, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`p-3 rounded-lg border ${getColorClass(insight.type)} transition-all hover:bg-opacity-70`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0">
                {getIcon(insight.type)}
              </div>
              <div>
                <h4 className="font-bold text-sm mb-1">{insight.title}</h4>
                <p className="text-xs opacity-80 leading-relaxed">
                  {insight.message}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
        
        {insights.length === 0 && (
          <div className="text-center py-6 text-slate-500 text-xs">
            לא נמצאו תובנות מיוחדות כרגע. המצב נראה יציב!
          </div>
        )}
      </div>
      
      {/* Decorative gradient overlay */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full pointer-events-none" />
    </motion.div>
  );
}