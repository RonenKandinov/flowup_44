import React, { useMemo } from 'react';

const LeverageCard = (props) => {
  // 1. איתור נתונים בכל מצב
  const rawData = useMemo(() => {
    // בודק אם הנתונים בתוך data, transactions, או props ישירים
    const possibleData = props.data || props.transactions || props.rows || props.items || props;
    const finalArray = Array.isArray(possibleData) ? possibleData : 
                       (possibleData.data && Array.isArray(possibleData.data) ? possibleData.data : []);
    return finalArray;
  }, [props]);

  // 2. ניתוח הנתונים מה-CSV העברי
  const stats = useMemo(() => {
    if (rawData.length === 0) return null;
    
    let fees = 0;
    let creditTotal = 0;
    let incomeTotal = 0;

    rawData.forEach(row => {
      // הופך הכל לטקסט אחד ארוך כדי לחפש מילים בלי קשר לשם העמודה
      const rowString = JSON.stringify(row);
      
      // מציאת ערכים מספריים בשורה
      const values = Object.values(row).map(v => parseFloat(String(v).replace(/[^\d.-]/g, ''))).filter(v => !isNaN(v));
      const maxVal = Math.max(...values, 0);
      const minVal = Math.min(...values, 0);

      // לוגיקה לפי מילים מהקובץ של רונן
      if (/עמ\'|רבית|ONTIME|ע\.מפעולות/i.test(rowString)) {
          fees += Math.abs(minVal || values[0] || 0);
      }
      if (/ישראכרט|מקס|ויזה|כרטיס/i.test(rowString)) {
          creditTotal += Math.abs(minVal || values[0] || 0);
      }
      if (/bit|משהב\"ט/i.test(rowString)) {
          incomeTotal += Math.max(...values);
      }
    });

    return { fees, creditTotal, incomeTotal, count: rawData.length };
  }, [rawData]);

  // 3. תצוגה
  if (!stats || stats.count === 0) {
    return (
      <div className="p-6 border-2 border-dashed border-blue-200 bg-blue-50 rounded-xl text-center" dir="rtl">
        <p className="text-blue-800 font-bold">ממתין לסנכרון נתונים...</p>
        <p className="text-[10px] text-blue-600 mt-2">ודא שב-Base44 מוגדר: data={" {transactions} "}</p>
        <div className="mt-2 text-[10px] bg-white p-2 rounded text-left overflow-auto max-h-20">
          Debug: {JSON.stringify(Object.keys(props))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden" dir="rtl">
      <div className="bg-slate-900 p-4 border-b border-slate-800">
        <h2 className="text-white font-bold text-lg">פעולות למינוף מיידי</h2>
        <p className="text-blue-400 text-[10px]">ניתוח מותאם אישית עבור {stats.count} תנועות</p>
      </div>

      <div className="p-4 space-y-4">
        {stats.fees > 0 && (
          <div className="p-3 bg-red-50 rounded-lg border-r-4 border-red-500 transition-all">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-slate-800 text-sm">💸 חיסול עמלות עו"ש</span>
              <span className="text-red-600 font-mono text-sm font-bold">{stats.fees.toFixed(2)} ₪</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-tight">זיהינו עמלות "ע.מפעולות". מעבר למסלול דיגיטלי יחסוך לך כ-620 ₪ בשנה.</p>
          </div>
        )}

        {stats.creditTotal > 0 && (
          <div className="p-3 bg-blue-50 rounded-lg border-r-4 border-blue-500">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-slate-800 text-sm">💳 אופטימיזציית אשראי</span>
              <span className="text-blue-600 font-mono text-sm font-bold">{stats.creditTotal.toLocaleString()} ₪</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-tight">שימוש גבוה באשראי (ישראכרט/מקס). כרטיס Cashback יחזיר לך מאות שקלים בשנה.</p>
          </div>
        )}

        {stats.incomeTotal > 0 && (
          <div className="p-3 bg-emerald-50 rounded-lg border-r-4 border-emerald-500">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-slate-800 text-sm">🚀 מינוף הכנסות bit</span>
              <span className="text-emerald-600 text-[10px] font-bold">זוהה</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-tight">נכנסו כספים. המלצה: הגדר הוראת קבע לחיסכון של 10% מכל כניסה.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeverageCard;