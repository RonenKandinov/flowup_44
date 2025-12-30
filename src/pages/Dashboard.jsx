import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, TrendingUp, TrendingDown, DollarSign, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatCard from '../components/visuals/StatCard';
import SpeedometerGauge from '../components/visuals/SpeedometerGauge';
import RiskChart from '../components/visuals/RiskChart';
import { processAndForecast } from '../components/utils/forecastingLogic';
import { dbService } from '../components/utils/dbService';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [whatIfValue, setWhatIfValue] = useState('');

  // Load last snapshot on mount
  useEffect(() => {
    const loadData = async () => {
      const snapshot = await dbService.getLastSnapshot();
      if (snapshot) {
        // Reconstruct data from snapshot
        setData({
          currentBalance: snapshot.current_balance,
          projectedEOM: snapshot.projected_eom_balance,
          totalIncome: snapshot.total_income || 0,
          totalExpense: snapshot.total_expenses || 0,
          riskStatus: snapshot.risk_level,
          riskDay: snapshot.risk_day,
          graphPoints: [] // We'll generate empty graph for now
        });
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const text = await file.text();
      const result = processAndForecast(text);

      if (result.error) {
        alert('שגיאה: ' + result.error);
        setUploading(false);
        return;
      }

      // Save to database
      await dbService.saveSnapshot(result);
      await dbService.saveTransactions(result.transactions);

      // Update UI
      setData(result);
      setUploading(false);
    } catch (error) {
      alert('שגיאה בעיבוד הקובץ');
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#050505' }}>
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#050505' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="mb-8">
            <div className="w-24 h-24 mx-auto rounded-full bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] flex items-center justify-center mb-6">
              <Upload className="w-10 h-10 text-cyan-400" strokeWidth={1.5} />
            </div>
            <h1 className="text-4xl font-extralight text-white mb-3">FlowUp Pro</h1>
            <p className="text-slate-500 text-sm">העלה דוח בנק לתחזית פיננסית מתקדמת</p>
          </div>

          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
            <div className="px-8 py-4 bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-xl hover:bg-white/[0.04] transition-all">
              {uploading ? (
                <div className="flex items-center gap-3 text-cyan-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-light">מעבד...</span>
                </div>
              ) : (
                <span className="text-cyan-400 font-light">בחר קובץ CSV</span>
              )}
            </div>
          </label>
        </motion.div>
      </div>
    );
  }

  const whatIfAmount = parseFloat(whatIfValue) || 0;

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: '#050505' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <h1 className="text-4xl font-extralight text-white mb-2">FlowUp Pro</h1>
            <p className="text-slate-500 text-sm">תחזית היברידית עם 17% מרווח בטיחות</p>
          </div>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
            <Button
              variant="ghost"
              className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] text-slate-400 hover:text-cyan-400 hover:bg-white/[0.04]"
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 ml-2" strokeWidth={1.5} />
              )}
              העלה מחדש
            </Button>
          </label>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard
            label="יתרה נוכחית"
            value={`₪${data.currentBalance.toLocaleString('he-IL')}`}
            icon={DollarSign}
            color="cyan"
            delay={0}
          />
          <StatCard
            label="הכנסות החודש"
            value={`₪${data.totalIncome.toLocaleString('he-IL')}`}
            icon={TrendingUp}
            color="cyan"
            delay={0.1}
          />
          <StatCard
            label="הוצאות החודש"
            value={`₪${data.totalExpense.toLocaleString('he-IL')}`}
            icon={TrendingDown}
            color="rose"
            delay={0.2}
          />
        </div>

        {/* Main Grid: Gauge + Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="space-y-6">
            <SpeedometerGauge
              currentBalance={data.currentBalance}
              projectedBalance={data.projectedEOM}
              riskStatus={data.riskStatus}
              whatIfValue={whatIfAmount}
            />

            {/* What-If Simulator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="p-6 bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl"
            >
              <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-light mb-4">
                מדמה מה-אם
              </h3>
              <div className="relative">
                <input
                  type="number"
                  placeholder="הוצאה נוספת..."
                  value={whatIfValue}
                  onChange={(e) => setWhatIfValue(e.target.value)}
                  className="w-full bg-transparent border-b border-white/[0.1] text-white font-light text-2xl pb-2 outline-none focus:border-cyan-400 transition-colors placeholder:text-slate-700"
                />
                <span className="absolute left-0 bottom-2 text-slate-600 text-sm">₪</span>
              </div>
              {whatIfAmount > 0 && (
                <p className="text-xs text-slate-500 mt-3">
                  השפעה: ₪{(data.projectedEOM - whatIfAmount).toLocaleString('he-IL')}
                </p>
              )}
            </motion.div>
          </div>

          <RiskChart data={data.graphPoints.length > 0 ? data.graphPoints : [{ date: 'יום 1', balance: data.projectedEOM }]} />
        </div>

        {/* Risk Alert */}
        {data.riskDay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center"
          >
            <p className="text-rose-400 text-sm font-light">
              ⚠️ אזהרה: יתרה קריטית צפויה ב-{data.riskDay}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}