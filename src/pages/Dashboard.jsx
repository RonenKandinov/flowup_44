import React, { useState, useMemo } from 'react';
import { Wallet, ShieldAlert, Landmark, Info, Upload, TrendingUp, Activity, HelpCircle } from 'lucide-react';

export default function Dashboard() {
  // --- נתוני המערכת ---
  const [currentBalance, setCurrentBalance] = useState(0);
  const [income, setIncome] = useState(0);
  const [spending, setSpending] = useState(0);
  const [whatIf, setWhatIf] = useState("");

  // --- הפונקציה שמתקנת את הסנכרון ---
  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const rows = text.split('\n').filter(r => r.trim() !== '');
      
      // שליפת יתרה (עמודה 8)
      const lastRow = rows[rows.length - 1].split(',');
      const balanceValue = parseFloat(lastRow[8]?.replace(/[₪,]/g, '')) || 0;

      // חישוב ממוצעים מהקובץ (הכנסות עמודה 7, הוצאות עמודה 6)
      let totalCredit = 0;
      let totalDebit = 0;
      rows.forEach(row => {
        const cols = row.split(',');
        totalCredit += parseFloat(cols[7]?.replace(/[₪,]/g, '')) || 0;
        totalDebit += parseFloat(cols[6]?.replace(/[₪,]/g, '')) || 0;
      });

      // עדכון הנתונים בשידור חי
      setCurrentBalance(balanceValue);
      setIncome(totalCredit);
      setSpending(totalDebit);
    };
    reader.readAsText(file);
  };

  const safeBalance = useMemo(() => {
    const simulationValue = whatIf === "" ? 0 : parseFloat(whatIf);
    const projected = currentBalance + (income - spending) - simulationValue;
    return Math.max(0, Math.floor(projected * 0.83));
  }, [currentBalance, income, spending, whatIf]);

  const needleRotation = useMemo(() => {
    const maxView = 5000;
    const percent = Math.min(Math.max(safeBalance / maxView, 0), 1);
    return percent * 180 - 180;
  }, [safeBalance]);

  return (
    <div className="min-h-screen bg-[#040b14] text-slate-100 p-4 md:p-10 font-sans tracking-tight" dir="rtl">
      <div className="max-w-5xl mx-auto bg-[#0a1622]/80 border border-cyan-900/40 rounded-[2rem] p-8 md:p-10 shadow-[0_0_60px_rgba(0,0,0,0.6)] backdrop-blur-xl relative overflow-hidden text-right">
        
        <div className="text-center mb-12">
          <h1 className="text-[#64ffda] text-xs font-bold tracking-[0.5em] uppercase opacity-80">
            FlowUp <span className="text-slate-500">// FUTUREFLOW DASHBOARD</span>
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center mb-12">
          {/* כרטיס הכנסות */}
          <div className="bg-[#0f2030] border border-[#22c55e]/30 rounded-2xl p-6 text-center">
            <Landmark className="mx-auto mb-3 text-[#22c55e]/50" size={24} />
            <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">סיכום הכנסות</h3>
            <div className="text-4xl font-mono font-black text-[#22c55e]">₪{income.toLocaleString()}</div>
          </div>

          {/* רמזור */}
          <div className="relative flex flex-col items-center">
            <div className="relative w-64 h-36">
              <svg width="100%" height="100%" viewBox="0 0 200 120">
                <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#162c46" strokeWidth="14" strokeLinecap="round" />
                <path d="M20 100 A80 80 0 0 1 73 45" fill="none" stroke="#22c55e" strokeWidth="14" strokeLinecap="round" />
                <path d="M78 42 A80 80 0 0 1 122 42" fill="none" stroke="#eab308" strokeWidth="14" strokeLinecap="round" />
                <path d="M127 45 A80 80 0 0 1 180 100" fill="none" stroke="#ef4444" strokeWidth="14" strokeLinecap="round" />
                <g transform={`rotate(${needleRotation} 100 100)`}>
                  <line x1="100" y1="100" x2="40" y2="100" stroke="white" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="100" cy="100" r="5" fill="white" />
                </g>
              </svg>
            </div>
            <div className="text-center -mt-4">
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">יתרה בטוחה צפויה</p>
               <div className="text-5xl font-black text-white mt-1">₪{safeBalance.toLocaleString()}</div>
            </div>
          </div>

          {/* כרטיס הוצאות */}
          <div className="bg-[#0f2030] border border-[#f59e0b]/30 rounded-2xl p-6 text-center">
            <Wallet className="mx-auto mb-3 text-[#f59e0b]/50" size={24} />
            <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">סיכום הוצאות</h3>
            <div className="text-4xl font-mono font-black text-[#f59e0b]">-₪{spending.toLocaleString()}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
          {/* גרף */}
          <div className="bg-[#06121e] border border-cyan-900/30 rounded-3xl p-6">
            <h3 className="text-orange-500 text-[11px] font-bold uppercase mb-4 tracking-widest text-right">אזור סיכון</h3>
            <div className="h-24 w-full flex items-end gap-1.5 opacity-60">
               {[30, 45, 60, 40, 85, 55, 70].map((h, i) => (
                 <div key={i} className="flex-1 bg-cyan-500/20 border-t-2 border-cyan-400/50" style={{height: `${h}%`}}></div>
               ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-4 text-right italic font-bold">יתרה נוכחית בחשבון: ₪{currentBalance.toLocaleString()}</p>
          </div>

          {/* What If Simulator */}
          <div className="bg-[#0b1b2b] border border-cyan-500/30 rounded-3xl p-6">
            <h3 className="text-cyan-400 text-[11px] font-bold uppercase mb-4 tracking-widest text-right">סימולטור What If</h3>
            <input 
              type="number"
              value={whatIf}
              className="w-full bg-[#040b14] border border-cyan-500/20 rounded-xl p-4 text-cyan-400 text-2xl font-mono focus:outline-none mb-4 text-left"
              placeholder="0.00 ₪"
              onChange={(e) => setWhatIf(e.target.value)}
            />
            <button className="w-full bg-cyan-500/10 border border-cyan-500/40 text-cyan-400 font-black py-4 rounded-xl uppercase text-[10px] tracking-widest">
              חשב סימולציה
            </button>
          </div>
        </div>

        {/* כפתור הסנכרון המתוקן */}
        <div className="mt-8 pt-6 border-t border-white/5 flex justify-center">
           <label className="flex items-center gap-3 px-8 py-3 bg-[#112240] border border-cyan-500/30 rounded-full cursor-pointer hover:bg-cyan-900/40 transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)]">
             <Upload size={18} className="text-[#64ffda]" />
             <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">סנכרון נתונים מהבנק</span>
             <input 
               type="file" 
               className="hidden" 
               accept=".csv" 
               onChange={handleCSVUpload}
             />
           </label>
        </div>

      </div>
    </div>
  );
}