import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Wallet, TrendingDown, TrendingUp, Trash2, RefreshCw, Cpu, CheckCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calculateWhatIf, SystemInfo } from '../components/utils/forecastingLogic';
// Note: Encryption Utility available in components/utils/encryption.js for future integration

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

  // Use local data if exists, otherwise use saved data
  const snapshot = localData?.snapshot || snapshots?.[0];
  const forecastData = localData?.forecastData || generateForecastFromTransactions(transactions);
  const currentEngineData = localData?.engineData || engineData;

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
    const originalEngineData = { ...data.engineData, whatIfApplied: false };
    setLocalData(data);
    setEngineData(originalEngineData);
    setWhatIfAmount(0);
    setWhatIfName('');
    
    // Save to database
    await saveSnapshotMutation.mutateAsync(data.snapshot);
    
    // Save first 100 transactions
    if (data.transactions.length > 0) {
      await saveTransactionsMutation.mutateAsync(data.transactions.slice(0, 100));
    }
  };

  const handleWhatIfSimulate = (scenario) => {
    if (scenario.type === 'reset') {
      setWhatIfAmount(0);
      setWhatIfName('');
      // Restore original data from engineData or snapshot
      if (engineData) {
        setLocalData(prev => prev ? {
          ...prev,
          snapshot: {
            ...prev.snapshot,
            projected_eom_balance: engineData.projectedEOM,
            risk_level: engineData.riskStatus,
            risk_day: engineData.riskDay
          },
          forecastData: engineData.graphPoints,
          engineData: {
            ...engineData,
            whatIfApplied: false,
            riskTrend: null
          }
        } : null);
      } else if (snapshots?.[0]) {
        // Fallback to snapshot from database
        setLocalData({
          snapshot: snapshots[0],
          forecastData: generateForecastFromTransactions(transactions),
          engineData: null,
          transactions: transactions || []
        });
      }
      return;
    }

    const amount = scenario.amount || 0;
    const name = scenario.name || '';
    
    setWhatIfAmount(amount);
    setWhatIfName(name);
    
    // Build engine data from snapshot if not available
    let dataToUse = localData?.engineData || engineData;

    // If no engineData exists but we have a snapshot, construct baseline data
    if (!dataToUse && snapshot) {
      dataToUse = {
        success: true,
        currentBalance: snapshot.current_balance || 0,
        projectedEOM: snapshot.projected_eom_balance || 0,
        riskStatus: snapshot.risk_level || 'green',
        riskDay: snapshot.risk_day || null,
        avgDailySpending: snapshot.avg_daily_spending || 50, // Default fallback
        totalIncome: snapshot.total_income || 0,
        totalExpenses: snapshot.total_expenses || 0,
        graphPoints: forecastData || []
      };
    }
    
    if (dataToUse) {
      const whatIfResult = calculateWhatIf(dataToUse, scenario);
      
      // Update local data with what-if results including trend
      if (localData) {
        setLocalData(prev => ({
          ...prev,
          snapshot: {
            ...prev.snapshot,
            projected_eom_balance: whatIfResult.projectedEOM,
            risk_level: whatIfResult.riskStatus,
            risk_day: whatIfResult.riskDay
          },
          forecastData: whatIfResult.graphPoints,
          engineData: whatIfResult
        }));
      } else if (snapshots?.[0]) {
        // If no localData yet, create it from snapshot
        setLocalData({
          snapshot: {
            ...snapshots[0],
            projected_eom_balance: whatIfResult.projectedEOM,
            risk_level: whatIfResult.riskStatus,
            risk_day: whatIfResult.riskDay
          },
          forecastData: whatIfResult.graphPoints,
          engineData: whatIfResult,
          transactions: transactions || []
        });
      }
    }
  };

  const hasData = snapshot && snapshot.current_balance !== undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" dir="rtl">
      {/* Background pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(34, 211, 238, 0.15) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* Header */}
      <header className="relative z-10 px-4 py-6 md:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              FlowUp
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-slate-500 text-sm">FutureFlow Dashboard</p>
              {engineData && (
                <div className="flex items-center gap-1 text-xs text-cyan-500/70">
                  <Cpu size={12} />
                  <span>v{SystemInfo.version}</span>
                </div>
              )}
            </div>
          </div>
          
          {hasData && (
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowUploader(true)}
                variant="outline"
                size="sm"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <RefreshCw className="w-4 h-4 ml-2" />
                עדכן נתונים
              </Button>
              <Button
                onClick={() => deleteDataMutation.mutate()}
                variant="ghost"
                size="sm"
                className="text-red-400 hover:text-red-300 hover:bg-red-950/50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 px-4 pb-8 md:px-8">
        <div className="max-w-6xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-[60vh]">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !hasData ? (
            <EmptyState onUploadClick={() => setShowUploader(true)} />
          ) : (
            <>
              {/* Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <StatCard
                  title="יתרה נוכחית"
                  value={`₪${snapshot.current_balance?.toLocaleString('he-IL')}`}
                  icon={snapshot.risk_level === 'green' ? CheckCircle : snapshot.risk_level === 'yellow' ? Wallet : TrendingDown}
                  color={snapshot.risk_level === 'green' ? 'green' : snapshot.risk_level === 'yellow' ? 'yellow' : 'red'}
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
              </div>

              {/* Main Dashboard Grid */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Speedometer */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative rounded-2xl p-6 border border-cyan-500/20 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm flex flex-col items-center"
                >
                  <SpeedometerGauge
                    projectedBalance={snapshot.projected_eom_balance || 0}
                    riskLevel={currentEngineData?.riskStatus || snapshot.risk_level || 'green'}
                    riskDay={currentEngineData?.riskDay || snapshot.risk_day}
                    whatIfAmount={whatIfAmount}
                  />
                  

                  
                  {currentEngineData && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-4 p-3 rounded-lg bg-slate-800/30 border border-slate-700/50"
                    >
                      <div className="text-xs text-slate-400 space-y-1">
                        <div className="flex justify-between">
                          <span>רמת ביטחון:</span>
                          <span className={`font-medium ${
                            currentEngineData.confidence === 'high' ? 'text-green-400' :
                            currentEngineData.confidence === 'medium' ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {currentEngineData.confidence === 'high' ? 'גבוהה' :
                             currentEngineData.confidence === 'medium' ? 'בינונית' : 'נמוכה'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>עסקאות:</span>
                          <span className="text-slate-300">{currentEngineData.transactionCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>מנוע:</span>
                          <span className="text-cyan-400">{SystemInfo.engine}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>

                {/* Right Column */}
                <div className="space-y-6">
                  <RiskZoneChart
                    data={forecastData}
                    riskThreshold={0}
                    criticalDate={snapshot.risk_day}
                    projectedBalance={snapshot.projected_eom_balance}
                    currentBalance={snapshot.current_balance}
                  />
                  
                  <WhatIfSimulator
                    onSimulate={handleWhatIfSimulate}
                    currentBalance={snapshot.current_balance}
                  />
                </div>
              </div>

              <Disclaimer />
            </>
          )}
        </div>
      </main>

      <footer className="relative z-10 py-5 text-center px-4">
        <div className="max-w-4xl mx-auto text-[11px] leading-relaxed text-[#666666] opacity-70">
          <p className="mb-2">
            <strong>הבהרה משפטית:</strong> המערכת הנה כלי עזר ויזואלי לסימולציה וניתוח נתונים בלבד, ואינה מהווה ייעוץ פיננסי, השקעותי או פנסיוני לפי חוק. התחזיות מבוססות על מודלים סטטיסטיים ואין לראות בהן הבטחה לביצועים עתידיים. האחריות על כל החלטה פיננסית הנה על המשתמש בלבד. המערכת פועלת במודל "קריאה בלבד" (Read-only) ואינה מבצעת פעולות בחשבון הבנק.
          </p>
          <p>
            <strong>פרטיות ואבטחה:</strong> הנתונים מעובדים במחשב שלך בלבד (Local-First) ואינם נשמרים בשרתי המערכת. אנו משתמשים ב-PII Sanitizer לניקוי פרטים מזהים לפני הניתוח.
          </p>
        </div>
      </footer>

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