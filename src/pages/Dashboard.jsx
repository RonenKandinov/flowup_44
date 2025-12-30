import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, TrendingUp, TrendingDown, Wallet, Loader2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/visuals/StatCard';
import SpeedometerGauge from '@/components/visuals/SpeedometerGauge';
import RiskChart from '@/components/visuals/RiskChart';
import RiskStatusIndicator from '@/components/visuals/RiskStatusIndicator';
import { processAndForecast } from '@/components/utils/forecastingLogic';
import { dbService } from '@/components/utils/dbService';

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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-xl"
          dir="rtl"
        >
          <div className="mb-8">
            <div className="w-32 h-32 mx-auto rounded-3xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-8 shadow-xl">
              <Upload className="w-16 h-16 text-white" strokeWidth={2} />
            </div>
            <h1 className="text-5xl font-bold text-slate-800 mb-4">FlowUp Pro</h1>
            <p className="text-slate-600 text-lg mb-2">מערכת תחזית פיננסית מתקדמת</p>
            <p className="text-slate-500 text-sm">העלה דוח בנק לקבלת תחזית היברידית עם 17% מרווח בטיחות</p>
          </div>

          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
            <div className="inline-block px-12 py-5 bg-white rounded-2xl shadow-lg border-2 border-blue-200 hover:border-blue-400 hover:shadow-xl transition-all">
              {uploading ? (
                <div className="flex items-center gap-3 text-blue-600">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="font-semibold text-lg">מעבד קובץ...</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Upload className="w-6 h-6 text-blue-600" />
                  <span className="text-blue-600 font-bold text-lg">העלה קובץ CSV</span>
                </div>
              )}
            </div>
          </label>

          <div className="mt-12 p-6 bg-white rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 text-slate-600 text-sm">
              <Shield className="w-5 h-5 text-blue-500" />
              <span>הנתונים שלך מאובטחים ונשארים פרטיים לחלוטין</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const whatIfAmount = parseFloat(whatIfValue) || 0;

  return (
    <div className="min-h-screen p-6 bg-slate-50" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">FlowUp Pro</h1>
            <p className="text-slate-600 text-sm font-medium">תחזית היברידית • 17% מרווח בטיחות</p>
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
              variant="outline"
              className="bg-white border-slate-300 text-slate-700 hover:bg-slate-100 font-medium"
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  מעלה...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 ml-2" strokeWidth={2} />
                  העלה מחדש
                </>
              )}
            </Button>
          </label>
        </motion.div>

        {/* Risk Status Indicator */}
        <div className="mb-8">
          <RiskStatusIndicator status={data.riskStatus} />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            label="יתרה נוכחית"
            value={`₪${data.currentBalance.toLocaleString('he-IL')}`}
            icon={Wallet}
            color="blue"
            delay={0}
          />
          <StatCard
            label="הכנסות החודש"
            value={`₪${data.totalIncome.toLocaleString('he-IL')}`}
            icon={TrendingUp}
            color="green"
            delay={0.1}
          />
          <StatCard
            label="הוצאות החודש"
            value={`₪${data.totalExpense.toLocaleString('he-IL')}`}
            icon={TrendingDown}
            color="red"
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
              className="p-6 bg-white rounded-2xl shadow-sm border border-slate-200"
            >
              <h3 className="text-sm font-semibold text-slate-700 mb-4">
                סימולטור הוצאות עתידיות
              </h3>
              <div className="relative">
                <input
                  type="number"
                  placeholder="הזן סכום הוצאה..."
                  value={whatIfValue}
                  onChange={(e) => setWhatIfValue(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-800 font-semibold text-2xl px-4 py-3 outline-none focus:border-blue-400 transition-colors placeholder:text-slate-400"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xl font-bold">₪</span>
              </div>
              {whatIfAmount > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700 font-medium">
                    יתרה לאחר הוצאה: <span className="font-bold">₪{(data.projectedEOM - whatIfAmount).toLocaleString('he-IL')}</span>
                  </p>
                </div>
              )}
            </motion.div>
          </div>

          <RiskChart data={data.graphPoints.length > 0 ? data.graphPoints : [{ date: 'יום 1', balance: data.projectedEOM }]} />
        </div>

        {/* Safety Buffer Info */}
        {data.safetyBuffer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-5 bg-blue-50 border-2 border-blue-200 rounded-2xl text-center"
          >
            <p className="text-blue-700 font-semibold text-sm">
              🛡️ מרווח בטיחות של 17%: <span className="text-xl">₪{data.safetyBuffer.toLocaleString('he-IL')}</span>
            </p>
          </motion.div>
        )}

        {/* Risk Alert */}
        {data.riskDay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 p-5 bg-red-50 border-2 border-red-300 rounded-2xl text-center"
          >
            <p className="text-red-700 font-bold text-lg">
              ⚠️ אזהרה: יתרה שלילית צפויה ב-{data.riskDay}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}