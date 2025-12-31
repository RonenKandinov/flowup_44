import React, { useMemo } from 'react';

const LeverageCard = ({ data }) => {
  
  const stats = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return null;
    
    return data.reduce((acc, row) => {
      // זיהוי גמיש של שדות
      const desc = row['תיאור הפעולה'] || row.description || '';
      const debit = parseFloat(row['חובה'] || row.debit || 0);
      const credit = parseFloat(row['זכות'] || row.credit || 0);
      
      // התאמה למילים הספציפיות בקובץ שלך
      if (/עמ\'|רבית|ONTIME|ע\.מפעולות/i.test(desc)) acc.fees += debit;
      if (/ישראכרט|מקס|ויזה|כרטיס/i.test(desc)) acc.credit += debit;
      if (/bit|משהב\"ט|העברת כסף/i.test(desc)) acc.income += credit;
      
      return acc;
    }, { fees: 0, credit: 0, income: 0 });
  }, [data]);

  if (!stats) return <div className="p-4 text-center text-slate-400">טוען נתונים...</div>;

  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden font-sans" dir="rtl">
      <div className="bg-slate-900 p-4 font-bold text-white text-lg">
        פעולות למינוף מיידי
      </div>
      
      <div className="p-4 space-y-3">
        {/* המלצה 1: עמלות - מבוסס על ה-51 ש"ח שמצאנו */}
        {stats.fees > 0 && (
          <div className="p-3 bg-red-50 rounded-lg border-r-4 border-red-500">
            <div className="flex justify-between font-bold text-slate-800 text-sm">
              <span>💸 חיסול עמלות עו"ש</span>
              <span className="text-red-600">{stats.fees.toFixed(2)} ₪</span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              זיהינו עמלות שורה וריביות. מעבר למסלול דיגיטלי יחסוך לך כ-600 ₪ בשנה.
            </p>
          </div>
        )}

        {/* המלצה 2: אשראי - מבוסס על ה-3,400 ש"ח שמצאנו */}
        {stats.credit > 0 && (
          <div className="p-3 bg-blue-50 rounded-lg border-r-4 border-blue-500">
            <div className="flex justify-between font-bold text-slate-800 text-sm">
              <span>💳 אופטימיזציית אשראי</span>
              <span className="text-blue-600">{stats.credit.toLocaleString()} ₪</span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              שימוש גבוה באשראי. כרטיס Cashback יחזיר לך כ-420 ₪ בשנה מזומן.
            </p>
          </div>
        )}

        {/* המלצה 3: הכנסות - מבוסס על ה-bit והמשהב"ט */}
        {stats.income > 0 && (
          <div className="p-3 bg-emerald-50 rounded-lg border-r-4 border-emerald-500">
            <div className="flex justify-between font-bold text-slate-800 text-sm">
              <span>📈 מינוף כספי bit והכנסות</span>
              <span className="text-emerald-600">בוצע</span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              נכנסו לך כספים (bit/משהב"ט). המלצה: העבר 10% אוטומטית לחיסכון מניב.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeverageCard;