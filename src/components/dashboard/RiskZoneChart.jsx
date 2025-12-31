import React, { useMemo } from 'react';

const LeverageCard = (props) => {
  // 1. ניסיון אגרסיבי למצוא את הנתונים
  const rawData = useMemo(() => {
    // בודק את כל האפשרויות של Base44
    const data = props.data || props.transactions || props.rows || props.items || (props.payload && props.payload.data);
    
    // אם זה מגיע כטקסט (JSON), ננסה להמיר לאובייקט
    if (typeof data === 'string') {
      try { return JSON.parse(data); } catch (e) { return []; }
    }
    return Array.isArray(data) ? data : [];
  }, [props]);

  // 2. ניתוח הנתונים (עם התאמה מלאה לקובץ של רונן)
  const stats = useMemo(() => {
    if (rawData.length === 0) return null;
    
    let fees = 0;
    let creditTotal = 0;
    let incomeTotal = 0;

    rawData.forEach(row => {
      // ניקוי שמות עמודות בעברית (מטפל בבעיית הקידוד של CSV)
      const keys = Object.keys(row);
      const descKey = keys.find(k => k.includes('תיאור') || k.includes('Description')) || '';
      const debitKey = keys.find(k => k.includes('חובה') || k.includes('Debit')) || '';
      const creditKey = keys.find(k => k.includes('זכות') || k.includes('Credit')) || '';

      const desc = String(row[descKey] || "").trim();
      const debit = parseFloat(String(row[debitKey] || 0).replace(/[^\d.-]/g, '')) || 0;
      const credit = parseFloat(String(row[creditKey] || 0).replace(/[^\d.-]/g, '')) || 0;
      
      // סינון לפי התנועות של רונן
      if (/עמ\'|רבית|ONTIME|ע\.מפעולות/i.test(desc)) fees += debit;
      if (/ישראכרט|מקס|ויזה|כרטיס/i.test(desc)) creditTotal += debit;
      if (/bit|משהב\"ט/i.test(desc) || credit > 0) incomeTotal += credit;
    });

    return { fees, creditTotal, incomeTotal, count: rawData.length };
  }, [rawData]);

  // הודעת שגיאה חכמה שתגיד לנו מה הבעיה
  if (!stats) {
    return (
      <div className="p-4 border-2 border-red-200 bg-red-50 rounded-lg text-right" dir="rtl">
        <p className="text-red-700 font-bold text-sm">המערכת לא זיהתה נתונים :(</p>
        <p className="text-xs text-red-600 mt-1">
          Base44 שלח לקומפוננטה: {Object.keys(props).join(', ') || 'כלום'}
        </p>
        <p className="text-[10px] text-gray-400 mt-2">ודא שאתה מעביר data={" {transactions} "} ב-Editor</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden font-sans" dir="rtl">
      <div className="bg-slate-900 p-4">
        <h2 className="text-white font-bold">פעולות למינוף מיידי</h2>
        <span className="text-[10px] text-blue-400">זוהו {stats.count} תנועות מהחשבון</span>
      </div>

      <div className="p-4 space-y-4">
        {stats.fees > 0 && (
          <div className="p-3 bg-red-50 rounded-lg border-r-4 border-red-500">
            <div className="flex justify-between text-sm font-bold">
              <span>💸 ביטול עמלות עו"ש</span>
              <span className="text-red-600">{stats.fees.toFixed(2)} ₪</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1">נמצאו עמלות שורה. מעבר למסלול דיגיטלי יחסוך כ-620 ₪ בשנה.</p>
          </div>
        )}

        {stats.creditTotal > 0 && (
          <div className="p-3 bg-blue-50 rounded-lg border-r-4 border-blue-500">
            <div className="flex justify-between text-sm font-bold">
              <span>💳 אופטימיזציית אשראי</span>
              <span className="text-blue-600">{stats.creditTotal.toLocaleString()} ₪</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1">שימוש גבוה באשראי. כרטיס Cashback יחזיר לך מאות שקלים בשנה.</p>
          </div>
        )}

        {stats.incomeTotal > 0 && (
          <div className="p-3 bg-emerald-50 rounded-lg border-r-4 border-emerald-500">
            <div className="flex justify-between text-sm font-bold">
              <span>🚀 מינוף כניסות כספים</span>
              <span className="text-emerald-600">זוהו הכנסות</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1">הגדר 10% מכל כניסת bit או משכורת לחיסכון מניב ריבית.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeverageCard;