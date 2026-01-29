import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { processAndForecast } from './utils/forecastingLogic';
import { detectBankFromHeader, parseCSVRow, getBankDisplayName } from './utils/bankParsers';
import { sanitizeTransaction } from './utils/sanitizer';
import * as XLSX from 'xlsx';

export default function CSVUploader({ onDataParsed, onClose }) {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, uploading, processing, success, error
  const [errorMessage, setErrorMessage] = useState('');
  const [fileName, setFileName] = useState('');
  const [detectedBank, setDetectedBank] = useState('');

  const parseCSVForDatabase = (content) => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('קובץ ה-CSV חייב להכיל לפחות שורת כותרת ושורת נתונים אחת');
    }

    // Detect bank type from header
    const headerLine = lines[0];
    const bankType = detectBankFromHeader(headerLine);
    
    if (bankType === 'unknown') {
      throw new Error('פורמט הקובץ אינו נתמך. אנא ייצא קובץ CSV מבנק הפועלים, לאומי, דיסקונט, מזרחי או הבינלאומי');
    }
    
    setDetectedBank(getBankDisplayName(bankType));

    // Parse headers (try both comma and semicolon)
    const delimiter = headerLine.includes(';') ? ';' : ',';
    const headers = headerLine.split(delimiter).map(h => h.trim().replace(/"/g, ''));

    const transactions = [];
    let totalIncome = 0;
    let totalExpenses = 0;
    let currentBalance = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(delimiter).map(v => v.trim().replace(/"/g, ''));
      
      // Use bank-specific parser
      const parsed = parseCSVRow(values, headers, bankType);
      
      if (!parsed || !parsed.date) continue;

      // Parse date
      let parsedDate;
      if (parsed.date.includes('/')) {
        const parts = parsed.date.split('/');
        if (parts[2]?.length === 4) {
          parsedDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
        } else {
          parsedDate = new Date(`20${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
        }
      } else {
        parsedDate = new Date(parsed.date);
      }

      if (isNaN(parsedDate.getTime())) continue;

      // Calculate amount: positive for income (credit), negative for expense (debit)
      const amount = parsed.credit > 0 ? parsed.credit : (parsed.debit > 0 ? -parsed.debit : 0);
      
      if (amount === 0) continue;

      // Accumulate totals
      if (parsed.credit > 0) totalIncome += parsed.credit;
      if (parsed.debit > 0) totalExpenses += parsed.debit;
      if (parsed.balance > 0) currentBalance = parsed.balance;

      // Sanitize description before storage
      const rawTransaction = {
        date: parsedDate.toISOString().split('T')[0],
        description: parsed.description || 'תנועה',
        amount: amount,
        balance: parsed.balance || null,
        category: amount > 0 ? 'income' : 'expense'
      };

      transactions.push(sanitizeTransaction(rawTransaction));
    }

    if (transactions.length === 0) {
      throw new Error('לא נמצאו עסקאות תקינות בקובץ');
    }

    // Sort by date and return with totals
    const sortedTransactions = transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    return {
      transactions: sortedTransactions,
      totalIncome,
      totalExpenses,
      currentBalance
    };
  };

  const processFile = async (file) => {
    setStatus('uploading');
    setFileName(file.name);
    setErrorMessage('');

    try {
      let content = '';

      // Handle Excel files
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const arrayBuffer = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => reject(new Error('שגיאה בקריאת קובץ האקסל'));
          reader.readAsArrayBuffer(file);
        });

        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        content = XLSX.utils.sheet_to_csv(worksheet);
      } else {
        // Read CSV file content with ISO-8859-8 encoding for Hebrew support
        content = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => reject(new Error('שגיאה בקריאת הקובץ'));
          reader.readAsText(file, 'ISO-8859-8');
        });
      }

      setStatus('processing');

      // Use FlowUp Pro Engine for forecasting
      const forecastResult = processAndForecast(content);

      if (forecastResult.error) {
        throw new Error(forecastResult.error);
      }

      // Parse CSV for database storage
      const parsedData = parseCSVForDatabase(content);
      
      // Secure Storage: Explicitly clear raw content reference
      // content variable will be garbage collected when function scope ends

      setStatus('success');

      // Pass data to parent
      onDataParsed({
        transactions: parsedData.transactions,
        snapshot: {
          current_balance: parsedData.currentBalance,
          projected_eom_balance: forecastResult.projectedEOM,
          total_income: parsedData.totalIncome,
          total_expenses: parsedData.totalExpenses,
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
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const isValid = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (file && isValid) {
      processFile(file);
    } else {
      setStatus('error');
      setErrorMessage('נא להעלות קובץ CSV או Excel בלבד');
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
            העלה את קובץ ה-Excel או CSV שהורדת מהבנק
            {detectedBank && <span className="block mt-1 text-cyan-400">זוהה: {detectedBank}</span>}
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
              accept=".csv, .xlsx, .xls"
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
                <p>קבצי Excel (.xlsx) או CSV מכל הבנקים</p>
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