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
    <div className="w-full bg-slate-800/40 rounded-xl border border-slate-700/40 overflow-hidden" dir="rtl">
      <div className="px-5 py-4 border-b border-slate-700/40">
        <div className="flex items-center gap-2.5 mb-1">
          <Lightbulb className="w-5 h-5 text-cyan-400" />
          <h2 className="text-slate-100 font-bold text-lg">המלצות חיסכון</h2>
        </div>
        <p className="text-slate-400 text-sm">יתרה צפויה: ₪{projectedBalance?.toLocaleString('he-IL')}</p>
      </div>

      <div className="p-4 flex md:block gap-3 md:gap-0 md:space-y-3 overflow-x-auto snap-x snap-mandatory pb-4 hide-scrollbar">
        {recommendations.map((rec, index) => {
          return (
            <div key={index} className="min-w-[85%] md:min-w-0 snap-center p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60 hover:border-slate-500 transition-colors">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2 md:gap-3">
                  <span className="text-xl opacity-90">{rec.icon}</span>
                  <span className="font-bold text-slate-200 text-base">{rec.title}</span>
                </div>
                <span className="text-cyan-400 font-mono text-xs md:text-sm font-bold bg-cyan-950/30 px-2 py-1 rounded">₪{rec.amount}/חודש</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed mb-2 pr-1 opacity-90 line-clamp-2 md:line-clamp-none">{rec.description}</p>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 border-t border-slate-700/50 pt-2 mt-1">
                <span>💰 חיסכון שנתי מוערך:</span>
                <span className="font-bold text-emerald-400 text-sm">₪{rec.impact.toLocaleString('he-IL')}</span>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="px-4 pb-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
          <p className="text-sm text-emerald-300 font-medium">
            סה"כ חיסכון פוטנציאלי: 
            <span className="text-xl font-bold mr-1.5 text-emerald-400">₪{recommendations.reduce((sum, r) => sum + r.impact, 0).toLocaleString('he-IL')}</span>
            לשנה
          </p>
        </div>
      </div>
    </div>
  );
};

export default LeverageCard;