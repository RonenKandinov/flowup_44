import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { processAndForecast } from '../utils/forecastingLogic';

export default function CSVUploader({ onDataParsed, onClose }) {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, uploading, processing, success, error
  const [errorMessage, setErrorMessage] = useState('');
  const [fileName, setFileName] = useState('');

  const parseCSVForDatabase = (content) => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('קובץ ה-CSV חייב להכיל לפחות שורת כותרת ושורת נתונים אחת');
    }

    // Try to detect Hebrew bank format
    const headerLine = lines[0];
    const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, ''));
    
    // Common Hebrew bank column names
    const dateColumns = ['תאריך', 'תאריך עסקה', 'date', 'Date'];
    const descColumns = ['תיאור', 'פרטים', 'description', 'Description'];
    const amountColumns = ['סכום', 'זכות', 'חובה', 'amount', 'Amount'];
    const balanceColumns = ['יתרה', 'balance', 'Balance'];

    const findColumnIndex = (possibleNames) => {
      for (const name of possibleNames) {
        const index = headers.findIndex(h => h.includes(name));
        if (index !== -1) return index;
      }
      return -1;
    };

    const dateIdx = findColumnIndex(dateColumns);
    const descIdx = findColumnIndex(descColumns);
    const amountIdx = findColumnIndex(amountColumns);
    const balanceIdx = findColumnIndex(balanceColumns);

    if (dateIdx === -1 || amountIdx === -1) {
      throw new Error('לא נמצאו עמודות תאריך או סכום בקובץ');
    }

    const transactions = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      
      if (values.length <= dateIdx || values.length <= amountIdx) continue;

      const dateStr = values[dateIdx];
      const amountStr = values[amountIdx]?.replace(/[^\d.-]/g, '');
      const amount = parseFloat(amountStr);
      
      if (!dateStr || isNaN(amount)) continue;

      // Parse date (handle various formats)
      let parsedDate;
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts[2]?.length === 4) {
          parsedDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
        } else {
          parsedDate = new Date(`20${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
        }
      } else {
        parsedDate = new Date(dateStr);
      }

      if (isNaN(parsedDate.getTime())) continue;

      transactions.push({
        date: parsedDate.toISOString().split('T')[0],
        description: descIdx !== -1 ? values[descIdx] : '',
        amount: amount,
        balance: balanceIdx !== -1 ? parseFloat(values[balanceIdx]?.replace(/[^\d.-]/g, '')) : null,
        category: amount > 0 ? 'income' : 'expense'
      });
    }

    if (transactions.length === 0) {
      throw new Error('לא נמצאו עסקאות תקינות בקובץ');
    }

    return transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const processFile = async (file) => {
    setStatus('uploading');
    setFileName(file.name);
    setErrorMessage('');

    try {
      // Read file content with ISO-8859-8 encoding for Hebrew support
      const content = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('שגיאה בקריאת הקובץ'));
        reader.readAsText(file, 'ISO-8859-8');
      });

      setStatus('processing');

      // Use FlowUp Pro Engine for forecasting
      const forecastResult = processAndForecast(content);

      if (forecastResult.error) {
        throw new Error(forecastResult.error);
      }

      // Parse CSV for database storage
      const transactions = parseCSVForDatabase(content);

      // Calculate monthly income/expenses for stats
      const monthlyTransactions = transactions.filter(t => {
        const date = new Date(t.date);
        const now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      });

      const totalIncome = monthlyTransactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
      
      const totalExpenses = Math.abs(monthlyTransactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0));

      setStatus('success');

      // Pass data to parent
      onDataParsed({
        transactions,
        snapshot: {
          current_balance: forecastResult.currentBalance,
          projected_eom_balance: forecastResult.projectedEOM,
          total_income: totalIncome,
          total_expenses: totalExpenses,
          risk_level: forecastResult.riskStatus,
          risk_day: forecastResult.riskDay,
          avg_daily_spending: forecastResult.avgDailySpending,
          upload_date: new Date().toISOString()
        },
        forecastData: forecastResult.graphPoints,
        engineData: forecastResult
      });

      setTimeout(() => {
        onClose?.();
      }, 1500);

    } catch (error) {
      setStatus('error');
      setErrorMessage(error.message || 'שגיאה בעיבוד הקובץ');
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      processFile(file);
    } else {
      setStatus('error');
      setErrorMessage('נא להעלות קובץ CSV בלבד');
    }
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden"
      >
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-2">העלאת קובץ בנק</h2>
          <p className="text-slate-400 text-sm mb-6">
            העלה את קובץ ה-CSV שהורדת מהבנק (פועלים, לאומי, דיסקונט וכו')
          </p>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-xl p-8 text-center transition-all
              ${isDragging 
                ? 'border-cyan-500 bg-cyan-500/10' 
                : 'border-slate-600 hover:border-slate-500'
              }
            `}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={status === 'uploading' || status === 'processing'}
            />

            <AnimatePresence mode="wait">
              {status === 'idle' && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Upload className="w-12 h-12 mx-auto mb-4 text-slate-500" />
                  <p className="text-slate-300 mb-1">גרור קובץ לכאן</p>
                  <p className="text-slate-500 text-sm">או לחץ לבחירת קובץ</p>
                </motion.div>
              )}

              {(status === 'uploading' || status === 'processing') && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-4"
                >
                  <Loader2 className="w-12 h-12 mx-auto mb-4 text-cyan-500 animate-spin" />
                  <p className="text-slate-300">{fileName}</p>
                  <p className="text-cyan-400 text-sm mt-1">
                    {status === 'uploading' ? 'מעלה...' : 'מעבד נתונים...'}
                  </p>
                </motion.div>
              )}

              {status === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-4"
                >
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p className="text-green-400">הקובץ עובד בהצלחה!</p>
                </motion.div>
              )}

              {status === 'error' && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-4"
                >
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                  <p className="text-red-400">{errorMessage}</p>
                  <Button
                    variant="ghost"
                    className="mt-4 text-slate-400"
                    onClick={() => setStatus('idle')}
                  >
                    נסה שוב
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-6 p-4 bg-slate-800/50 rounded-xl">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-slate-500 mt-0.5" />
              <div className="text-xs text-slate-400">
                <p className="font-medium text-slate-300 mb-1">פורמט נתמך:</p>
                <p>קובץ CSV עם עמודות: תאריך, תיאור, סכום, יתרה</p>
                <p className="mt-1 text-slate-500">הנתונים שלך מאובטחים ונשארים בשליטתך המלאה</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-800/50 border-t border-slate-700 flex justify-end">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            ביטול
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}