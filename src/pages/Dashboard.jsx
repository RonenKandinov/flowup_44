import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, TrendingDown, TrendingUp, Trash2, RefreshCw, Cpu, CheckCircle, Plus, FileSpreadsheet, ShieldAlert, Settings, Building2, Briefcase, Home as HomeIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calculateWhatIf, SystemInfo } from '../components/utils/forecastingLogic';
import { FiscalAgent } from '../components/protocol/core/fiscalAgent';

import SpeedometerGauge from '../components/dashboard/SpeedometerGauge';
import StatCard from '../components/dashboard/StatCard';
import LiquidAssetsCard from '../components/dashboard/LiquidAssetsCard'; // New Component
import DealRescuer from '../components/dashboard/DealRescuer';
import FutureCake from '../components/dashboard/FutureCake';
import InsightsAgent from '../components/dashboard/InsightsAgent'; // New
import EmptyState from '../components/dashboard/EmptyState';
import CustomerSwitcher from '../components/dashboard/CustomerSwitcher';
import Disclaimer from '../components/dashboard/Disclaimer';
import OpenFinanceConnect from '../components/connect/OpenFinanceConnect';
import CustomerGateModal from '../components/dashboard/CustomerGateModal';

import { useTransactionSync } from '../components/hooks/useTransactionSync';
import { useLoanMetrics } from '../components/hooks/useLoanMetrics';
import { useAnalysisPersistence } from '../components/hooks/useAnalysisPersistence';
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
  const incomeVolatility = Number(Math.abs(metrics.trends?.income || 0).toFixed(1));
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

  const executiveSummary = `הלקוח מציג ציון חיתום של ${metrics.score || 0}/100, המשקף רמת סיכון ${riskTier === 'Green' ? 'נמוכה' : riskTier === 'Orange' ? 'בינונית' : 'גבוהה'}. הכנסתו הממוצעת עומדת על ₪${Math.round(income).toLocaleString('he-IL')} מול הוצאות של ₪${Math.round(totalExpenses).toLocaleString('he-IL')}, מה שגוזר שיעור חיסכון של ${savingsRate}%. מבחינת כושר החזר, יחס ה-DTI עומד על ${dti}% (${dtiAssessment}), וכרית הנזילות מספיקה ל-${liquidityBufferMonths} חודשים (${liquidityAssessment}). לאור הנתונים, ${riskTier === 'Green' ? 'ניתן לאשר את הבקשה בתנאים רגילים.' : riskTier === 'Orange' ? 'מומלץ לשקול פריסה ארוכה יותר להקטנת ההחזר החודשי.' : 'נדרשת זהירות רבה ובחינה מעמיקה לפני אישור.'}`;

  return {
    metrics: {
      structural_dti: dti,
      adjusted_dti: adjustedDti,
      liquidity_buffer_months: liquidityBufferMonths,
      income_volatility: incomeVolatility,
    },
    risk_tier: riskTier,
    narrative: (metrics.recommendation && metrics.recommendation !== 'N/A') ? metrics.recommendation : executiveSummary,
    executive_summary: executiveSummary,
    recommended_loan_structure:
      riskTier === 'Green' ? 'Standard Amortizing (24–60 חודשים)' :
      riskTier === 'Orange' ? 'Extended (60–84 חודשים) — הקטנת נטל חודשי' :
      'זהירות — יש להתייעץ עם יועץ פיננסי',
    risk_flags: riskFlags,
    behavioral_classification: riskTier === 'Green' ? 'Stable' : riskTier === 'Red' ? 'High Risk' : 'Stable',
    classification_reason: "הערכה מקומית מבוססת על מדדים סטטיים בלבד (ללא ניתוח AI).",
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [showOpenFinance, setShowOpenFinance] = useState(false);
  const [showCustomerGate, setShowCustomerGate] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [activeCustomerId, setActiveCustomerId] = useState(() => {
    try { return localStorage.getItem('flowup_active_customer_id') || ''; } catch { return ''; }
  });
  const [activeCustomerName, setActiveCustomerName] = useState(() => {
    try { return localStorage.getItem('flowup_active_customer_name') || ''; } catch { return ''; }
  });
  const [whatIfAmount, setWhatIfAmount] = useState(0);
  const [whatIfName, setWhatIfName] = useState('');
  const [localData, setLocalData] = useState(null);
  const [engineData, setEngineData] = useState(null);
  const [isStorageLoading, setIsStorageLoading] = useState(true);
  const [simulatedMetrics, setSimulatedMetrics] = useState(null);
  // Holds the latest Deal Rescuer output so the autosave hook can persist
  // the full analysis bundle (insights + rescue + justifications) in one record.
  const [rescueBundle, setRescueBundle] = useState(null);
  const [savedAnalysisId, setSavedAnalysisId] = useState(null);
  // True while processing /?of_callback=1 — shows an overlay so the UI doesn't feel frozen
  const [isProcessingCallback, setIsProcessingCallback] = useState(
    () => !!new URLSearchParams(window.location.search).get('of_callback')
  );
  const [targetAccountId, setTargetAccountId] = useState(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('accountId');
      if (fromUrl) return fromUrl;
      return localStorage.getItem('flowup_selected_account_id') || '';
    } catch { return ''; }
  });

  // Persist selected account in BOTH the URL (for deep-linking) AND localStorage
  // (so it survives navigation to B2B Suite even when the <Link> drops the query).
  // Single source of truth = localStorage; URL is just a mirror.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (targetAccountId && targetAccountId !== 'all') {
        url.searchParams.set('accountId', targetAccountId);
        localStorage.setItem('flowup_selected_account_id', targetAccountId);
      } else {
        url.searchParams.delete('accountId');
        localStorage.removeItem('flowup_selected_account_id');
      }
      window.history.replaceState({}, '', url.toString());
      // Notify any mounted hook (B2B Suite tabs may already be in memory in some flows)
      window.dispatchEvent(new Event('flowup:account-changed'));
    } catch { /* no-op */ }
  }, [targetAccountId]);
  
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
  // Analyst dashboard should load underwriting data only for an explicitly active customer.
  const effectiveUserId = activeCustomerId || '';
  const { metrics: originalLoanMetrics, isLoading: isLoanMetricsLoading, error: loanMetricsError, noData: loanMetricsNoData, refetch: refetchLoanMetrics } = useLoanMetrics(effectiveUserId, targetAccountId || null);
  const newLoanMetrics = simulatedMetrics || originalLoanMetrics;
  const queryClient = useQueryClient();

  // Self-heal stale account selection: if we requested a specific account but the
  // engine fell back (e.g. that account belonged to a previous customer), sync the
  // UI to the account the engine actually used so we stop re-sending the stale id.
  useEffect(() => {
    const resolved = originalLoanMetrics?.activeTargetAccountId;
    if (resolved && targetAccountId && targetAccountId !== 'all' && resolved !== targetAccountId) {
      const stillValid = originalLoanMetrics?.availableAccounts?.some(a => a.id === targetAccountId);
      if (!stillValid) setTargetAccountId('');
    }
  }, [originalLoanMetrics, targetAccountId]);

  // Load from Local Storage on mount (skip when no token to avoid 500 in console)
  useEffect(() => {
    if (!appParams.token) {
      setIsStorageLoading(false);
      return;
    }
    const loadFromStorage = async () => {
      try {
        const res = await base44.functions.invoke('systemUtils', { service: 'storage', action: 'load' });
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
  const isNationalId = (value) => /^[0-9]{9}$/.test(String(value || '').trim());

  // Check for active Open Finance connection
  const { data: activeConnection, refetch: refetchConnection } = useQuery({
    queryKey: ['active-connection', effectiveUserId],
    enabled: !!effectiveUserId,
    queryFn: async () => {
        const conns = await base44.entities.OpenFinanceConnection.filter({ psu_id: effectiveUserId }, '-created_date', 10);
        return conns.find(conn => ['ACTIVE', 'CONNECTED', 'COMPLETED', 'PENDING'].includes(conn.status)) || conns[0] || null;
    }
  });

  const { data: activeCustomerSession } = useQuery({
    queryKey: ['active-customer-session', activeCustomerId],
    enabled: !!activeCustomerId,
    queryFn: async () => {
      if (isNationalId(activeCustomerId)) {
        // A national-id active context is a self-connected account (e.g. the analyst's
        // own account). Only attach a matching session — NEVER fall back to another
        // customer's "latest completed" session, which would hijack the active context
        // and bounce the view back to the empty/wrong state.
        const sessions = await base44.entities.CustomerOnboardingSession.filter({ customer_id: activeCustomerId }, '-created_date', 1);
        return sessions[0] || null;
      }

      const bySessionId = await base44.entities.CustomerOnboardingSession.filter({ id: activeCustomerId }, '-created_date', 1);
      if (bySessionId[0]) return bySessionId[0];

      const latestCompleted = await base44.entities.CustomerOnboardingSession.filter({ status: 'completed' }, '-updated_date', 1);
      return latestCompleted[0] || null;
    }
  });

  useEffect(() => {
    if (!activeCustomerSession) return;

    if (activeCustomerSession.customer_id && activeCustomerSession.customer_id !== activeCustomerId) {
      setActiveCustomerId(activeCustomerSession.customer_id);
      try { localStorage.setItem('flowup_active_customer_id', activeCustomerSession.customer_id); } catch (_) {}
    }

    if (activeCustomerSession.customer_name) {
      setActiveCustomerName(activeCustomerSession.customer_name);
      try { localStorage.setItem('flowup_active_customer_name', activeCustomerSession.customer_name); } catch (_) {}
    }
  }, [activeCustomerSession, activeCustomerId]);

  // Handle Open Finance OAuth Callback (user returns from bank consent)
  useEffect(() => {
    const handleCallback = async () => {
        const params = new URLSearchParams(window.location.search);
        const ofCallback = params.get('of_callback');

        if (!ofCallback) return;

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
            // Clean the URL on error
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }

        // Clean the URL once the connection is active
        window.history.replaceState({}, document.title, window.location.pathname);

        // Fetch real financial data via loanLogicV2
        try {
            toast.loading('מושך נתוני בנק...', { id: 'of-toast' });

            const response = await base44.functions.invoke('loanLogicV2', { 
                userId: psuId,
                targetAccountId: targetAccountId || null 
            });
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

            // Persist the just-connected account as the active context so a page
            // refresh restores its view instead of falling back to the empty screen.
            if (psuId) {
              setActiveCustomerId(psuId);
              try { localStorage.setItem('flowup_active_customer_id', psuId); } catch (_) {}
            }

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

  const isLoading = isSnapshotsLoading || isUserLoading || isStorageLoading;

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
  const metricsSnapshot = newLoanMetrics ? {
      current_balance: newLoanMetrics.liquidAssets || 0,
      total_income: newLoanMetrics.totalIncome || 0,
      total_expenses: newLoanMetrics.totalExpenses || 0,
      projected_eom_balance: (newLoanMetrics.totalIncome || 0) - (newLoanMetrics.totalExpenses || 0),
      risk_level: String(newLoanMetrics.status || 'green').toLowerCase(),
      risk_day: newLoanMetrics.riskDay || null,
      avg_daily_spending: Math.round((newLoanMetrics.totalExpenses || 0) / 30)
  } : undefined;
  const snapshot = activeCustomerId ? (localData?.snapshot || metricsSnapshot || snapshots?.[0]) : null;
  const hasData = !!snapshot;

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

  const metricsForInsights = originalLoanMetrics || (loanLogicData ? loanMetrics : null) || metricsFromSnapshot;

  // Generate a stable hash of the metrics to prevent unnecessary AI re-renders
  const stableMetricsHash = React.useMemo(() => {
    if (!metricsForInsights) return '';
    const stable = {
      score: metricsForInsights.score,
      status: metricsForInsights.status,
      totalIncome: Math.round(metricsForInsights.totalIncome || 0),
      totalExpenses: Math.round(metricsForInsights.totalExpenses || 0),
      liquidAssets: Math.round(metricsForInsights.liquidAssets || 0),
      dti: Math.round(metricsForInsights.dti || 0),
      investmentOutflow: Math.round(metricsForInsights.behaviorProfile?.investmentDiscipline?.avgMonthlyInvestmentOutflow || 0),
      pledgeableValue: Math.round(metricsForInsights.behaviorProfile?.totalPledgeableValue || 0),
      existingLoans: Math.round(metricsForInsights.behaviorProfile?.existingLoansMonthlyTotal || 0),
      // Forensic signals — ensure the AI Analyst re-runs when these surface/change
      sideIncome: Math.round(metricsForInsights.forensicIntelligence?.sideIncome?.monthlyTotal || 0),
      activityDecline: metricsForInsights.forensicIntelligence?.activityDecline?.incomeDropPct || 0,
      earlyDistress: metricsForInsights.forensicIntelligence?.earlyDistress?.flags?.length || 0,
      declarationGap: metricsForInsights.forensicIntelligence?.declarationGap?.gapPct || 0,
      // Positive + advanced signals — re-run the AI Analyst when they surface/change
      opportunityScore: metricsForInsights.positiveSignals?.opportunityScore || 0,
      surplus: metricsForInsights.positiveSignals?.surplusCreation?.monthlySurplus || 0,
      upwardMobility: metricsForInsights.positiveSignals?.upwardMobility?.growthPct || 0,
      cashDependency: metricsForInsights.advancedSignals?.cashDependency?.cashShare || 0,
      seasonality: metricsForInsights.advancedSignals?.seasonality?.detected ? 1 : 0,
      lifestyleInflation: metricsForInsights.advancedSignals?.lifestyleInflation?.detected ? 1 : 0,
    };
    return JSON.stringify(stable);
  }, [metricsForInsights]);

  // Fetch AI Insights from server in TWO PHASES so the decision/metrics render
  // immediately while the LLM narrative streams in asynchronously behind it.
  // Phase 1 — deferNarrative:true — skips the LLM call entirely (instant).
  const { data: phase1Data, isLoading: isPhase1Loading } = useQuery({
    queryKey: ['ai-insights-phase1', stableMetricsHash],
    queryFn: async () => {
        if (!metricsForInsights) return { error: "No risk metrics available" };
        try {
            const res = await base44.functions.invoke('insightEngine', {
                metrics: metricsForInsights,
                behaviorProfile: metricsForInsights?.behaviorProfile || null,
                deferNarrative: true
            });
            if (res.data?.success && res.data?.insights) {
                return res.data.insights;
            }
            return generateLocalInsights(metricsForInsights) || { error: "Failed to generate insights" };
        } catch (e) {
            console.error("insightEngine phase1 failed, using local insights", e);
            return generateLocalInsights(metricsForInsights) || { error: "Insights unavailable" };
        }
    },
    enabled: !!(metricsForInsights && hasData),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  // Phase 2 — full LLM narrative. Runs in parallel with phase 1; the UI shows a
  // skeleton for the narrative-dependent sections until this resolves.
  const { data: phase2Data, isLoading: isPhase2Loading, error: insightsError } = useQuery({
    queryKey: ['ai-insights-phase2', stableMetricsHash],
    queryFn: async () => {
        if (!metricsForInsights) return { error: "No risk metrics available" };

        // Never use persistent client cache for underwriting insights.
        // Per FlowUp's B2B decisioning contract, the UI must reflect the latest insightEngine output.
        try {
            Object.keys(localStorage)
              .filter(k => k.startsWith('flowup_ai_insights_cache'))
              .forEach(k => localStorage.removeItem(k));
        } catch (_) {}

        try {
            const res = await base44.functions.invoke('insightEngine', {
                metrics: metricsForInsights,
                behaviorProfile: metricsForInsights?.behaviorProfile || null
            });
            if (res.data?.success && res.data?.insights) {
                return res.data.insights;
            }
            return generateLocalInsights(metricsForInsights) || { error: "Failed to generate insights" };
        } catch (e) {
            console.error("insightEngine failed, using local insights", e);
            return generateLocalInsights(metricsForInsights) || { error: "Insights unavailable" };
        }
    },
    enabled: !!(metricsForInsights && hasData),
    // Stable per customer/metrics: once the analysis is fetched for a given
    // stableMetricsHash, keep it. Re-runs only when the underlying metrics change
    // (e.g. switching customer/account) — never on window focus or remount.
    // This stops the AI Analyst narrative from changing every few minutes.
    staleTime: Infinity,
    gcTime: Infinity,
    cacheTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  // Phase "fast summary" — a lightweight LLM call that returns ONLY the executive summary
  // (skips the heavy lender-risk/behavior schema phase 2 has to generate), so the
  // Executive Summary text can render seconds before the full narrative is ready.
  const { data: summaryPhaseNarrative, isLoading: isSummaryPhaseLoading } = useQuery({
    queryKey: ['ai-insights-summary', stableMetricsHash],
    queryFn: async () => {
        if (!metricsForInsights) return null;
        try {
            const res = await base44.functions.invoke('insightEngine', {
                metrics: metricsForInsights,
                behaviorProfile: metricsForInsights?.behaviorProfile || null,
                summaryOnly: true
            });
            return res.data?.success ? (res.data?.insights?.narrative || null) : null;
        } catch (e) {
            console.error("insightEngine summaryOnly failed", e);
            return null;
        }
    },
    enabled: !!(metricsForInsights && hasData),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  // Phase 2 (full narrative) wins once ready; phase 1 (instant decision/metrics) fills the gap.
  const serverInsights = phase2Data || phase1Data || (insightsError ? { error: "Network error" } : null);
  const isInsightsLoading = isPhase1Loading || isPhase2Loading;
  // True only while phase 1 hasn't returned anything yet — drives the full-panel spinner.
  const isAnalystInitialLoading = !serverInsights && isInsightsLoading;
  // True while phase 2 (LLM narrative) is still in flight — drives Lender Risk / Behavior
  // Analysis skeletons (those sections only exist once the full narrative arrives).
  const isNarrativeLoading = !phase2Data && isPhase2Loading;
  // Executive Summary has its OWN loading gate — it's ready as soon as EITHER the fast
  // summary call or the full phase 2 call resolves, whichever comes first.
  const fastNarrative = phase2Data?.narrative || summaryPhaseNarrative || null;
  const isSummaryLoading = !fastNarrative && (isSummaryPhaseLoading || isPhase2Loading);
  const displayedInsights = serverInsights
    ? { ...serverInsights, narrative: fastNarrative || serverInsights.narrative }
    : serverInsights;

  // ── Autosave underwriting analysis to UnderwritingAnalysis entity ──
  // Hybrid privacy model: structured intelligence plaintext, narrative encrypted.
  // Triggered automatically whenever insights + loanMetrics are ready, and re-runs
  // (with dedupe by analysis_hash on the server) when rescue/justifications arrive.
  useAnalysisPersistence({
    insights: phase2Data,
    loanMetrics: originalLoanMetrics,
    rescueResult: rescueBundle?.rescueResult || null,
    creditJustifications: rescueBundle?.creditJustifications || [],
    snapshotId: snapshots?.[0]?.id || null,
    connectionId: activeConnection?.connection_id || null,
    enabled: !!(phase2Data && !phase2Data.error && originalLoanMetrics && hasData),
    onSaved: (saved) => setSavedAnalysisId(saved.id)
  });



  // ── Cash-Flow Intelligence: granular OpenFinance-based repayment capacity ──
  // Fetched once when we have an active connection; cached indefinitely (recurring
  // patterns don't change frequently). Powers the DealRescuer's realRepaymentCapacity.
  const { data: cashFlowProfile } = useQuery({
    queryKey: ['cash-flow-profile-v1', activeConnection?.connection_id || 'none'],
    queryFn: async () => {
      try {
        const res = await base44.functions.invoke('cashFlowIntelligence', {});
        return res.data?.cashFlowProfile || null;
      } catch (e) {
        // Non-blocking: dealRescuer falls back to the legacy heuristic when this is null
        console.warn('cashFlowIntelligence unavailable:', e?.message);
        return null;
      }
    },
    enabled: !!activeConnection?.connection_id,
    staleTime: 0,
    gcTime: 0,
    cacheTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

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
      await base44.functions.invoke('systemUtils', { service: 'storage', action: 'clear' });

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
    await base44.functions.invoke('systemUtils', { service: 'storage', action: 'save', data });

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
          await base44.functions.invoke('systemUtils', { service: 'storage', action: 'save', data: updatedData });
          
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

  const clearCustomerViewState = () => {
    setLocalData(null);
    setEngineData(null);
    setSimulatedMetrics(null);
    setRescueBundle(null);
    setSavedAnalysisId(null);
    setTargetAccountId('');
    try {
      localStorage.removeItem('flowup_selected_account_id');
      Object.keys(sessionStorage).filter(k => k.startsWith('loanMetricsCache')).forEach(k => sessionStorage.removeItem(k));
    } catch (_) {}
    queryClient.removeQueries({ queryKey: ['ai-insights-phase1'] });
    queryClient.removeQueries({ queryKey: ['ai-insights-phase2'] });
    queryClient.removeQueries({ queryKey: ['cash-flow-profile-v1'] });
    queryClient.removeQueries({ queryKey: ['financial-snapshots'] });
    queryClient.removeQueries({ queryKey: ['shadow-entries'] });
  };

  // Context switch: clear the previous customer's view and load the newly-verified customer.
  const handleCustomerActivated = (customer) => {
    const customerId = typeof customer === 'string' ? customer : customer?.customer_id;
    const customerName = typeof customer === 'string' ? '' : (customer?.customer_name || '');
    clearCustomerViewState();
    // Drop any stale account selection from the URL — it may belong to the previous customer.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('accountId');
      window.history.replaceState({}, '', url.toString());
    } catch (_) {}
    setActiveCustomerId(customerId || '');
    setActiveCustomerName(customerName);
    try {
      localStorage.setItem('flowup_active_customer_id', customerId || '');
      if (customerName) localStorage.setItem('flowup_active_customer_name', customerName);
    } catch (_) {}
    setShowCustomerGate(false);
  };

  const resetAnalystScreen = () => {
    clearCustomerViewState();
    setActiveCustomerId('');
    setActiveCustomerName('');
    setShowDisconnectConfirm(false);
    setShowOpenFinance(false);
    try {
      [
        'of_pending_connection',
        'of_pending_provider',
        'of_psu_id',
        'flowup_selected_account_id',
        'flowup_active_customer_id',
        'flowup_active_customer_name'
      ].forEach(k => localStorage.removeItem(k));
      Object.keys(sessionStorage).filter(k => k.startsWith('loanMetricsCache')).forEach(k => sessionStorage.removeItem(k));
    } catch (_) {}
    queryClient.clear();
    // Hard reload guarantees every cached query, in-flight request and component
    // state is fully reset — prevents the stale "active-customer-session" query
    // from re-hydrating activeCustomerId and bouncing back into the loading screen.
    window.location.replace('/Dashboard');
  };

  const handleAccountSelection = (value) => {
    if (value === 'disconnect') {
      handleRevokeConnection();
      return;
    }
    setTargetAccountId(value);
  };

  // Switch the active customer (single source of truth = OpenFinanceConnection.psu_id).
  // Resets the per-customer account filter so the new customer loads its own accounts.
  const handleCustomerSwitch = (psuId) => {
    if (!psuId || psuId === activeCustomerId) return;
    setActiveCustomerId(psuId);
    setActiveCustomerName('');
    setTargetAccountId('');
    try {
      localStorage.setItem('flowup_active_customer_id', psuId);
      localStorage.removeItem('flowup_active_customer_name');
      localStorage.removeItem('flowup_selected_account_id');
    } catch (_) {}
  };

  const handleRevokeConnection = async () => {
    const toastId = toast.loading('מנתק חשבון בנק...');
    const connectionId = activeConnection?.connection_id || currentEngineData?.connectionId || localStorage.getItem('of_pending_connection');
    const psuId = activeCustomerId || localStorage.getItem('flowup_active_customer_id') || localStorage.getItem('of_psu_id') || effectiveUserId;

    try {
      if (connectionId || psuId) {
        await base44.functions.invoke('openFinanceAuth', {
          action: 'revoke',
          connectionId,
          psuId
        });
      }
      resetAnalystScreen();
      toast.success('חשבון הבנק נותק והמסך אופס', { id: toastId });
    } catch (error) {
      console.warn('Provider revoke failed, resetting analyst screen locally:', error?.message || error);
      resetAnalystScreen();
      toast.success('המסך אופס והלקוח נותק מהתצוגה', { id: toastId });
    }
  };

  if (isProcessingCallback) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-white font-medium">מחבר את חשבון הבנק...</p>
          <p className="text-slate-500 text-sm mt-1">בודק סטטוס חיבור ומושך נתונים</p>
        </div>
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
      {/* Ambient glow accents */}
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 px-6 py-8 md:px-12 lg:px-16">
        <div className="max-w-7xl mx-auto flex flex-col items-stretch border-b border-slate-800/60 pb-8 gap-6">
          <div className="text-right">
            <h1 className="text-4xl font-bold text-white tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              FlowUp
            </h1>
            <p className="text-slate-500 text-xs mt-2 tracking-[0.2em] uppercase">FutureFlow Dashboard</p>
            {activeCustomerId && (
              <span className="inline-block mt-2 text-[11px] font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-3 py-0.5">
                לקוח פעיל: {activeCustomerId}
              </span>
            )}
          </div>
          
          <div dir="rtl" className="w-full flex items-center justify-end gap-3 flex-wrap">
            <div dir="rtl" className="flex items-center gap-3 flex-wrap justify-end">
            <CustomerSwitcher activeCustomerId={activeCustomerId} onSelect={handleCustomerSwitch} />
            {activeCustomerId && originalLoanMetrics?.availableAccounts?.length > 0 && (
              <div className="w-56">
                <Select value={targetAccountId || originalLoanMetrics.activeTargetAccountId || ''} onValueChange={handleAccountSelection}>
                  <SelectTrigger className="h-9 bg-slate-800/60 border-slate-700/60 text-xs backdrop-blur-sm">
                    <SelectValue placeholder="בחר חשבון" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל החשבונות</SelectItem>
                    {originalLoanMetrics.availableAccounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} ({acc.number ? acc.number.slice(-4) : '****'})
                      </SelectItem>
                    ))}
                    <SelectItem value="disconnect" className="text-red-600 focus:text-red-700 font-semibold">
                      נתק חשבון בנק
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              onClick={() => setShowCustomerGate(true)}
              variant="ghost"
              size="sm"
              className="bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/40 hover:text-white hover:border-blue-400/60 transition-all h-8 px-3 rounded-md shadow-sm shadow-blue-500/10"
            >
              <Plus className="w-3 h-3 ml-1.5" />
              <span className="text-[11px] font-medium">{activeCustomerId ? 'החלף לקוח' : 'חבר לקוח'}</span>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-600/40 hover:text-white hover:border-cyan-400/60 transition-all h-8 px-3 rounded-md shadow-sm shadow-cyan-500/10"
            >
              <Link to={targetAccountId && targetAccountId !== 'all' ? `/B2BSuite?accountId=${targetAccountId}` : '/B2BSuite'}>
                <Briefcase className="w-3 h-3 ml-1.5" />
                <span className="text-[11px] font-medium">B2B Suite</span>
              </Link>
            </Button>
              <DropdownMenu dir="rtl">
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-slate-800/60 border border-slate-700/60 text-slate-300 hover:bg-slate-700 hover:text-white transition-all h-8 px-3 rounded-md backdrop-blur-sm"
                  >
                    <Settings className="w-3 h-3 ml-1.5" />
                    <span className="text-[11px] font-medium">הגדרות מערכת</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-slate-900 border-slate-800 text-slate-200">
                  <DropdownMenuItem asChild className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 text-xs">
                    <Link to="/" className="flex items-center w-full">
                      <HomeIcon className="w-3 h-3 ml-2" />
                      דף הבית
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-800" />
                  <DropdownMenuItem asChild className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 text-xs">
                    <Link to="/UnderwritingSettings" className="flex items-center w-full">
                      <Settings className="w-3 h-3 ml-2" />
                      הגדרות חיתום
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 text-xs">
                      <Link to="/partners-admin" className="flex items-center w-full">
                        <Building2 className="w-3 h-3 ml-2" />
                        ניהול שותפי B2B
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-slate-800" />
                  <DropdownMenuItem asChild className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 text-xs">
                    <Link to="/partner-portal" className="flex items-center w-full">
                      <Building2 className="w-3 h-3 ml-2" />
                      פורטל שותף (ניהול לקוחות)
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 text-xs">
                    <Link to="/developers" className="flex items-center w-full">
                      <Cpu className="w-3 h-3 ml-2" />
                      פורטל מפתחים (API)
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 text-xs">
                    <Link to="/AuditLogs" className="flex items-center w-full">
                      <ShieldAlert className="w-3 h-3 ml-2" />
                      יומן אירועים
                    </Link>
                  </DropdownMenuItem>
                  {hasData && <DropdownMenuSeparator className="bg-slate-800" />}
                  {hasData && (
                    <DropdownMenuItem 
                      className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 text-xs"
                      disabled={isLoanMetricsLoading || isInsightsLoading}
                      onSelect={(e) => {
                        // Prevent the dropdown from closing immediately so the spinner stays visible
                        e.preventDefault();
                        // Hard-bust ALL client caches (loanMetricsCache + ai-insights) and force a fresh
                        // fetch — then await it so the spinner reflects real loading time.
                        (async () => {
                          const toastId = toast.loading('מרענן נתונים מהבנק...');
                          try {
                            try {
                              ['flowup_ai_insights_cache_v2', 'flowup_ai_insights_cache_v3', 'flowup_ai_insights_cache_v4', 'flowup_ai_insights_cache_v5', 'flowup_ai_insights_cache_v6', 'flowup_ai_insights_cache_v7']
                                .forEach(k => localStorage.removeItem(k));
                              Object.keys(sessionStorage)
                                .filter(k => k.startsWith('loanMetricsCache'))
                                .forEach(k => sessionStorage.removeItem(k));
                            } catch (_) {}
                            queryClient.removeQueries({ queryKey: ['ai-insights-phase1'] });
                            queryClient.removeQueries({ queryKey: ['ai-insights-phase2'] });
                            queryClient.removeQueries({ queryKey: ['cash-flow-profile-v1'] });
                            // Await the actual refresh — this triggers loanLogicV2 → new behaviorProfile → fresh insightEngine result
                            await refetchLoanMetrics();
                            await queryClient.refetchQueries({ queryKey: ['ai-insights-phase1'], type: 'active' });
                            await queryClient.refetchQueries({ queryKey: ['ai-insights-phase2'], type: 'active' });
                            toast.success('הנתונים עודכנו בהצלחה', { id: toastId });
                          } catch (err) {
                            console.error('Refresh failed:', err);
                            toast.error('רענון הנתונים נכשל — נסה שוב', { id: toastId });
                          }
                        })();
                      }}
                    >
                      <RefreshCw className={`w-3 h-3 ml-2 ${(isLoanMetricsLoading || isInsightsLoading) ? 'animate-spin' : ''}`} />
                      רענן נתונים
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 px-6 pb-16 md:px-12 lg:px-16 pt-4">
        <div className="max-w-7xl mx-auto">
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
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
                <div className="h-36 bg-slate-800/50 rounded-2xl" />
                <div className="h-36 bg-slate-800/50 rounded-2xl" />
                <div className="h-36 bg-slate-800/50 rounded-2xl" />
                <div className="col-span-1 md:col-span-2 h-72 bg-slate-800/50 rounded-2xl mt-8" />
                <div className="h-72 bg-slate-800/50 rounded-2xl mt-8" />
             </div>
          ) : (!loanMetricsError && !hasData && !activeCustomerId) ? (
            <EmptyState onDataParsed={handleDataParsed} />
          ) : (!loanMetricsError && !hasData && activeCustomerId) ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
              {loanMetricsNoData ? (
                <>
                  <div className="p-4 bg-amber-500/10 rounded-full">
                    <ShieldAlert className="w-8 h-8 text-amber-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">אין נתוני Open Finance ללקוח {activeCustomerId}</h3>
                  <p className="text-slate-400 max-w-md">
                    החיבור הבנקאי של הלקוח אינו פעיל — ככל הנראה ההסכמה (Consent) פגה או שהחיבור לא הושלם.
                    יש לשלוח ללקוח קישור חיבור חדש, או לעבור ללקוח אחר.
                  </p>
                  <div className="flex items-center gap-3">
                    <Button onClick={() => setShowCustomerGate(true)} className="bg-blue-600 hover:bg-blue-500 text-white">
                      <Plus className="w-4 h-4 ml-2" />
                      חבר לקוח מחדש
                    </Button>
                    <Button onClick={resetAnalystScreen} variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                      <Trash2 className="w-4 h-4 ml-2" />
                      נתק לקוח
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                  <h3 className="text-xl font-bold text-white">טוען נתוני לקוח מחובר...</h3>
                  <p className="text-slate-400 max-w-md">החשבון כבר מחובר. אנחנו מושכים את נתוני Open Finance ומכינים את תצוגת החיתום.</p>
                  <div className="flex items-center gap-3">
                    <Button onClick={refetchLoanMetrics} className="bg-cyan-600 hover:bg-cyan-500 text-white">
                      <RefreshCw className="w-4 h-4 ml-2" />
                      טען נתונים מחדש
                    </Button>
                    <Button onClick={resetAnalystScreen} variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                      <Trash2 className="w-4 h-4 ml-2" />
                      נתק לקוח
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (!loanMetricsError && (
            <>
              {/* Stats Row — generous spacing on all breakpoints */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-10 md:mb-12 items-stretch">
                {/* Replaced Balance StatCard with LiquidAssetsCard */}
                <LiquidAssetsCard 
                    cash={newLoanMetrics?.liquidAssetsBreakdown?.cash ?? (loanLogicData ? loanMetrics?.liquidAssetsBreakdown?.cash : (snapshot.current_balance || 0))} 
                    etf={newLoanMetrics?.liquidAssetsBreakdown?.etf ?? (loanLogicData ? loanMetrics?.liquidAssetsBreakdown?.etf : 0)}
                    trainingFund={newLoanMetrics?.liquidAssetsBreakdown?.trainingFund ?? (loanLogicData ? loanMetrics?.liquidAssetsBreakdown?.trainingFund : 0)}
                />
                <StatCard
                  title="ממוצע הכנסות (12 חודשים)"
                  value={`₪${Math.round(newLoanMetrics ? newLoanMetrics.totalIncome : (loanLogicData ? loanMetrics.totalIncome : (currentEngineData?.totalIncome ?? currentMonthStats?.income ?? snapshot.total_income ?? 0))).toLocaleString('he-IL')}`}
                  icon={TrendingUp}
                  color="green"
                  delay={0.1}
                  trend={newLoanMetrics?.trends?.income}
                />
                <StatCard
                  title="ממוצע הוצאות (12 חודשים)"
                  value={`₪${Math.round(newLoanMetrics ? newLoanMetrics.totalExpenses : (loanLogicData ? loanMetrics.totalExpenses : (currentEngineData?.totalExpenses ?? currentMonthStats?.expenses ?? snapshot.total_expenses ?? 0))).toLocaleString('he-IL')}`}
                  icon={TrendingDown}
                  color="red"
                  delay={0.2}
                  trend={newLoanMetrics?.trends?.expenses}
                />
              </div>

              {/* Main Dashboard Grid — more breathing room between panels */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-stretch">
                {/* Speedometer: Mobile 1, Desktop 1 (Top Left) */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="order-1 lg:order-1 relative rounded-xl p-0 border-none bg-transparent flex flex-col items-center h-full min-h-[240px]"
                >
                  <SpeedometerGauge
                    projectedBalance={simulatedMetrics
                        ? Math.max(simulatedMetrics.score, originalLoanMetrics?.score ?? 0)
                        : (newLoanMetrics ? newLoanMetrics.score : (snapshot.projected_eom_balance || 0))}
                    dti={simulatedMetrics ? simulatedMetrics.dsr : (newLoanMetrics ? newLoanMetrics.dti : 0)}
                    label={simulatedMetrics ? "ציון חיתום — לאחר חילוץ" : (newLoanMetrics ? "ציון חיתום (FlowUp Score)" : "יתרה צפויה לסוף החודש")}
                    riskLevel={simulatedMetrics ? simulatedMetrics.status : (serverInsights?.risk_tier ? serverInsights.risk_tier.toUpperCase() : (newLoanMetrics ? newLoanMetrics.status : (snapshot.risk_level || 'green')))}
                    riskDay={simulatedMetrics ? simulatedMetrics.riskDay : (newLoanMetrics ? newLoanMetrics.riskDay : null)}
                    whatIfAmount={whatIfAmount}
                    engineData={null}
                    isScore={!!(simulatedMetrics || newLoanMetrics)}
                    dtiTrend={simulatedMetrics ? null : newLoanMetrics?.trends?.dti}
                  />
                </motion.div>

                {/* Future Cake: Mobile 2, Desktop 2 (Top Right) */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="order-2 lg:order-2 relative rounded-xl p-0 border-none bg-transparent flex flex-col items-center h-full w-full"
                >
                    <FutureCake 
                        fixedExpenses={newLoanMetrics ? (newLoanMetrics.totalFixedExpenses ?? newLoanMetrics.fixedExpenses ?? 0) : (currentEngineData?.expenseAnalysis?.fixed || 0)}
                        flexExpenses={newLoanMetrics ? (newLoanMetrics.totalLifestyleExpenses ?? newLoanMetrics.lifestyleExpenses ?? 0) : (currentEngineData?.expenseAnalysis?.flex || 0)}
                        taxRefundPotential={0}
                    />
                </motion.div>

                {/* InsightsAgent: Mobile 3, Desktop 3 (Bottom Left) */}
                <div className="order-3 lg:order-3 h-full w-full">
                    <InsightsAgent
                        analysis={displayedInsights}
                        isLoading={isAnalystInitialLoading}
                        isNarrativeLoading={isNarrativeLoading}
                        isSummaryLoading={isSummaryLoading}
                        rescueOverlay={simulatedMetrics ? {
                            active: true,
                            score: simulatedMetrics.score,
                            dsr: simulatedMetrics.dsr,
                            status: simulatedMetrics.status
                        } : null}
                    />
                </div>

                {/* Deal Rescuer: Mobile 4, Desktop 4 (Bottom Right) */}
                <div className="order-4 lg:order-4 h-full w-full">
                    <DealRescuer
                        onSimulate={(metrics) => setSimulatedMetrics(metrics)}
                        onAnalysisComplete={(bundle) => setRescueBundle(bundle)}
                        baseMetrics={originalLoanMetrics}
                        analysisInsights={serverInsights?.analysisInsights || null}
                        cashFlowProfile={cashFlowProfile || null}
                    />
                </div>
              </div>

              <Disclaimer />
            </>
          ))}
        </div>
      </main>



      <AlertDialog open={showDisconnectConfirm} onOpenChange={setShowDisconnectConfirm}>
        <AlertDialogContent dir="rtl" className="bg-slate-950 border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>לנתק את חשבון הבנק?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              פעולה זו תנתק את החיבור ותנקה מהמערכת את החשבונות, התנועות ותמונת המצב ששויכו אליו. לא ניתן לבטל פעולה זו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-start">
            <AlertDialogCancel className="bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white">
              ביטול
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRevokeConnection} className="bg-red-600 hover:bg-red-700 text-white">
              כן, נתק חשבון
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Connect Modal */}
      <AnimatePresence>
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

      {/* Customer gate — dual-purpose: pick a new customer OR switch the active one */}
      <AnimatePresence>
        {showCustomerGate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowCustomerGate(false)}
          >
            <CustomerGateModal
              onClose={() => setShowCustomerGate(false)}
              onCustomerActivated={handleCustomerActivated}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}