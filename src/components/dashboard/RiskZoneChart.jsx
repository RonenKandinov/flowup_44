import React, { useMemo } from 'react';
import { Lightbulb } from 'lucide-react';

const LeverageCard = ({ projectedBalance, currentBalance }) => {
  // אם אין נתונים - לא מציגים כלום
  if (!projectedBalance && projectedBalance !== 0) {
    return null;
  }
  
  // אם היתרה הצפויה מעל 3000 שקלים - מציגים הודעת יציבות
  if (projectedBalance > 3000) {
    return (
      <div className="w-full bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-lg border border-green-200 overflow-hidden p-6" dir="rtl">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
            <span className="text-xl">✓</span>
          </div>
          <h2 className="text-green-800 font-bold text-lg">מצב פיננסי יציב</h2>
        </div>
        <p className="text-green-700 text-sm">היתרה הצפויה שלך מעל ₪3,000 - אין צורך בהמלצות חיסכון כרגע</p>
      </div>
    );
  }

  // חישוב המלצות ספציפיות לפי המצב הפיננסי
  const recommendations = useMemo(() => {
    const recs = [];
    const urgency = projectedBalance < 1000 ? 'high' : projectedBalance < 2000 ? 'medium' : 'low';
    
    // המלצה 1: חיסכון אוטומטי
    recs.push({
      title: 'הגדר חיסכון אוטומטי',
      amount: urgency === 'high' ? 50 : urgency === 'medium' ? 100 : 200,
      description: 'הגדר העברה אוטומטית לחשבון חיסכון בכל תחילת חודש',
      impact: urgency === 'high' ? 600 : urgency === 'medium' ? 1200 : 2400,
      icon: '🏦',
      color: 'blue'
    });
    
    // המלצה 2: צמצום הוצאות
    if (currentBalance && projectedBalance) {
      const monthlyDrop = currentBalance - projectedBalance;
      if (monthlyDrop > 500) {
        recs.push({
          title: 'צמצם הוצאות חודשיות',
          amount: Math.min(Math.round(monthlyDrop * 0.2), 300),
          description: 'זיהינו ירידה חודשית גבוהה - נסה לצמצם הוצאות לא הכרחיות',
          impact: Math.round(monthlyDrop * 0.2 * 12),
          icon: '✂️',
          color: 'red'
        });
      }
    }
    
    // המלצה 3: מעבר לתוכניות זולות יותר
    recs.push({
      title: 'בדוק תוכניות סלולר וביטוח',
      amount: urgency === 'high' ? 30 : urgency === 'medium' ? 50 : 80,
      description: 'מעבר לחברת סלולר זולה יותר או ביטוח משתלם יכול לחסוך עד',
      impact: urgency === 'high' ? 360 : urgency === 'medium' ? 600 : 960,
      icon: '📱',
      color: 'purple'
    });
    
    return recs.slice(0, 3);
  }, [projectedBalance, currentBalance]);

  const colorMap = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-600' },
    red: { bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-600' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-600' }
  };

  return (
    <div className="w-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden" dir="rtl">
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-4 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <Lightbulb className="w-5 h-5 text-white" />
          <h2 className="text-white font-bold text-lg">המלצות חיסכון מותאמות אישית</h2>
        </div>
        <p className="text-cyan-100 text-xs">יתרה צפויה: ₪{projectedBalance?.toLocaleString('he-IL')} - 3 פעולות לשיפור</p>
      </div>

      <div className="p-4 space-y-3">
        {recommendations.map((rec, index) => {
          const colors = colorMap[rec.color];
          return (
            <div key={index} className={`p-3 ${colors.bg} rounded-lg border-r-4 ${colors.border}`}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{rec.icon}</span>
                  <span className="font-bold text-slate-800 text-sm">{rec.title}</span>
                </div>
                <span className={`${colors.text} font-mono text-sm font-bold`}>₪{rec.amount}/חודש</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-tight mb-2">{rec.description}</p>
              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                <span>💰 חיסכון שנתי:</span>
                <span className="font-bold text-green-600">₪{rec.impact.toLocaleString('he-IL')}</span>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="px-4 pb-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <p className="text-xs text-green-800 font-medium">
            סה"כ חיסכון פוטנציאלי: 
            <span className="text-lg font-bold mr-1">₪{recommendations.reduce((sum, r) => sum + r.impact, 0).toLocaleString('he-IL')}</span>
            לשנה
          </p>
        </div>
      </div>
    </div>
  );
};

export default LeverageCard;