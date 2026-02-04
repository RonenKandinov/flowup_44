import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Wallet, TrendingDown, TrendingUp, Trash2, RefreshCw, Cpu, CheckCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calculateWhatIf, SystemInfo } from '../components/utils/forecastingLogic';
import { Storage } from '../components/utils/storage';
import { FiscalAgent } from '../components/protocol/core/fiscalAgent';
import { FiscalAgent } from '../components/protocol/core/fiscalAgent'; // Import Protocol

import SpeedometerGauge from '../components/dashboard/SpeedometerGauge';
import StatCard from '../components/dashboard/StatCard';
import WhatIfSimulator from '../components/dashboard/WhatIfSimulator';
import FutureCake from '../components/dashboard/FutureCake';
import InsightsAgent from '../components/dashboard/InsightsAgent'; // New
import CSVUploader from '../components/upload/CSVUploader';
import EmptyState from '../components/dashboard/EmptyState';
import Disclaimer from '../components/dashboard/Disclaimer';

export default function Dashboard() {
  const [showUploader, setShowUploader] = useState(false);
  const [whatIfAmount, setWhatIfAmount] = useState(0);
  const [whatIfName, setWhatIfName] = useState('');
  const [localData, setLocalData] = useState(null);
  const [engineData, setEngineData] = useState(null);
  const [isStorageLoading, setIsStorageLoading] = useState(true);
  
  const queryClient = useQueryClient();

  // Load from Local Storage on mount
  useEffect(() => {
    const loadFromStorage = async () => {
      try {
        const data = await Storage.load();
        if (data) {
          // Rehydrate Date objects if needed (JSON.parse makes them strings)
          if (data.transactions) {
            data.transactions.forEach(t => t.date = new Date(t.date));
          }
          // Rehydrate engineData transactions as well (critical for Monte Carlo)
          if (data.engineData && data.engineData.allTransactions) {
              data.engineData.allTransactions.forEach(t => t.date = new Date(t.date));
          }

          if (data.forecastData) {
            // Usually strings for graph points, but just in case
          }

          setLocalData(data);
          setEngineData(data.engineData);
        }
      } catch (e) {
        console.error("Failed to load local data", e);
      } finally {
        setIsStorageLoading(false);
      }
    };
    loadFromStorage();
  }, []);

  // Fetch saved snapshot
  const { data: snapshots, isLoading } = useQuery({
    queryKey: ['financial-snapshots'],
    queryFn: () => base44.entities.FinancialSnapshot.list('-upload_date', 1),
    initialData: []
  });

  // Fetch Shadow Realm entries (Secured Data)
  const { data: shadowEntries } = useQuery({
    queryKey: ['shadow-entries'],
    queryFn: () => base44.entities.ShadowRealmEntry.list('-transaction_date', 100),
    initialData: []
  });

  // Reconstruct transactions from Shadow Realm on the fly
  const transactions = React.useMemo(() => {
    if (!shadowEntries) return [];
    return shadowEntries.map(entry => FiscalAgent.recoverEntry(entry))
      .filter(t => !t.is_corrupted) // Filter out corrupted data
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [shadowEntries]);

  // Use local data if exists, otherwise use saved data
  const snapshot = localData?.snapshot || snapshots?.[0];
  const forecastData = localData?.forecastData || generateForecastFromTransactions(transactions);
  const currentEngineData = localData?.engineData || engineData;

  // Calculate real-time monthly stats to ensure we display only the latest month
  const currentMonthStats = React.useMemo(() => {
    const txns = localData?.transactions || transactions;
    if (!txns || txns.length === 0) return null;

    // Normalize and Sort
    const sortedTxns = [...txns]
      .map(t => ({...t, date: new Date(t.date)}))
      .filter(t => !isNaN(t.date.getTime()))
      .sort((a, b) => b.date - a.date);

    if (sortedTxns.length === 0) return null;

    // Determine the "Current Month" based on the very last transaction
    const latestDate = sortedTxns[0].date;
    const targetMonth = latestDate.getMonth();
    const targetYear = latestDate.getFullYear();
    const monthName = latestDate.toLocaleDateString('he-IL', { month: 'long' });

    let income = 0;
    let expenses = 0;

    for (const t of sortedTxns) {
      // Only sum transactions from the target month
      if (t.date.getMonth() === targetMonth && t.date.getFullYear() === targetYear) {
        if (t.credit !== undefined || t.debit !== undefined) {
          // CSV Format (credit/debit fields)
          income += (t.credit || 0);
          expenses += (t.debit || 0);
        } else if (t.amount !== undefined) {
          // DB Format (signed amount)
          if (t.amount > 0) income += t.amount;
          else expenses += Math.abs(t.amount);
        }
      }
    }

    return { income, expenses, monthName };
  }, [localData, transactions]);

  // Generate forecast data from transactions
  function generateForecastFromTransactions(txns) {
    if (!txns || txns.length === 0) return [];
    
    // Fallback logic for when we don't have engineData
    const avgDaily = Math.abs(
      txns.filter(t => (t.amount || (t.debit * -1)) < 0).reduce((sum, t) => sum + (t.amount || (t.debit * -1)), 0) / 30
    );
    
    const latestBalance = txns[0]?.balance || 
      txns.reduce((sum, t) => sum + (t.amount || 0), 0);
    
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

  // Save transactions to Shadow Realm mutation
  const saveTransactionsMutation = useMutation({
    mutationFn: (shadowEntries) => base44.entities.ShadowRealmEntry.bulkCreate(shadowEntries)
  });

  // Delete all data mutation
  const deleteDataMutation = useMutation({
    mutationFn: async () => {
      // Clear local storage
      await Storage.clear();

      // Fetch all data (up to reasonable limits) to delete
      const allSnapshots = await base44.entities.FinancialSnapshot.list(null, 100);
      const allTransactions = await base44.entities.Transaction.list(null, 500);

      // Helper for batching deletions
      const batchDelete = async (items, entity) => {
          const BATCH_SIZE = 3;
          for (let i = 0; i < items.length; i += BATCH_SIZE) {
              await Promise.all(
                  items.slice(i, i + BATCH_SIZE).map(async (item) => {
                      try {
                          await entity.delete(item.id);
                      } catch (error) {
                          console.warn(`Failed to delete item ${item.id}`, error);
                      }
                  })
              );
          }
      };

      await batchDelete(allSnapshots, base44.entities.FinancialSnapshot);
      await batchDelete(allTransactions, base44.entities.Transaction);
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
    
    // Save locally (encrypted)
    await Storage.save(data);

    // Clear previous DB data to prevent duplication (Batched to avoid rate limits)
    const allSnapshots = await base44.entities.FinancialSnapshot.list();
    const allTransactions = await base44.entities.Transaction.list();

    const batchProcess = async (items, batchSize, processFn) => {
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            await Promise.all(batch.map(async (item) => {
                try {
                    await processFn(item);
                } catch (error) {
                    console.warn('Batch process error', error);
                }
            }));
        }
    };

    await batchProcess(allSnapshots, 3, s => base44.entities.FinancialSnapshot.delete(s.id));
    await batchProcess(allTransactions, 3, t => base44.entities.Transaction.delete(t.id));

    // Save to database
    await saveSnapshotMutation.mutateAsync(data.snapshot);
    
    // Process and Seal transactions into the Shadow Realm
    if (data.transactions.length > 0) {
      const shadowEntries = data.transactions.slice(0, 100).map(t => {
          const rawTransaction = {
              date: t.date instanceof Date ? t.date.toISOString().split('T')[0] : t.date,
              description: t.description,
              amount: (t.credit || 0) - (t.debit || 0), // Signed amount
              category: (t.credit > 0) ? 'income' : 'expense'
          };
          // MILLENNIUM PROTOCOL: Encrypt & Seal
          return FiscalAgent.processTransaction(rawTransaction);
      });
      await saveTransactionsMutation.mutateAsync(shadowEntries);
    }
    
    // Invalidate queries to refresh view
    queryClient.invalidateQueries(['financial-snapshots']);
    queryClient.invalidateQueries(['transactions']);
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

  if (isStorageLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
        <div className="max-w-6xl mx-auto flex items-center justify-between border-b border-slate-800/60 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              FlowUp
            </h1>
            <p className="text-slate-500 text-xs mt-1 tracking-wide uppercase">FutureFlow Dashboard</p>
          </div>
          
          {hasData && (
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowUploader(true)}
                variant="ghost"
                size="sm"
                className="bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:bg-slate-800 hover:text-white transition-all h-7 px-3 rounded-md"
              >
                <RefreshCw className="w-3 h-3 ml-1.5" />
                <span className="text-[11px] font-medium">עדכן נתונים</span>
              </Button>
              <Button
                onClick={() => deleteDataMutation.mutate()}
                variant="ghost"
                size="sm"
                className="text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-transparent hover:border-red-900/30 rounded-lg h-9 w-9 p-0"
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
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
               <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-white mb-2">ברוכים הבאים ל-FlowUp</h2>
                  <p className="text-slate-400">העלו את קובץ הבנק שלכם כדי להתחיל לראות תובנות</p>
               </div>
               <CSVUploader inline={true} onDataParsed={handleDataParsed} />
            </div>
          ) : (
            <>
              {/* Stats Row - Compact on Mobile */}
              <div className="grid grid-cols-3 gap-2 md:grid-cols-3 md:gap-4 mb-4 md:mb-6">
                <StatCard
                  title="יתרה"
                  value={`₪${Math.round(snapshot.current_balance || 0).toLocaleString('he-IL')}`}
                  icon={snapshot.current_balance < 0 ? TrendingDown : CheckCircle}
                  color={snapshot.current_balance < 0 ? 'red' : 'green'}
                  delay={0}
                />
                <StatCard
                  title="סך הכנסות"
                  value={`₪${Math.round(currentEngineData?.totalIncome ?? currentMonthStats?.income ?? snapshot.total_income ?? 0).toLocaleString('he-IL')}`}
                  icon={TrendingUp}
                  color="green"
                  delay={0.1}
                />
                <StatCard
                  title="סך הוצאות"
                  value={`₪${Math.round(currentEngineData?.totalExpenses ?? currentMonthStats?.expenses ?? snapshot.total_expenses ?? 0).toLocaleString('he-IL')}`}
                  icon={TrendingDown}
                  color="red"
                  delay={0.2}
                />
              </div>

              {/* Main Dashboard Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                {/* Speedometer: Mobile 1, Desktop 1 (Top Left) */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="order-1 lg:order-1 relative rounded-xl p-0 border-none bg-transparent flex flex-col items-center h-auto min-h-[240px]"
                >
                  <SpeedometerGauge
                    projectedBalance={
                      currentEngineData?.milestoneData 
                        ? currentEngineData.milestoneData.projection 
                        : (currentEngineData?.whatIfApplied 
                            ? currentEngineData.projectedEOM 
                            : (snapshot.projected_eom_balance || 0))
                    }
                    label={
                      currentEngineData?.milestoneData 
                        ? currentEngineData.milestoneData.text 
                        : "יתרה צפויה לסוף החודש"
                    }
                    riskLevel={currentEngineData?.riskStatus || snapshot.risk_level || 'green'}
                    riskDay={currentEngineData?.riskDay || snapshot.risk_day}
                    whatIfAmount={whatIfAmount}
                    engineData={currentEngineData}
                  />
                </motion.div>

                {/* Future Cake: Mobile 4 (Last), Desktop 2 (Top Right) */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="order-4 lg:order-2 relative rounded-xl p-0 border-none bg-transparent flex flex-col items-center h-auto"
                >
                    <FutureCake 
                        fixedExpenses={currentEngineData?.expenseAnalysis?.fixed || 0}
                        flexExpenses={currentEngineData?.expenseAnalysis?.flex || 0}
                        taxRefundPotential={currentEngineData?.expenseAnalysis?.taxPotential || 0}
                    />
                </motion.div>

                {/* InsightsAgent: Mobile 3, Desktop 3 (Bottom Left) */}
                <div className="order-3 lg:order-3 space-y-4">
                     {/* Agent Widget - Prominently displayed */}
                     <div className="h-auto">
                        <InsightsAgent insights={currentEngineData?.smartInsights || []} />
                     </div>


                </div>
                
                {/* WhatIfSimulator: Mobile 2, Desktop 4 (Bottom Right) */}
                <div className="order-2 lg:order-4 h-auto">
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