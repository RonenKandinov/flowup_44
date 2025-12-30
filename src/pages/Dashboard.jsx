import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, Wallet, TrendingUp, TrendingDown, Loader2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/revolut/StatCard';
import SpeedometerGauge from '@/components/revolut/SpeedometerGauge';
import RiskZoneChart from '@/components/revolut/RiskZoneChart';
import WhatIfSimulator from '@/components/revolut/WhatIfSimulator';
import { processCSV } from '@/components/engine/flowUpEngine';
import { saveFinancialData, loadLatestSnapshot } from '@/components/engine/dbService';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [whatIfValue, setWhatIfValue] = useState('');

  // Auto-load latest snapshot on mount
  useEffect(() => {
    const loadData = async () => {
      const snapshot = await loadLatestSnapshot();
      if (snapshot) {
        setData({
          currentBalance: snapshot.current_balance,
          safeProjection: snapshot.projected_balance,
          totalIncome: snapshot.total_income || 0,
          totalExpenses: snapshot.total_expenses || 0,
          riskLevel: snapshot.risk_level,
          riskDay: snapshot.risk_day,
          graphData: [] // Empty for now, will be regenerated on next upload
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
      const result = processCSV(text);

      if (!result.success) {
        alert('שגיאה: ' + result.error);
        setUploading(false);
        return;
      }

      // Save to database
      await saveFinancialData(result);

      // Update UI
      setData(result);
      setUploading(false);
    } catch (error) {
      alert('שגיאה בעיבוד הקובץ');
      setUploading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F1115' }}>
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#00D994' }} />
      </div>
    );
  }

  // Empty state - no data uploaded yet
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0F1115' }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-xl"
          dir="rtl"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="w-32 h-32 mx-auto mb-8 rounded-3xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #00D994, #00A876)',
              boxShadow: '0 20px 60px rgba(0, 217, 148, 0.3)'
            }}
          >
            <Upload className="w-16 h-16 text-white" strokeWidth={2.5} />
          </motion.div>

          <h1 className="text-5xl font-bold text-white mb-4">FlowUp Pro</h1>
          <p className="text-slate-400 text-lg mb-2">תחזית פיננסית היברידית</p>
          <p className="text-slate-500 text-sm mb-10">
            העלה דוח בנק לקבלת תחזית עם 17% מרווח בטיחות
          </p>

          <label className="cursor-pointer inline-block">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
            <div
              className="px-10 py-5 rounded-2xl font-bold text-lg transition-all"
              style={{
                background: uploading ? 'rgba(255,255,255,0.05)' : '#00D994',
                color: uploading ? '#64748b' : '#0F1115',
                boxShadow: uploading ? 'none' : '0 10px 40px rgba(0, 217, 148, 0.4)'
              }}
            >
              {uploading ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>מעבד נתונים...</span>
                </div>
              ) : (
                'העלה קובץ CSV'
              )}
            </div>
          </label>

          <div className="mt-12 flex items-center justify-center gap-2 text-slate-500 text-sm">
            <Shield className="w-4 h-4" />
            <span>הנתונים שלך מוצפנים ומאובטחים</span>
          </div>
        </motion.div>
      </div>
    );
  }

  const whatIfAmount = parseFloat(whatIfValue) || 0;

  // Main Dashboard
  return (
    <div className="min-h-screen p-6" style={{ background: '#0F1115' }} dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">FlowUp Pro</h1>
            <p className="text-slate-400 text-sm font-medium">
              תחזית היברידית • כלל ה-17%
            </p>
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
              className="font-medium"
              disabled={uploading}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#FFFFFF'
              }}
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

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            label="יתרה נוכחית"
            value={`₪${data.currentBalance.toLocaleString('he-IL')}`}
            icon={Wallet}
            color="white"
            delay={0}
          />
          <StatCard
            label="הכנסות חודשיות"
            value={`₪${data.totalIncome.toLocaleString('he-IL')}`}
            icon={TrendingUp}
            color="mint"
            delay={0.1}
          />
          <StatCard
            label="הוצאות חודשיות"
            value={`₪${data.totalExpenses.toLocaleString('he-IL')}`}
            icon={TrendingDown}
            color="red"
            delay={0.2}
          />
        </div>

        {/* Main Content: Gauge + Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="space-y-6">
            <SpeedometerGauge
              projectedBalance={data.safeProjection}
              riskLevel={data.riskLevel}
              whatIfAmount={whatIfAmount}
            />
            <WhatIfSimulator value={whatIfValue} onChange={setWhatIfValue} />
          </div>

          <RiskZoneChart data={data.graphData?.length > 0 ? data.graphData : [{ day: '1', balance: data.safeProjection }]} />
        </div>

        {/* Risk Day Alert */}
        {data.riskDay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-5 rounded-2xl text-center"
            style={{
              background: 'rgba(255, 79, 79, 0.1)',
              border: '1px solid rgba(255, 79, 79, 0.3)'
            }}
          >
            <p className="text-red-400 font-bold text-lg">
              ⚠️ אזהרה: יתרה שלילית צפויה ב-{data.riskDay}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}