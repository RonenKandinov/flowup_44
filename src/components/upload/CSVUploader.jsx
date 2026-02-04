import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { processAndForecast } from '../utils/forecastingLogic';
import { detectBankFromHeader, parseCSVRow, getBankDisplayName } from '../utils/bankParsers';
import { sanitizeTransaction } from '../utils/sanitizer';
// import { FiscalAgent } from '../protocol/core/fiscalAgent'; // Protocol moved to Dashboard level
import * as XLSX from 'xlsx';

export default function CSVUploader({ onDataParsed, onClose, inline = false }) {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, uploading, processing, success, error
  const [errorMessage, setErrorMessage] = useState('');
  const [fileName, setFileName] = useState('');
  const [detectedBank, setDetectedBank] = useState('');

  const parseCSVForDatabase = (content) => {
    // Clean BOM and normalize line endings
    const cleanedContent = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = cleanedContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('קובץ ה-CSV חייב להכיל לפחות שורת כותרת ושורת נתונים אחת');
    }

    // DIAGNOSIS MODE: Track parsing attempts
    const diagnostics = {
      totalLines: lines.length,
      headerAttempts: [],
      skippedLines: [],
      parsedRows: [],
      failedRows: []
    };

    // Detect bank type from header - may need to skip title rows
    let headerLineIdx = 0;
    let bankType = 'unknown';
    let headerLine = lines[0];
    
    // Try to find the actual header row (skip title rows)
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const testLine = lines[i];
      console.log(`🔍 [Line ${i}] Testing:`, testLine.substring(0, 150));
      const testType = detectBankFromHeader(testLine);
      console.log(`   → Detected:`, testType);
      
      diagnostics.headerAttempts.push({
        lineNum: i,
        preview: testLine.substring(0, 100),
        detected: typeof testType === 'string' ? testType : testType.type
      });
      
      if (testType === 'needs_next_line') {
        continue; // Skip this line
      } else if (typeof testType === 'object' && testType.type === 'error') {
        // Store error but continue searching
        diagnostics.lastError = testType;
        continue;
      } else if (testType !== 'unknown') {
        bankType = testType;
        headerLine = testLine;
        headerLineIdx = i;
        break;
      }
    }
    
    if (bankType === 'unknown' && diagnostics.lastError) {
      // Use the detailed error from detection
      const errorMsg = `${diagnostics.lastError.message}\n\n❌ עמודות חסרות: ${diagnostics.lastError.missingColumns.join(', ')}\n\n✓ עמודות שנמצאו בקובץ:\n${diagnostics.lastError.foundColumns.slice(0, 6).join('\n')}${diagnostics.lastError.foundColumns.length > 6 ? `\n... ועוד ${diagnostics.lastError.foundColumns.length - 6}` : ''}`;
      throw new Error(errorMsg);
    }
    
    if (bankType === 'unknown') {
      throw new Error(`פורמט הקובץ אינו נתמך.\n\n🔍 ניתוח: בדקתי ${diagnostics.headerAttempts.length} שורות ולא מצאתי כותרת תקינה.\n\nשורות שנבדקו:\n${diagnostics.headerAttempts.map(a => `שורה ${a.lineNum}: ${a.preview.substring(0, 50)}...`).join('\n')}`);
    }
    
    setDetectedBank(getBankDisplayName(bankType));

    // Auto-detect delimiter (comma, semicolon, or tab)
    const commaCount = (headerLine.match(/,/g) || []).length;
    const semicolonCount = (headerLine.match(/;/g) || []).length;
    const tabCount = (headerLine.match(/\t/g) || []).length;
    
    let delimiter = ',';
    const maxCount = Math.max(commaCount, semicolonCount, tabCount);
    if (maxCount === tabCount && tabCount > 2) delimiter = '\t';
    else if (maxCount === semicolonCount && semicolonCount > 2) delimiter = ';';
    
    const headers = headerLine.split(delimiter).map(h => h.trim().replace(/"/g, ''));
    
    console.log(`✅ Header found at line ${headerLineIdx}, Bank: ${bankType}, Delimiter: "${delimiter}"`);
    console.log(`📋 Headers (${headers.length}):`, headers);

    const transactions = [];
    let totalIncome = 0;
    let totalExpenses = 0;
    let currentBalance = 0;

    // Start from the line after the header
    for (let i = headerLineIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        diagnostics.skippedLines.push({ lineNum: i, reason: 'empty' });
        continue;
      }

      // Skip lines that don't have enough delimiters (noise/empty rows)
      const delimiterCount = (line.match(new RegExp(delimiter === ',' ? ',' : ';', 'g')) || []).length;
      if (delimiterCount < 3) {
        diagnostics.skippedLines.push({ lineNum: i, reason: 'not_enough_delimiters', count: delimiterCount });
        continue;
      }

      // Skip lines that are mostly #### symbols (Excel display errors)
      const hashCount = (line.match(/####/g) || []).length;
      if (hashCount > 3) {
        diagnostics.skippedLines.push({ lineNum: i, reason: 'excel_display_error' });
        continue;
      }
      
      const values = line.split(delimiter).map(v => v.trim().replace(/"/g, ''));
      
      // Debug first 3 data rows
      if (i <= headerLineIdx + 3) {
        console.log(`\n🔬 [Row ${i}] Values (${values.length}):`, values.slice(0, 8));
      }
      
      // Use bank-specific parser
      const parsed = parseCSVRow(values, headers, bankType);
      
      if (i <= headerLineIdx + 3) {
        console.log(`   → Parsed:`, parsed);
      }
      
      if (!parsed) {
        diagnostics.failedRows.push({ 
          lineNum: i, 
          reason: 'parser_returned_null',
          preview: line.substring(0, 100)
        });
        continue;
      }
      
      if (!parsed.date) {
        diagnostics.failedRows.push({ 
          lineNum: i, 
          reason: 'no_date',
          parsed: JSON.stringify(parsed).substring(0, 100)
        });
        continue;
      }

      // Parse date
      let parsedDate;
      if (parsed.date.includes('/')) {
        const parts = parsed.date.split('/');
        if (parts[2]?.length === 4) {
          parsedDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
        } else {
          parsedDate = new Date(`20${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
        }
      } else if (parsed.date.includes('-')) {
        parsedDate = new Date(parsed.date);
      } else {
        diagnostics.failedRows.push({ 
          lineNum: i, 
          reason: 'invalid_date_format',
          date: parsed.date
        });
        continue;
      }

      if (isNaN(parsedDate.getTime())) {
        diagnostics.failedRows.push({ 
          lineNum: i, 
          reason: 'date_parse_failed',
          date: parsed.date,
          parsedDate: parsedDate
        });
        continue;
      }

      // Calculate amount: positive for income (credit), negative for expense (debit)
      const amount = parsed.credit > 0 ? parsed.credit : (parsed.debit > 0 ? -parsed.debit : 0);
      
      if (amount === 0) {
        diagnostics.failedRows.push({ 
          lineNum: i, 
          reason: 'zero_amount',
          debit: parsed.debit,
          credit: parsed.credit
        });
        continue;
      }

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

      // 1. Sanitize (Clean Data)
      const sanitized = sanitizeTransaction(rawTransaction);
      
      // 2. Sign with Millennium Protocol (Attach Hidden Shadow Metadata)
      // Moved to Dashboard level for separation of concerns
      // const secured = FiscalAgent.signTransaction(sanitized);

      transactions.push(sanitized);
      diagnostics.parsedRows.push({ lineNum: i, date: parsed.date, amount });
    }

    if (transactions.length === 0) {
      // Build comprehensive error report
      const errorReport = `
🔍 ניתוח מפורט של הקובץ:

📊 סטטיסטיקה:
- סה"כ שורות: ${diagnostics.totalLines}
- שורת כותרת: שורה ${headerLineIdx} (${bankType})
- שורות שנדלגו: ${diagnostics.skippedLines.length}
- שורות שנכשלו בפרסור: ${diagnostics.failedRows.length}

❌ סיבות כשל עיקריות:
${Object.entries(
  diagnostics.failedRows.reduce((acc, row) => {
    acc[row.reason] = (acc[row.reason] || 0) + 1;
    return acc;
  }, {})
).map(([reason, count]) => `- ${reason}: ${count} שורות`).join('\n')}

🔬 דוגמאות לשורות שנכשלו:
${diagnostics.failedRows.slice(0, 3).map(row => 
  `שורה ${row.lineNum}: ${row.reason}\n  ${row.preview || JSON.stringify(row).substring(0, 80)}`
).join('\n\n')}

💡 הצעות לפתרון:
${diagnostics.failedRows.some(r => r.reason === 'zero_amount') ? '- הקובץ מכיל רק שורות עם סכום 0 - ייתכן שיש בעיה בעמודות החובה/זכות\n' : ''}
${diagnostics.failedRows.some(r => r.reason.includes('date')) ? '- בעיה בזיהוי תאריכים - בדוק את פורמט התאריך בקובץ\n' : ''}
${diagnostics.skippedLines.length > diagnostics.failedRows.length ? '- רוב השורות נדלגו - ייתכן שיש בעיה במבנה הקובץ\n' : ''}
      `.trim();
      
      throw new Error(errorReport);
    }

    // Sort by date and return with totals
    const sortedTransactions = transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    console.log(`✅ הצלחה! פרסרתי ${transactions.length} עסקאות מתוך ${diagnostics.totalLines} שורות`);

    return {
      transactions: sortedTransactions,
      totalIncome,
      totalExpenses,
      currentBalance
    };
  };

  const processFile = async (file) => {
    console.log("🚀 Starting file processing:", file.name, "Size:", file.size, "Type:", file.type);
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
        // Read CSV with smart encoding detection (UTF-8 → Windows-1255 fallback)
        content = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            let result = e.target.result;
            console.log("📖 First read attempt (UTF-8):", result.substring(0, 200));

            // Check for gibberish (Unicode replacement chars or missing Hebrew)
            const hasGibberish = result.includes('�') || 
                                 result.includes('�') || 
                                 (result.includes('Date') && !result.match(/[א-ת]/));

            if (hasGibberish) {
              console.log("🔄 Detected encoding issue, retrying with Windows-1255...");
              const reader2 = new FileReader();
              reader2.onload = (e2) => {
                console.log("✅ Second read (Windows-1255):", e2.target.result.substring(0, 200));
                resolve(e2.target.result);
              };
              reader2.onerror = () => reject(new Error('שגיאה בקריאת הקובץ'));
              reader2.readAsText(file, 'windows-1255');
            } else {
              resolve(result);
            }
          };
          reader.onerror = () => reject(new Error('שגיאה בקריאת הקובץ'));
          reader.readAsText(file, 'UTF-8');
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

  if (inline) {
    return (
      <div className="w-full max-w-md mx-auto bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden mt-10">
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
      </div>
    );
  }

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