import React, { useMemo } from 'react';

const LeverageCard = ({ data }) => {
  
  // 1. חישוב הנתונים מתוך הדאטה של המשתמש
  const analysis = useMemo(() => {
    // הגנה מקריסה
    if (!data || !Array.isArray(data)) return { fees: 0, credit: 0, income: 0 };

    let fees = 0;
    let credit = 0;
    let income = 0;

    data.forEach(row => {
      // תמיכה בעברית ואנגלית
      const desc = row['תיאור הפעולה'] || row.description || '';
      const debit = parseFloat(row['חובה'] || row.debit || 0);
      const creditVal = parseFloat(row['זכות'] || row.credit || 0);

      if (/עמ\'|רבית|ONTIME|ע\.מפעולות/i.test(desc)) fees += debit;
      if (/ויזה|ישראכרט|מקס|כרטיס/i.test(desc)) credit += debit;
      if (creditVal > 0) income += creditVal;
    });

    return { fees, credit, income };
  }, [data]);

  // 2. בניית ההמלצות בזמן אמת (פר משתמש)
  const recommendations = useMemo(() => {
    const list = [];

    // המלצה 1: עמלות (מופיע רק אם יש עמלות!)
    if (analysis.fees > 5) {
      list.push({
        id: 'fees', color: 'red', icon: '💸',
        title: 'חיסול עמלות מיותרות',
        val: `${analysis.fees.toFixed(2)} ₪`,
        text: `אתה משלם סתם. מעבר למסלול דיגיטלי יחסוך לך כ-${(analysis.fees * 12).toFixed(0)} ₪ בשנה.`
      });
    }

    // המלצה 2: אשראי (מופיע רק אם יש שימוש גבוה)
    if (analysis.credit > 2000) {
      list.push({
        id: 'credit', color: 'blue', icon: '💳',
        title: 'אופטימיזציית אשראי',
        val: `${analysis.credit.toLocaleString()} ₪`,
        text: `ההוצאה באשראי גבוהה. זה הזמן לבקש כרטיס Cashback ולקבל כסף חזרה.`
      });
    }

    // המלצה 3: השקעות (תמיד טוב)
    if (analysis.income > 0) {
      list.push({
        id: 'invest', color: 'emerald', icon: '📈',
        title: 'מנוע צמיחה אוטומטי',
        val: 'פעיל',
        text: `הכסף סתם שוכב? הגדר 10% מההכנסות להשקעה אוטומטית.`
      });
    }

    return list;
  }, [analysis]);

  // אם אין דאטה בכלל
  if (!data || !Array.isArray(data)) return null;

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden font-sans" dir="rtl">
      
      {/* כותרת */}
      <div className="bg-slate-900 px-5 py-3 border-b border-slate-800">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
          <span>🚀</span> פעולות למינוף מיידי
        </h3>
      </div>

      {/* גוף הכרטיס - מציג רק מה שרלוונטי למשתמש */}
      <div className="p-4 space-y-3">
        {recommendations.length > 0 ? (
          recommendations.map((rec) => (
            <div key={rec.id} className={`bg-${rec.color}-50 p-3 rounded-lg border-r-4 border-${rec.color}-500`}>
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-slate-800 text-sm flex gap-2">
                  <span>{rec.icon}</span> {rec.title}
                </h4>
                <span className={`text-xs font-mono bg-white px-1 rounded text-${rec.color}-600 border border-${rec.color}-100`}>
                  {rec.val}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {rec.text}
              </p>
            </div>
          ))
        ) : (
          <div className="text-center py-4 text-slate-500 text-sm">
            ✅ מצבך הפיננסי מצוין! אין פעולות מינוף דחופות כרגע.
          </div>
        )}
      </div>
    </div>
  );
};

export default LeverageCard;