import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Wallet, TrendingDown, TrendingUp, Trash2, RefreshCw, Cpu, CheckCircle, Activity, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calculateWhatIf, SystemInfo } from '../components/utils/forecastingLogic';

import SpeedometerGauge from '../components/dashboard/SpeedometerGauge';
import StatCard from '../components/dashboard/StatCard';
import RiskZoneChart from '../components/dashboard/RiskZoneChart';
import WhatIfSimulator from '../components/dashboard/WhatIfSimulator';
import CSVUploader from '../components/upload/CSVUploader';
import EmptyState from '../components/dashboard/EmptyState';
import Disclaimer from '../components/dashboard/Disclaimer';

export default function Dashboard() {
  const [showUploader, setShowUploader] = useState(false);
  const [whatIfAmount, setWhatIfAmount] = useState(0);
  const [whatIfName, setWhatIfName] = useState('');
  const [localData, setLocalData] = useState(null);
  const [engineData, setEngineData] = useState(null);
  
  const queryClient = useQueryClient();

  // Fetch saved snapshot
  const { data: snapshots, isLoading } = useQuery({
    queryKey: ['financial-snapshots'],
    queryFn: () => base44.entities.FinancialSnapshot.list('-upload_date', 1),
    initialData: []
  });

  // Fetch transactions for chart
  const { data: transactions } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-date', 90),
    initialData: []
  });

  const snapshot = localData?.snapshot || snapshots?.[0];
  const forecastData = localData?.forecastData || generateForecastFromTransactions(transactions);

  // Generate forecast data from transactions
  function generateForecastFromTransactions(txns) {
    if (!txns || txns.length === 0) return [];
    
    const avgDaily = Math.abs(
      txns.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0) / 30
    );
    
    const latestBalance = txns[0]?.balance || 
      txns.reduce((sum, t) => sum + t.amount, 0);
    
    const today = new Date();
    const daysRemaining = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate();
    
    const data = [];
    let balance = latestBalance;
    
    for (let i = 0; i <= daysRemaining; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      data.push({
        date: date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }),
        balance: Math.round(balance)
      });
      balance -= avgDaily;
    }
    
    return data;
  }

  // Save snapshot mutation
  const saveSnapshotMutation = useMutation({
    mutationFn: (data) => base44.entities.FinancialSnapshot.create(data),
    onSuccess: () => queryClient.invalidateQueries(['financial-snapshots'])
  });

  // Save transactions mutation
  const saveTransactionsMutation = useMutation({
    mutationFn: (txns) => base44.entities.Transaction.bulkCreate(txns)
  });

  // Delete all data mutation
  const deleteDataMutation = useMutation({
    mutationFn: async () => {
      const allSnapshots = await base44.entities.FinancialSnapshot.list();
      const allTransactions = await base44.entities.Transaction.list();
      
      await Promise.all([
        ...allSnapshots.map(s => base44.entities.FinancialSnapshot.delete(s.id)),
        ...allTransactions.map(t => base44.entities.Transaction.delete(t.id))
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['financial-snapshots']);
      queryClient.invalidateQueries(['transactions']);
      setLocalData(null);
    }
  });

  const handleDataParsed = async (data) => {
    setLocalData(data);
    setEngineData(data.engineData);
    
    // Save to database
    await saveSnapshotMutation.mutateAsync(data.snapshot);
    
    // Save first 100 transactions
    if (data.transactions.length > 0) {
      await saveTransactionsMutation.mutateAsync(data.transactions.slice(0, 100));
    }
  };

  const handleWhatIfSimulate = (amount, name) => {
    setWhatIfAmount(amount);
    setWhatIfName(name);
    
    // If we have engine data, recalculate with what-if
    if (engineData && amount > 0) {
      const whatIfResult = calculateWhatIf(engineData, amount);
      setLocalData(prev => ({
        ...prev,
        snapshot: {
          ...prev.snapshot,
          projected_eom_balance: whatIfResult.projectedEOM,
          risk_level: whatIfResult.riskStatus,
          risk_day: whatIfResult.riskDay
        },
        forecastData: whatIfResult.graphPoints
      }));
    }
  };

  const hasData = snapshot && snapshot.current_balance !== undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50" dir="rtl" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Subtle background pattern */}
      <div className="fixed inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.15) 1px, transparent 0)`,
          backgroundSize: '48px 48px'
        }} />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-8 md:px-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
              FlowUp
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <p className="text-slate-500 text-sm font-medium">לוח בקרה פיננסי</p>
              {engineData && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                  <Cpu size={11} />
                  <span>v{SystemInfo.version}</span>
                </div>
              )}
            </div>
          </div>
          
          {hasData && (
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowUploader(true)}
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl"
              >
                <RefreshCw className="w-4 h-4 ml-2" />
                עדכן נתונים
              </Button>
              <Button
                onClick={() => deleteDataMutation.mutate()}
                variant="ghost"
                className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 px-6 pb-12 md:px-10">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-[60vh]">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !hasData ? (
            <EmptyState onUploadClick={() => setShowUploader(true)} />
          ) : (
            <>
              {/* Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
                <StatCard
                  title="יתרה נוכחית"
                  value={`₪${snapshot.current_balance?.toLocaleString('he-IL')}`}
                  icon={(snapshot.current_balance || 0) > 0 ? CheckCircle : TrendingDown}
                  color={(snapshot.current_balance || 0) > 0 ? 'green' : 'red'}
                  delay={0}
                />
                <StatCard
                  title="סך הכנסות"
                  value={`₪${snapshot.total_income?.toLocaleString('he-IL') || '0'}`}
                  icon={TrendingUp}
                  color="green"
                  delay={0.1}
                />
                <StatCard
                  title="סך הוצאות"
                  value={`₪${snapshot.total_expenses?.toLocaleString('he-IL') || '0'}`}
                  icon={TrendingDown}
                  color="red"
                  delay={0.2}
                />
                <StatCard
                  title="ממוצע יומי"
                  value={`₪${snapshot.avg_daily_spending?.toLocaleString('he-IL') || '0'}`}
                  icon={Activity}
                  color="cyan"
                  delay={0.3}
                />
              </div>

              {/* Main Dashboard Grid */}
              <div className="grid md:grid-cols-2 gap-8">
                {/* Speedometer */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="relative rounded-3xl p-8 bg-white/80 backdrop-blur-xl shadow-lg border border-white/20"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
                  }}
                >
                  <SpeedometerGauge
                    currentBalance={snapshot.current_balance || 0}
                    projectedBalance={snapshot.projected_eom_balance || 0}
                    riskLevel={snapshot.risk_level || 'green'}
                    riskDay={snapshot.risk_day}
                    whatIfAmount={whatIfAmount}
                  />
                  
                  {whatIfAmount > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30"
                    >
                      <p className="text-sm text-yellow-400 text-center">
                        {whatIfName ? `"${whatIfName}" - ` : ''}
                        הוצאה של ₪{whatIfAmount.toLocaleString('he-IL')} תפחית את היתרה הצפויה
                      </p>
                    </motion.div>
                  )}
                  
                  {engineData && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-200"
                    >
                      <div className="text-xs text-slate-600 space-y-2">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                          <div className="flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[10px] text-slate-400 uppercase tracking-wide">מרווח בטיחות</span>
                          </div>
                          <span className="text-slate-400 font-semibold">17%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium">רמת ביטחון:</span>
                          <span className={`font-semibold ${
                            engineData.confidence === 'high' ? 'text-emerald-600' :
                            engineData.confidence === 'medium' ? 'text-amber-600' :
                            'text-rose-600'
                          }`}>
                            {engineData.confidence === 'high' ? 'גבוהה' :
                             engineData.confidence === 'medium' ? 'בינונית' : 'נמוכה'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium">עסקאות:</span>
                          <span className="text-slate-700 font-semibold">{engineData.transactionCount}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>

                {/* Right Column */}
                <div className="space-y-8">
                  <RiskZoneChart
                    data={forecastData}
                    riskThreshold={0}
                    criticalDate={snapshot.risk_day}
                  />
                  
                  <WhatIfSimulator
                    onSimulate={handleWhatIfSimulate}
                    currentBalance={snapshot.current_balance}
                  />
                </div>
              </div>

              {whatIfAmount > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-200"
                >
                  <p className="text-sm text-amber-700 text-center font-medium">
                    הוצאה של ₪{whatIfAmount.toLocaleString('he-IL')} תשפיע על היתרה הבטוחה שלך
                  </p>
                </motion.div>
              )}

              <Disclaimer />
            </>
          )}
        </div>
      </main>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploader && (
          <CSVUploader
            onDataParsed={handleDataParsed}
            onClose={() => setShowUploader(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}