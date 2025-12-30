import React, { useState, useMemo } from 'react';
import { Wallet, ShieldAlert, Landmark, Info, Upload, TrendingUp, Activity, HelpCircle } from 'lucide-react';

export default function Dashboard() {
  // נתוני הבנק מה-CSV (₪715.81 כבסיס)
  const [currentBalance, setCurrentBalance] = useState(715.81);
  const [income, setIncome] = useState(8800);
  const [spending, setSpending] = useState(7550);
  const [whatIf, setWhatIf] = useState(""); // שדה ריק כפי שביקשת

  // חישוב יתרה בטוחה עם 17% הגנה
  const safeBalance = useMemo(() => {
    const simulationValue = whatIf === "" ? 0 : parseFloat(whatIf);
    const projected = currentBalance + (income - spending) - simulationValue;
    return Math.max(0, Math.floor(projected * 0.83));
  }, [currentBalance, income, spending, whatIf]);

  // חישוב זווית המחוג (סקלה של 0-5000)
  const needleRotation = useMemo(() => {
    const percent = Math.min(Math.max(safeBalance / 5000, 0), 1);
    return percent * 180 - 180;
  }, [safeBalance]);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 p-4 md:p-10 font-['Assistant',_'Heebo',_sans-serif] tracking-tight" dir="rtl">
      {/* המכל המרכזי בעיצוב התמונה */}
      <div className="max-w-5xl mx-auto bg-[#0f1419]/80 border border-cyan-500/20 rounded-[2rem] p-8 md:p-10 shadow-[0_0_80px_rgba(6,182,212,0.15)] backdrop-blur-xl relative overflow-hidden">
        
        {/* כותרת עליונה בסגנון הייטק */}
        <div className="text-center mb-12">
          <h1 className="text-[#64ffda] text-xs font-bold tracking-[0.5em] uppercase opacity-80">
            FlowUp <span className="text-slate-500">// FUTUREFLOW DASHBOARD</span>
          </h1>
        </div>

        {/* שורה עליונה: קומפוזיציית הרמזור והכרטיסים */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center mb-12">
          
          {/* כרטיס הכנסות - ירוק ניאון */}
          <div className="bg-[#0f2030] border border-[#22c55e]/30 rounded-2xl p-6 text-center shadow-[0_0_25px_rgba(34,197,94,0.2)]">
            <Landmark className="mx-auto mb-3 text-[#22c55e]/50" size={24} />
            <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">סיכום הכנסות</h3>
            <div className="text-4xl font-mono font-black text-[#22c55e]">₪{income.toLocaleString()}</div>
          </div>

          {/* הרמזור המרכזי - HD Gradient Arc */}
          <div className="relative flex flex-col items-center">
            <div className="relative w-64 h-36">
              <svg width="100%" height="100%" viewBox="0 0 200 120">
                <defs>
                  <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="1" />
                    <stop offset="50%" stopColor="#f59e0b" stopOpacity="1" />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="1" />
                  </linearGradient>
                  <filter id="neonGlow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                
                {/* קשת רקע */}
                <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#1a2332" strokeWidth="16" strokeLinecap="round" />
                
                {/* קשת גרדיאנט HD */}
                <path 
                  d="M20 100 A80 80 0 0 1 180 100" 
                  fill="none" 
                  stroke="url(#gaugeGradient)" 
                  strokeWidth="14" 
                  strokeLinecap="round"
                  filter="url(#neonGlow)"
                />
                
                {/* המחוג - ניאון כתום זוהר */}
                <g transform={`rotate(${needleRotation} 100 100)`}>
                  <line 
                    x1="100" y1="100" x2="40" y2="100" 
                    stroke="#ff6b35" 
                    strokeWidth="4" 
                    strokeLinecap="round"
                    filter="url(#neonGlow)"
                  />
                  <circle cx="100" cy="100" r="6" fill="#ff6b35" filter="url(#neonGlow)" />
                  <circle cx="100" cy="100" r="3" fill="#ffffff" />
                </g>
              </svg>
            </div>
            <div className="text-center -mt-4">
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">יתרה בטוחה צפויה</p>
               <div className="text-5xl font-black text-white mt-1 drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] tracking-tighter">
                  ₪{safeBalance.toLocaleString()}
               </div>
               <p className="text-[#22c55e] text-[9px] font-bold mt-2 uppercase tracking-tight">מצב סיכון: תקין</p>
            </div>
          </div>

          {/* כרטיס הוצאות - כתום ענבר */}
          <div className="bg-[#0f2030] border border-[#ef4444]/30 rounded-2xl p-6 text-center shadow-[0_0_25px_rgba(239,68,68,0.2)]">
            <Wallet className="mx-auto mb-3 text-[#ef4444]/50" size={24} />
            <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">סיכום הוצאות</h3>
            <div className="text-4xl font-mono font-black text-[#ef4444]">-₪{spending.toLocaleString()}</div>
          </div>

        </div>

        {/* שורה תחתונה: אזור סיכון וסימולטור */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
          
          {/* גרף Risk Zone - בצבע כחול ציאן */}
          <div className="bg-[#0a0f19] border border-orange-500/20 rounded-3xl p-6 relative shadow-[0_0_30px_rgba(249,115,22,0.15)]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-orange-500 text-[11px] font-bold uppercase tracking-widest">אזור סיכון (Risk Zone)</h3>
              <TrendingUp size={16} className="text-slate-600" />
            </div>
            <div className="h-24 w-full flex items-end gap-1.5 opacity-60">
               {[30, 45, 60, 40, 85, 55, 70, 40].map((h, i) => (
                 <div key={i} className="flex-1 bg-cyan-500/20 border-t-2 border-cyan-400/50" style={{height: `${h}%`}}></div>
               ))}
            </div>
            <div className="mt-4 flex items-center gap-2 text-[10px] text-orange-400/70 font-bold italic uppercase tracking-tighter">
              <ShieldAlert size={14} /> יתרה קריטית צפויה: 25 לחודש
            </div>
          </div>

          {/* סימולטור What If - השדה ריק */}
          <div className="bg-[#0a0f19] border border-cyan-500/30 rounded-3xl p-6 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
            <div className="flex justify-between items-center mb-4 text-cyan-400">
              <h3 className="text-[11px] font-bold uppercase tracking-widest">סימולטור What If</h3>
              <HelpCircle size={18} className="opacity-50" />
            </div>
            <p className="text-[10px] text-slate-500 mb-2 font-bold tracking-tight">הזן הוצאה עתידית לבדיקה:</p>
            <input 
              type="number"
              value={whatIf}
              className="w-full bg-[#040b14] border border-cyan-500/20 rounded-xl p-4 text-cyan-400 text-2xl font-mono focus:outline-none focus:border-cyan-400 transition-all mb-4 shadow-inner"
              placeholder="0.00 ₪"
              onChange={(e) => setWhatIf(e.target.value)}
            />
            <button className="w-full bg-cyan-500/10 border border-cyan-500/40 hover:bg-cyan-500/20 text-cyan-400 font-black py-4 rounded-xl transition-all uppercase text-[10px] tracking-widest">
              חשב סימולציה
            </button>
          </div>

        </div>

        {/* Sync Button */}
        <div className="mt-8 pt-6 border-t border-white/5 flex justify-center">
           <label className="flex items-center gap-3 px-8 py-3 bg-slate-900 border border-white/10 rounded-full cursor-pointer hover:bg-slate-800 transition-all">
             <Upload size={18} className="text-cyan-400" />
             <span className="text-[10px] font-bold uppercase tracking-[0.2em]">סנכרון נתונים מהבנק</span>
             <input type="file" className="hidden" accept=".csv" />
           </label>
        </div>

      </div>
    </div>
  );
}