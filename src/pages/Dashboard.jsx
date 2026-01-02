import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, TrendingDown, TrendingUp, Trash2, RefreshCw, Cpu, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calculateWhatIf, SystemInfo } from '../components/utils/forecastingLogic';

// ייבוא כל הרכיבים
import SpeedometerGauge from '../components/dashboard/SpeedometerGauge';
import StatCard from '../components/dashboard/StatCard';
import RiskZoneChart from '../components/dashboard/RiskZoneChart';
import WhatIfSimulator from '../components/dashboard/WhatIfSimulator';
import LeverageCard from '../components/dashboard/LeverageCard';
import CSVUploader from '../components/upload/CSVUploader';
import EmptyState from '../components/dashboard/EmptyState';
import Disclaimer from '../components/dashboard/Disclaimer';

export default function Dashboard() {
  const [showUploader, setShowUploader] = useState(false);
  const [whatIfAmount, setWhatIfAmount] = useState(0);
  const [localData, setLocalData] = useState(null);
  const [engineData, setEngineData] = useState(null);
  
  const queryClient = useQueryClient();

  // 1. שליפת נתונים מהשרת
  const { data: snapshots, isLoading } = useQuery({
    queryKey: ['financial-snapshots'],
    queryFn: () => base44.entities.FinancialSnapshot.list('-upload_date', 1),
    initialData: []
  });

  const { data: transactions } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-date', 90),
    initialData: []
  });

  // 2. הלב הפועם: בחירה חכמה בין נתוני שרת לנתוני סימולציה (מנוע היברידי)
  const activeSnapshot = localData?.snapshot || snapshots?.[0] || {};
  const activeEngineData = localData?.engineData || engineData;
  // חיבור הגרף לנתונים החיים מהסימולטור או מההיסטוריה
  const activeForecastData = localData?.forecastData || activeEngineData?.graphPoints || [];

  const saveSnapshotMutation = useMutation({
    mutationFn: (data) => base44.entities.FinancialSnapshot.create(data),
    onSuccess: () => queryClient.invalidateQueries(['financial-snapshots'])
  });

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
    await saveSnapshotMutation.mutateAsync(data.snapshot);
  };

  const handleWhatIfSimulate = (scenario) => {
    if (scenario.type === 'reset') {
      setWhatIfAmount(0);
      setLocalData(null); // חזרה למצב מקורי
      return;
    }

    setWhatIfAmount(scenario.amount || 0);
    const dataToUse = localData?.engineData || engineData;
    
    if (dataToUse) {
      // הרצת המנוע ההיברידי (SES + SARIMAX Logic)
      const result = calculateWhatIf(dataToUse, scenario);
      
      // עדכון ה-State המרכזי שמשפיע על כל הרכיבים
      setLocalData({
        snapshot: {
          ...activeSnapshot,
          projected_eom_balance: result.projectedEOM, // היתרה המחושבת (אחרי 17% באפר)
          risk_level: result.riskStatus,
          risk_day: result.riskDay, // התאריך המדויק
          current_balance: result.currentBalance
        },
        forecastData: result.graphPoints, // עדכון הגרף
        engineData: result
      });
    }
  };

  const hasData = activeSnapshot && activeSnapshot.current_balance !== undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" dir="rtl">
      {/* Background decoration */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(34, 211, 238, 0.15) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      <header className="relative z-10 px-4 py-6 md:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">FlowUp</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-slate-500 text-sm">FutureFlow Dashboard</p>
              {activeEngineData && (
                <div className="flex items-center gap-1 text-xs text-cyan-500/70">
                  <Cpu size={12} />
                  <span>v{SystemInfo.version}</span>
                </div>
              )}
            </div>
          </div>
          {hasData && (
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowUploader(true)} variant="outline" size="sm" className="border-slate-700 text-slate-300">
                <RefreshCw className="w-4 h-4 ml-2" /> עדכן נתונים
              </Button>
              <Button onClick={() => deleteDataMutation.mutate()} variant="ghost" size="sm" className="text-red-400 hover:bg-red-950/50">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="relative z-10 px-4 pb-8 md:px-8">
        <div className="max-w-6xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-[60vh]"><div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : !hasData ? (
            <EmptyState onUploadClick={() => setShowUploader(true)} />
          ) : (
            <>
              {/* כרטיסיות סטטיסטיקה - מסונכרנות לסימולטור */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <StatCard 
                  title="יתרה נוכחית" 
                  value={`₪${activeSnapshot.current_balance?.toLocaleString('he-IL')}`} 
                  color={activeSnapshot.risk_level} 
                  icon={Wallet} 
                />
                <StatCard 
                  title="סך הכנסות" 
                  value={`₪${activeSnapshot.total_income?.toLocaleString('he-IL')}`} 
                  color="green" 
                  icon={TrendingUp} 
                />
                <StatCard 
                  title="סך הוצאות" 
                  value={`₪${activeSnapshot.total_expenses?.toLocaleString('he-IL')}`} 
                  color="red" 
                  icon={TrendingDown} 
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* צד שמאל: ויזואליזציה */}
                <div className="space-y-6">
                  {/* מד והמלצות בשורה אחת */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="rounded-2xl p-6 border border-cyan-500/20 bg-slate-800/50 backdrop-blur-sm">
                      <SpeedometerGauge 
                        projectedBalance={activeSnapshot.projected_eom_balance} 
                        riskLevel={activeSnapshot.risk_level} 
                        riskDay={activeSnapshot.risk_day}
                        whatIfAmount={whatIfAmount}
                      />
                    </div>
                    <LeverageCard 
                      projectedBalance={activeSnapshot.projected_eom_balance} 
                      currentBalance={activeSnapshot.current_balance} 
                    />
                  </div>
                  {/* הגרף מתחת */}
                  <RiskZoneChart 
                    data={activeForecastData} 
                    criticalDate={activeSnapshot.risk_day} 
                    projectedBalance={activeSnapshot.projected_eom_balance}
                    currentBalance={activeSnapshot.current_balance}
                  />
                </div>

                {/* צד ימין: סימולטור */}
                <div className="space-y-6">
                  <WhatIfSimulator 
                    onSimulate={handleWhatIfSimulate} 
                    currentBalance={activeSnapshot.current_balance} 
                  />
                </div>
              </div>
              <Disclaimer />
            </>
          )}
        </div>
      </main>

      <AnimatePresence>
        {showUploader && <CSVUploader onDataParsed={handleDataParsed} onClose={() => setShowUploader(false)} />}
      </AnimatePresence>
    </div>
  );
}