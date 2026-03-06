import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Wallet, TrendingDown, TrendingUp, Trash2, RefreshCw, Cpu, CheckCircle, Plus, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateUnderwritingReport } from '../components/utils/excelReportGenerator';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calculateWhatIf, SystemInfo } from '../components/utils/forecastingLogic';
import { FiscalAgent } from '../components/protocol/core/fiscalAgent';

import SpeedometerGauge from '../components/dashboard/SpeedometerGauge';
import StatCard from '../components/dashboard/StatCard';
import LiquidAssetsCard from '../components/dashboard/LiquidAssetsCard'; // New Component
import WhatIfSimulator from '../components/dashboard/WhatIfSimulator';
import FutureCake from '../components/dashboard/FutureCake';
import InsightsAgent from '../components/dashboard/InsightsAgent'; // New
import CSVUploader from '../components/upload/CSVUploader'; // Kept for admin fallback if needed
import EmptyState from '../components/dashboard/EmptyState';
import Disclaimer from '../components/dashboard/Disclaimer';
import OpenFinanceConnect from '../components/connect/OpenFinanceConnect';
import { useTransactionSync } from '../components/hooks/useTransactionSync';
import { useLoanMetrics } from '../components/hooks/useLoanMetrics';
import { toast } from 'sonner';

// Generates InsightsAgent-compatible data from loan metrics when the
// insightEngine backend function is unavailable (not deployed or returns 405).
function generateLocalInsights(metrics) {
  if (!metrics) return null;
  const dti = Math.round(metrics.dti || 0);
  const income = metrics.totalIncome || 1;
  const fixedExpenses = metrics.totalFixedExpenses || 0;
  const liquidAssets = metrics.liquidAssets || 0;
  const status = (metrics.status || 'green').toUpperCase();

  const adjustedDti = Math.round((fixedExpenses * 0.85 / income) * 100);
  const liquidityBufferMonths = parseFloat((liquidAssets / income).toFixed(1));
  const incomeVolatility = Math.abs(metrics.trends?.income || 0);
  const riskTier = status === 'RED' ? 'Red' : status === 'ORANGE' ? 'Orange' : 'Green';

  const riskFlags = [];
  if (dti > 40) riskFlags.push(`יחס DTI גבוה: ${dti}% (מעל 40%)`);
  if (liquidityBufferMonths < 2) riskFlags.push(`כרית נזילות נמוכה: ${liquidityBufferMonths} חודשים`);
  if (metrics.forceRedReason) riskFlags.push(metrics.forceRedReason);

  const totalExpenses = metrics.totalExpenses || 0;
  const savingsRate = income > 1 ? Math.round(((income - totalExpenses) / income) * 100) : 0;
  const incomeTrend = metrics.trends?.income || 0;
  const trendLabel = incomeTrend > 3 ? 'עולה' : incomeTrend < -3 ? 'יורד' : 'יציב';
  const stressPassed = metrics.stressTestPassed ?? null;
  const confidence = metrics.confidence || null;

  const dtiAssessment = dti <= 30 ? 'תקין (≤30%)' : dti <= 40 ? 'גבולי (31–40%)' : 'גבוה (>40%)';
  const liquidityAssessment = liquidityBufferMonths >= 3 ? 'טובה' : liquidityBufferMonths >= 1.5 ? 'סבירה' : 'נמוכה';

  const summaryLines = [
    `ציון FlowUp: ${metrics.score || 0}/100 | רמת סיכון: ${riskTier === 'Green' ? 'נמוכה' : riskTier === 'Orange' ? 'בינונית' : 'גבוהה'}`,
    `הכנסה ממוצעת: ₪${Math.round(income).toLocaleString('he-IL')} | הוצאות: ₪${Math.round(totalExpenses).toLocaleString('he-IL')} | שיעור חיסכון: ${savingsRate}%`,
    `יחס DTI: ${dti}% — ${dtiAssessment} | כרית נזילות: ${liquidityBufferMonths} חודשים — ${liquidityAssessment}`,
    `מגמת הכנסה: ${trendLabel}${stressPassed !== null ? ` | מבחני לחץ שעברו: ${stressPassed}/3` : ''}${confidence ? ` | רמת ביטחון: ${confidence}` : ''}`,
  ];

  return {
    metrics: {
      structural_dti: dti,
      adjusted_dti: adjustedDti,
      liquidity_buffer_months: liquidityBufferMonths,
      income_volatility: incomeVolatility,
    },
    risk_tier: riskTier,
    executive_summary: (metrics.recommendation && metrics.recommendation !== 'N/A') ? metrics.recommendation : summaryLines.join('\n'),
    recommended_loan_structure:
      riskTier === 'Green' ? 'Standard Amortizing (24–60 חודשים)' :
      riskTier === 'Orange' ? 'Extended (60–84 חודשים) — הקטנת נטל חודשי' :
      'זהירות — יש להתייעץ עם יועץ פיננסי',
    risk_flags: riskFlags,
  };
}

export default function Dashboard() {
  const [showUploader, setShowUploader] = useState(false);
  const [showOpenFinance, setShowOpenFinance] = useState(false);
  const [whatIfAmount, setWhatIfAmount] = useState(0);
  const [whatIfName, setWhatIfName] = useState('');
  const [localData, setLocalData] = useState(null);
  const [engineData, setEngineData] = useState(null);
  const [isStorageLoading, setIsStorageLoading] = useState(true);
  const [simulatedMetrics, setSimulatedMetrics] = useState(null);
  // True while processing /?of_callback=1 — shows an overlay so the UI doesn't feel frozen
  const [isProcessingCallback, setIsProcessingCallback] = useState(
    () => !!new URLSearchParams(window.location.search).get('of_callback')
  );
  
  // Fetch user data for Admin bypass (only when token exists to avoid 401 noise)
  const { data: user, isLoading: isUserLoading } = useQuery({
    queryKey: ['user', appParams.token ?? ''],
    queryFn: async () => {
      try {
        return await base44.auth.me();
      } catch (e) {
        if (e.response?.status === 401) return null;
        throw e;
      }
    },
    enabled: !!appParams.token,
    retry: (_, error) => error.response?.status !== 401,
  });

  const { sync, data: loanLogicData, isLoading: isSyncing, metrics: loanMetrics } = useTransactionSync();
  const { metrics: originalLoanMetrics, isLoading: isLoanMetricsLoading, error: loanMetricsError, refetch: refetchLoanMetrics } = useLoanMetrics(user?.email || user?.id);
  const newLoanMetrics = simulatedMetrics || originalLoanMetrics;
  const queryClient = useQueryClient();

  // Load from Local Storage on mount (skip when no token to avoid 500 in console)
  useEffect(() => {
    if (!appParams.token) {
      setIsStorageLoading(false);
      return;
    }
    const loadFromStorage = async () => {
      try {
        const res = await base44.functions.invoke('secureStorage', { action: 'load' });
        const data = res.data?.data;
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
        if (e.response?.status !== 500 && e.response?.status !== 405) {
          console.error("Failed to load local data", e);
        }
      } finally {
        setIsStorageLoading(false);
      }
    };
    loadFromStorage();
  }, [appParams.token]);

  const isAdmin = user?.role === 'admin';

  // Check for active Open Finance connection
  const { data: activeConnection, refetch: refetchConnection } = useQuery({
    queryKey: ['active-connection', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
        const conns = await base44.entities.OpenFinanceConnection.filter({ psu_id: user.id, status: 'ACTIVE' }, '-created_date', 1);
        return conns[0] || null;
    }
  });

  // Handle Open Finance OAuth Callback (user returns from bank consent)
  useEffect(() => {
    const handleCallback = async () => {
        const params = new URLSearchParams(window.location.search);
        const ofCallback = params.get('of_callback');

        if (!ofCallback) return;

        // Clean the URL immediately so a refresh doesn't re-trigger
        window.history.replaceState({}, document.title, window.location.pathname);

        const connectionId = localStorage.getItem('of_pending_connection');
        // psuId: prefer stored value (set during connect, works for unauthenticated users)
        const psuId = localStorage.getItem('of_psu_id') || user?.email || user?.id;

        if (!connectionId) {
            toast.error('Connection session expired. Please try connecting again.');
            setIsProcessingCallback(false);
            return;
        }

        toast.loading('בודק חיבור לבנק...', { id: 'of-toast' });

        // Poll connection status until ACTIVE/COMPLETED or an error state
        const READY_STATUSES = ['ACTIVE', 'COMPLETED', 'CONNECTED'];
        const ERROR_STATUSES = ['ERROR', 'FETCHING_ERROR', 'EXPIRED', 'REJECTED', 'REVOKED'];
        let connectionStatus = 'INACTIVE';
        let attempts = 0;
        const MAX_ATTEMPTS = 20; // 20 × 3 s = 60 s max polling

        while (
            !READY_STATUSES.includes(connectionStatus) &&
            !ERROR_STATUSES.includes(connectionStatus) &&
            attempts < MAX_ATTEMPTS
        ) {
            await new Promise(r => setTimeout(r, 3000));
            try {
                const { data: statusData } = await base44.functions.invoke('openFinanceAuth', {
                    action: 'check_status',
                    connectionId,
                    psuId
                });
                connectionStatus = statusData?.status || 'UNKNOWN';
            } catch (e) {
                console.error('Status check error:', e);
                break;
            }
            attempts++;
        }

        if (ERROR_STATUSES.includes(connectionStatus)) {
            toast.error(`חיבור לבנק נכשל (${connectionStatus}). אנא נסה שוב.`, { id: 'of-toast' });
            localStorage.removeItem('of_pending_connection');
            localStorage.removeItem('of_pending_provider');
            setIsProcessingCallback(false);
            return;
        }

        // Fetch real financial data via loanLogicV2
        try {
            toast.loading('מושך נתוני בנק...', { id: 'of-toast' });

            const response = await base44.functions.invoke('loanLogicV2', { userId: psuId });
            const data = response.data;

            if (!data?.success) throw new Error(data?.error || 'Failed to fetch bank data');

            const dashboardData = {
                transactions: data.transactions || [],
                snapshot: {
                    current_balance: data.metrics.liquidAssets,
                    total_income: data.metrics.totalIncome,
                    total_expenses: data.metrics.totalExpenses,
                    projected_eom_balance: data.metrics.netCashFlow,
                    risk_level: (data.status || 'GREEN').toLowerCase(),
                    risk_day: null,
                    avg_daily_spending: Math.round((data.metrics.totalExpenses || 0) / 30),
                    liquid_assets: data.metrics.liquidAssets
                },
                engineData: {
                    success: true,
                    riskStatus: data.status,
                    projectedEOM: data.metrics.netCashFlow,
                    metrics: data.metrics,
                    smartInsights: [],
                    connectionId
                },
                isSynced: true
            };

            localStorage.removeItem('of_pending_connection');
            localStorage.removeItem('of_pending_provider');
            toast.success('חשבון הבנק חובר בהצלחה!', { id: 'of-toast' });

            await handleDataParsed(dashboardData);
            await refetchConnection();
            refetchLoanMetrics(); // refresh useLoanMetrics with real data
            setIsProcessingCallback(false);

        } catch (err) {
            console.error('Callback data fetch error:', err);
            toast.error('שגיאה במשיכת נתוני הבנק: ' + err.message, { id: 'of-toast' });
            setIsProcessingCallback(false);
        }
    };

    // Fire immediately — psuId comes from localStorage, no auth needed
    handleCallback();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Fetch saved snapshot
  const { data: snapshots, isLoading: isSnapshotsLoading } = useQuery({
    queryKey: ['financial-snapshots'],
    queryFn: () => base44.entities.FinancialSnapshot.list('-upload_date', 1),
    initialData: []
  });

  const isLoading = isSnapshotsLoading || isUserLoading;

  // Fetch Shadow Realm entries (Secured Data)
  const { data: shadowEntries } = useQuery({
    queryKey: ['shadow-entries'],
    queryFn: () => base44.entities.ShadowRealmEntry.list('-transaction_date', 100),
    initialData: []
  });

  // Reconstruct transactions from Shadow Realm on the fly
  const transactions = React.useMemo(() => {
    const list = Array.isArray(shadowEntries) ? shadowEntries : [];
    return list.map(entry => FiscalAgent.recoverEntry(entry))
      .filter(t => !t.is_corrupted) // Filter out corrupted data
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [shadowEntries]);

  // Use local data if exists, otherwise use saved data. Admins get a blank slate bypass.
  const emptySnapshot = {
      current_balance: 0,
      total_income: 0,
      total_expenses: 0,
      projected_eom_balance: 0,
      risk_level: 'green',
      risk_day: null
  };
  const snapshot = localData?.snapshot || snapshots?.[0] || (isAdmin || newLoanMetrics ? emptySnapshot : undefined);
  const hasData = !!(snapshot && snapshot.current_balance !== undefined);

  // Fallback metrics from snapshot/CSV so AI insights can run when backend loan metrics are missing
  const metricsFromSnapshot = React.useMemo(() => {
    if (!snapshot || newLoanMetrics || (loanLogicData && loanMetrics)) return null;
    return {
      score: 0,
      status: snapshot.risk_level || 'green',
      totalIncome: snapshot.total_income ?? 0,
      totalExpenses: snapshot.total_expenses ?? 0,
      liquidAssets: snapshot.current_balance ?? 0,
      dti: 0,
      totalFixedExpenses: 0,
      totalLifestyleExpenses: snapshot.total_expenses ?? 0,
    };
  }, [snapshot, newLoanMetrics, loanLogicData, loanMetrics]);

  const metricsForInsights = newLoanMetrics || (loanLogicData ? loanMetrics : null) || metricsFromSnapshot;

  // Fetch AI Insights from server using React Query to avoid infinite loops
  const { data: serverInsightsData, isLoading: isInsightsLoading, error: insightsError } = useQuery({
    queryKey: ['ai-insights-v2', JSON.stringify(metricsForInsights)],
    queryFn: async () => {
        if (!metricsForInsights) return { error: "No risk metrics available" };
        // If insightEngine previously returned 500/405, skip the call to avoid console noise.
        // Flag is cleared automatically when the backend starts working again.
        const SKIP_KEY = 'insightEngine_skip';
        if (localStorage.getItem(SKIP_KEY)) {
            return generateLocalInsights(metricsForInsights) || { error: "Insights unavailable" };
        }
        try {
            const res = await base44.functions.invoke('insightEngine', { metrics: metricsForInsights });
            if (res.data?.success && res.data?.insights) {
                localStorage.removeItem(SKIP_KEY); // backend works — clear the flag
                return res.data.insights;
            }
            return generateLocalInsights(metricsForInsights) || { error: "Failed to generate insights" };
        } catch (e) {
            if (e.response?.status === 500 || e.response?.status === 405 || e.response?.status === 401) {
                localStorage.setItem(SKIP_KEY, '1');
                return generateLocalInsights(metricsForInsights) || { error: "Insights unavailable" };
            }
            throw e;
        }
    },
    enabled: !!(metricsForInsights && hasData),
    staleTime: 1000 * 60 * 60, // Cache for 1 hour to prevent re-fetching on focus
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });

  const serverInsights = serverInsightsData || (insightsError ? { error: "Network error" } : null);

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
      await base44.functions.invoke('secureStorage', { action: 'clear' });

      // Fetch all data (up to reasonable limits) to delete
      const allSnapshots = await base44.entities.FinancialSnapshot.list(null, 100);
      const allShadowEntries = await base44.entities.ShadowRealmEntry.list(null, 500);

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
      await batchDelete(allShadowEntries, base44.entities.ShadowRealmEntry);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['financial-snapshots']);
      queryClient.invalidateQueries(['shadow-entries']);
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
    await base44.functions.invoke('secureStorage', { action: 'save', data });

    // Clear previous DB data to prevent duplication (Batched to avoid rate limits)
    const allSnapshots = await base44.entities.FinancialSnapshot.list();
    const allShadowEntries = await base44.entities.ShadowRealmEntry.list();

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
    await batchProcess(allShadowEntries, 3, e => base44.entities.ShadowRealmEntry.delete(e.id));

    // Save to database
    await saveSnapshotMutation.mutateAsync(data.snapshot);
    
    // Process and Seal transactions into the Shadow Realm
    if (data.transactions.length > 0) {
      let shadowEntries = [];
      
      // Check if data is already sealed (from Open Finance Server)
      if (data.transactions[0].integrity_hash) {
          shadowEntries = data.transactions;
          
          // RECOVER FOR LOCAL DISPLAY
          // The server sent Sealed entries. We must unseal them for the UI using our Master Key.
          const recoveredTransactions = shadowEntries.map(entry => FiscalAgent.recoverEntry(entry));
          
          // Update local state with readable data
          const updatedData = { ...data, transactions: recoveredTransactions };
          setLocalData(updatedData);
          await base44.functions.invoke('secureStorage', { action: 'save', data: updatedData });
          
      } else {
          // CSV Upload (Raw Data) - Needs Sealing
          shadowEntries = data.transactions.slice(0, 100).map(t => {
              const rawTransaction = {
                  date: t.date instanceof Date ? t.date.toISOString().split('T')[0] : t.date,
                  description: t.description,
                  amount: (t.credit || 0) - (t.debit || 0), // Signed amount
                  category: (t.credit > 0) ? 'income' : 'expense'
              };
              // MILLENNIUM PROTOCOL: Encrypt & Seal
              return FiscalAgent.processTransaction(rawTransaction);
          });
      }

      // Save Shadow Entries to Database ONLY if not already synced by backend
      if (!data.isSynced) {
          await saveTransactionsMutation.mutateAsync(shadowEntries);
      } else {
          console.log("Skipping frontend save: Data already persisted by Open Finance Backend.");
      }
    }
    
    // Invalidate queries to refresh view
    queryClient.invalidateQueries(['financial-snapshots']);
    queryClient.invalidateQueries(['shadow-entries']);
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

  if (isStorageLoading || isProcessingCallback) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        {isProcessingCallback && (
          <div className="text-center">
            <p className="text-white font-medium">מחבר את חשבון הבנק...</p>
            <p className="text-slate-500 text-sm mt-1">בודק סטטוס חיבור ומושך נתונים</p>
          </div>
        )}
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
          
          <div className="flex items-center gap-2">
            {hasData && (
              <Button
                onClick={() => generateUnderwritingReport(metricsForInsights, serverInsights, user)}
                variant="outline"
                size="sm"
                className="bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/40 hover:text-white transition-all h-8 px-3 rounded-md"
              >
                <FileSpreadsheet className="w-3 h-3 ml-1.5" />
                <span className="text-[11px] font-medium">הפק דוח חיתום אשראי</span>
              </Button>
            )}
            <Button
              onClick={() => setShowOpenFinance(true)}
              variant="ghost"
              size="sm"
              className="bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/40 hover:text-white transition-all h-8 px-3 rounded-md"
            >
              <RefreshCw className={`w-3 h-3 ml-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="text-[11px] font-medium">חבר חשבון בנק</span>
            </Button>
            {hasData && (
              <Button
                onClick={() => deleteDataMutation.mutate()}
                variant="ghost"
                size="sm"
                className="text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-transparent hover:border-red-900/30 rounded-lg h-9 w-9 p-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 px-4 pb-8 md:px-8">
        <div className="max-w-6xl mx-auto">
          {/* System Calibration Error State */}
          {loanMetricsError && (
             <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
                <div className="p-4 bg-red-500/10 rounded-full">
                    <Cpu className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white">System Calibration Required</h3>
                <p className="text-slate-400 max-w-md">
                    The forecasting engine encountered an error while processing the simulation.
                </p>
                <Button 
                    onClick={refetchLoanMetrics}
                    className="bg-red-600 hover:bg-red-700 text-white"
                >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry Calibration
                </Button>
             </div>
          )}

          {/* Loading Skeleton */}
          {(!loanMetricsError && (isLoading || isLoanMetricsLoading)) ? (
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
                <div className="h-32 bg-slate-800/50 rounded-xl" />
                <div className="h-32 bg-slate-800/50 rounded-xl" />
                <div className="h-32 bg-slate-800/50 rounded-xl" />
                <div className="col-span-1 md:col-span-2 h-64 bg-slate-800/50 rounded-xl mt-6" />
                <div className="h-64 bg-slate-800/50 rounded-xl mt-6" />
             </div>
          ) : (!loanMetricsError && !hasData) ? (
            <EmptyState onDataParsed={handleDataParsed} onUploadCSV={() => setShowUploader(true)} />
          ) : (!loanMetricsError && (
            <>
              {/* Stats Row - Compact on Mobile */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 mb-4 md:mb-6">
                {/* Replaced Balance StatCard with LiquidAssetsCard */}
                <LiquidAssetsCard 
                    cash={newLoanMetrics?.liquidAssetsBreakdown?.cash ?? (loanLogicData ? loanMetrics?.liquidAssetsBreakdown?.cash : (snapshot.current_balance || 0))} 
                    etf={newLoanMetrics?.liquidAssetsBreakdown?.etf ?? (loanLogicData ? loanMetrics?.liquidAssetsBreakdown?.etf : 0)}
                    trainingFund={newLoanMetrics?.liquidAssetsBreakdown?.trainingFund ?? (loanLogicData ? loanMetrics?.liquidAssetsBreakdown?.trainingFund : 0)}
                />
                <StatCard
                  title={`ממוצע הכנסות (${newLoanMetrics?.history?.length || 6} חודשים)`}
                  value={`₪${Math.round(newLoanMetrics ? newLoanMetrics.totalIncome : (loanLogicData ? loanMetrics.totalIncome : (currentEngineData?.totalIncome ?? currentMonthStats?.income ?? snapshot.total_income ?? 0))).toLocaleString('he-IL')}`}
                  icon={TrendingUp}
                  color="green"
                  delay={0.1}
                  trend={newLoanMetrics?.trends?.income ? {
                      value: `${Math.abs(newLoanMetrics.trends.income).toFixed(1)}% ממוצע 3 חודשים`,
                      isPositive: newLoanMetrics.trends.income > 0
                  } : undefined}
                />
                <StatCard
                  title={`ממוצע הוצאות (${newLoanMetrics?.history?.length || 6} חודשים)`}
                  value={`₪${Math.round(newLoanMetrics ? newLoanMetrics.totalExpenses : (loanLogicData ? loanMetrics.totalExpenses : (currentEngineData?.totalExpenses ?? currentMonthStats?.expenses ?? snapshot.total_expenses ?? 0))).toLocaleString('he-IL')}`}
                  icon={TrendingDown}
                  color="red"
                  delay={0.2}
                  trend={newLoanMetrics?.trends?.expenses ? {
                      value: `${Math.abs(newLoanMetrics.trends.expenses).toFixed(1)}% ממוצע 3 חודשים`,
                      isPositive: newLoanMetrics.trends.expenses < 0
                  } : undefined}
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
                    projectedBalance={simulatedMetrics ? simulatedMetrics.score : (newLoanMetrics ? newLoanMetrics.score : (snapshot.projected_eom_balance || 0))}
                    dti={simulatedMetrics ? simulatedMetrics.dti : (newLoanMetrics ? newLoanMetrics.dti : 0)}
                    label={simulatedMetrics || newLoanMetrics ? "ציון חיתום (FLOWUP SCORE)" : "יתרה צפויה לסוף החודש"}
                    riskLevel={simulatedMetrics ? simulatedMetrics.status : (newLoanMetrics ? newLoanMetrics.status : (snapshot.risk_level || 'green'))}
                    riskDay={simulatedMetrics ? simulatedMetrics.riskDay : (newLoanMetrics ? newLoanMetrics.riskDay : null)}
                    whatIfAmount={whatIfAmount}
                    engineData={null}
                    isScore={!!(simulatedMetrics || newLoanMetrics)}
                    dtiTrend={newLoanMetrics?.trends?.dti ? {
                        value: `${Math.abs(newLoanMetrics.trends.dti).toFixed(1)}% מול ממוצע קודם`,
                        isPositive: newLoanMetrics.trends.dti < 0
                    } : undefined} 
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
                        fixedExpenses={newLoanMetrics ? (newLoanMetrics.totalFixedExpenses ?? newLoanMetrics.fixedExpenses ?? 0) : (currentEngineData?.expenseAnalysis?.fixed || 0)}
                        flexExpenses={newLoanMetrics ? (newLoanMetrics.totalLifestyleExpenses ?? newLoanMetrics.lifestyleExpenses ?? 0) : (currentEngineData?.expenseAnalysis?.flex || 0)}
                        taxRefundPotential={0}
                    />
                </motion.div>

                {/* InsightsAgent: Mobile 3, Desktop 3 (Bottom Left) */}
                <div className="order-3 lg:order-3 space-y-4">
                     <div className="h-auto">
                        <InsightsAgent analysis={serverInsights} isLoading={isInsightsLoading} />
                     </div>
                </div>

                {/* WhatIfSimulator: Mobile 4, Desktop 4 (Bottom Right) */}
                <div className="order-4 lg:order-4 h-auto">
                    <WhatIfSimulator
                        onSimulate={(metrics) => setSimulatedMetrics(metrics)}
                        baseMetrics={originalLoanMetrics}
                    />
                </div>
              </div>

              <Disclaimer />
            </>
          ))}
        </div>
      </main>



      {/* Upload/Connect Modal */}
      <AnimatePresence>
        {showUploader && (
          <CSVUploader
            onDataParsed={handleDataParsed}
            onClose={() => setShowUploader(false)}
          />
        )}
        {showOpenFinance && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowOpenFinance(false)}
          >
             <OpenFinanceConnect 
                inline={true} 
                onConnected={(data) => {
                    handleDataParsed(data);
                    setShowOpenFinance(false);
                }} 
             />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}