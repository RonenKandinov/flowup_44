import React, { useState, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Upload, ShieldCheck, Wallet, ArrowDownLeft } from 'lucide-react';

const FlowUpDashboard = () => {
  // State for balances
  const [currentBalance, setCurrentBalance] = useState(715.81);
  const [safeBalance, setSafeBalance] = useState(617);
  const [isWarning, setIsWarning] = useState(true);
  
  const fileInputRef = useRef(null);

  // Gauge Data Calculation
  // We assume 2000 is the max for the gauge visualization
  const maxVal = 2000;
  const gaugeVal = Math.min(safeBalance, maxVal);
  const remaining = maxVal - gaugeVal;
  
  const data = [
    { name: 'Safe', value: gaugeVal },
    { name: 'Empty', value: remaining }
  ];

  // Logic Engine: Process CSV
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const rows = text.split('\n');
      
      // Simple parsing logic based on your bank file structure
      // Taking the last non-empty row
      const validRows = rows.filter(r => r.trim() !== '');
      const lastRow = validRows[validRows.length - 1];
      const columns = lastRow.split(',');
      
      // Extract balance (assuming column index 8 usually holds the balance)
      // Cleaning '₪' and commas
      let rawBalance = columns[8] || "0"; 
      let cleanBalance = parseFloat(rawBalance.replace(/[₪,]/g, ''));
      
      if (isNaN(cleanBalance)) cleanBalance = 715.81; // Fallback if parsing fails

      // THE ENGINE LOGIC:
      // 1. Calculate Monthly Trend (Fixed 0.91 for demo or calculated)
      const dailyTrend = 0.91; 
      const projected = cleanBalance + (dailyTrend * 30);
      
      // 2. Apply 17% Protection Rule
      const safe = Math.floor(projected * 0.83);

      // Update State
      setCurrentBalance(cleanBalance);
      setSafeBalance(safe);
      setIsWarning(safe < 1000); // Warning logic
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 font-sans selection:bg-cyan-500/30" dir="rtl">
      
      {/* Navbar / Header area */}
      <div className="p-6 flex justify-center">
        <h1 className="text-slate-500 text-xs tracking-[0.3em] uppercase opacity-50">FlowUp Financial Engine</h1>
      </div>

      {/* Main Content Container */}
      <div className="max-w-md mx-auto px-6 mt-4">
        
        {/* Top Stats Row: Right (Current) vs Left (Safe) */}
        <div className="flex justify-between items-end mb-12">
          
          {/* Right: Current Balance */}
          <div className="text-right">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Wallet size={16} />
              <span className="text-sm font-medium">בנק (נוכחי)</span>
            </div>
            <div className="text-3xl font-bold text-white tracking-tight">
              ₪{currentBalance.toLocaleString()}
            </div>
          </div>

          {/* Left: Safe Balance (The Hero) */}
          <div className="text-left relative">
            <div className="absolute -inset-4 bg-cyan-500/10 blur-xl rounded-full opacity-50"></div>
            <div className="relative">
              <div className="flex items-center justify-end gap-2 text-cyan-400 mb-1">
                <span className="text-sm font-medium">יתרה בטוחה</span>
                <ShieldCheck size={16} />
              </div>
              <div className="text-4xl font-bold text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] tracking-tight">
                ₪{safeBalance.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Center: The Gauge (Speedometer) */}
        <div className="relative h-64 flex flex-col items-center justify-center mb-8">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="70%"
                startAngle={180}
                endAngle={0}
                innerRadius={80}
                outerRadius={110}
                paddingAngle={0}
                stroke="none"
                dataKey="value"
              >
                {/* Dynamic Color: Orange if warning, Cyan if safe */}
                <Cell fill={isWarning ? "#f59e0b" : "#06b6d4"} /> 
                <Cell fill="#1e293b" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          
          {/* Gauge Center Text */}
          <div className="absolute bottom-10 flex flex-col items-center">
             <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">תחזית מוגנת</div>
             <div className={`text-2xl font-bold ${isWarning ? 'text-amber-500' : 'text-cyan-500'}`}>
               {isWarning ? 'Warning Zone' : 'Safe Zone'}
             </div>
             <div className="text-[10px] text-slate-600 mt-1">17% מקדם ביטחון הופעל</div>
          </div>
        </div>

        {/* Action Area: Logic Sync / Upload */}
        <div className="mt-8">
          <div 
            onClick={() => fileInputRef.current.click()}
            className="group cursor-pointer relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 transition-all duration-300 p-6 text-center"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 rounded-full bg-slate-800 group-hover:bg-cyan-500/20 transition-colors">
                <Upload size={20} className="text-slate-400 group-hover:text-cyan-400" />
              </div>
              <div>
                <h3 className="text-slate-200 font-medium text-sm">סנכרון נתונים חכם</h3>
                <p className="text-slate-500 text-xs mt-1">העלה דף חשבון (CSV) לחישוב מחדש</p>
              </div>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".csv" 
              className="hidden" 
            />
          </div>
        </div>

      </div>
    </div>
  );
};

export default FlowUpDashboard;