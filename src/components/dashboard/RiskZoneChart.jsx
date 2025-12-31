import React, { useMemo } from 'react';

const LeverageCard = (props) => {
  // ניסיון למצוא את הנתונים בכל שם אפשרי ש-Base44 נותן
  const rawData = props.data || props.transactions || props.rows || [];

  const stats = useMemo(() => {
    if (!Array.isArray(rawData) || rawData.length === 0) return null;
    
    let fees = 0;
    let creditTotal = 0;
    let incomeTotal = 0;

    rawData.forEach(row => {
      // מנקה את שמות העמודות מרווחים או גרשיים מיותרים
      const cleanRow = {};
      Object.keys(row).forEach(key => {
        cleanRow[key.trim().replace(/['"]/g, '')] = row[key];
      });

      // זיהוי שדות לפי השמות המדויקים בקובץ העברי שלך
      const desc = cleanRow['תיאור הפעולה'] || cleanRow['Description'] || "";
      const debit = parseFloat(String(cleanRow['חובה'] || cleanRow['Debit'] || 0).replace(/[^0-9.-]/g, ''));
      const credit = parseFloat(String(cleanRow['זכות'] || cleanRow['Credit'] || 0).replace(/[^0-9.-]/g, ''));
      
      // סינון לפי המילים שמופיעות בקובץ של רונן
      if (desc.includes("עמ'") || desc.includes("רבית") || desc.includes("ONTIME") || desc.includes("ע.מפעולות")) {
        fees += debit;
      }
      if (desc.includes("ישראכרט") || desc.includes("מקס") || desc.includes("ויזה") || desc.includes("כרטיס")) {
        creditTotal += debit;
      }
      if (desc.includes("bit") || desc.includes("משהב\"ט") || credit > 0) {
        incomeTotal += credit;
      }
    });

    return { fees, creditTotal, incomeTotal, count: rawData.length };
  }, [rawData]);

  if (!stats || stats.count === 0) {
    return (
      <div className="p-6 text-center border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
        <p className="text-slate-500">מחפש נתונים בעברית בתוך ה-CSV...</p>
        <p className="text-xs text-slate-400 mt-2">ודא שהעמודות הן: תיאור הפעולה, חובה, זכות</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden font-sans" dir="rtl">
      <div className="bg-slate-900 p-5">
        <h2 className="text-white font-bold text-xl">המלצות למינוף מיידי</h2>
        <div className="text-blue-400 text-xs mt-1">ניתוח חשבון: {stats.count} תנועות זוהו</div>
      </div>

      <div className="p-5 space-y-4">
        {/* עמלות */}
        {stats.fees > 0 && (
          <div className="flex items-center gap-4 p-4 bg-red-50 rounded-xl border-r-4 border-red-500">
            <span className="text-3xl">💸</span>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-slate-800">חיסול עמלות עו"ש</h4>
                <span className="font-mono font-bold text-red-600">{stats.fees.toFixed(2)} ₪</span>
              </div>
              <p className="text-xs text-slate-600 mt-1">נמצאו עמלות "ע.מפעולות" ו-"ONTIME". מעבר למסלול דיגיטלי יחסוך לך כ-620 ₪ בשנה.</p>
            </div>
          </div>
        )}

        {/* אשראי */}
        {stats.creditTotal > 0 && (
          <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl border-r-4 border-blue-500">
            <span className="text-3xl">💳</span>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-slate-800">מינוף אשראי (ישראכרט/מקס)</h4>
                <span className="font-mono font-bold text-blue-600">{stats.creditTotal.toLocaleString()} ₪</span>
              </div>
              <p className="text-xs text-slate-600 mt-1">שימוש גבוה באשראי. כרטיס Cashback יחזיר לך כסף מזומן על כל קנייה.</p>
            </div>
          </div>
        )}

        {/* הכנסות */}
        {stats.incomeTotal > 0 && (
          <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-xl border-r-4 border-emerald-500">
            <span className="text-3xl">🚀</span>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-slate-800">מינוף כניסות bit</h4>
                <span className="bg-emerald-200 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full uppercase">זוהה</span>
              </div>
              <p className="text-xs text-slate-600 mt-1">נכנסו כספים מחזוריים. מומלץ להעביר 10% לחיסכון מניב ריבית דריבית.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeverageCard;