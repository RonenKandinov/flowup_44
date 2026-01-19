import React, { useMemo } from 'react';
import { Lightbulb } from 'lucide-react';

const LeverageCard = ({ projectedBalance, currentBalance, insights = [] }) => {
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
    
    // 1. Add AI Smart Insights first
    if (insights && insights.length > 0) {
      insights.forEach(insight => {
        if (insight.type === 'alert') {
          recs.push({
            title: insight.title,
            amount: Math.round(insight.impact),
            description: insight.description,
            impact: Math.round(insight.impact * 12),
            icon: '⚠️',
            color: 'red',
            isAI: true
          });
        } else if (insight.type === 'info') {
          recs.push({
            title: insight.title,
            amount: Math.round(insight.impact / 12),
            description: insight.description,
            impact: Math.round(insight.impact),
            icon: '💡',
            color: 'purple',
            isAI: true
          });
        }
      });
    }

    const urgency = projectedBalance < 1000 ? 'high' : projectedBalance < 2000 ? 'medium' : 'low';
    
    // 2. Add standard recommendations if we need more padding
    if (recs.length < 3) {
        recs.push({
          title: 'הגדר חיסכון אוטומטי',
          amount: urgency === 'high' ? 50 : urgency === 'medium' ? 100 : 200,
          description: 'הגדר העברה אוטומטית לחשבון חיסכון בכל תחילת חודש',
          impact: urgency === 'high' ? 600 : urgency === 'medium' ? 1200 : 2400,
          icon: '🏦',
          color: 'blue'
        });
    }
    
    if (recs.length < 3 && currentBalance && projectedBalance) {
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
    
    if (recs.length < 3) {
        recs.push({
          title: 'בדוק תוכניות סלולר וביטוח',
          amount: urgency === 'high' ? 30 : urgency === 'medium' ? 50 : 80,
          description: 'מעבר לחברת סלולר זולה יותר או ביטוח משתלם יכול לחסוך עד',
          impact: urgency === 'high' ? 360 : urgency === 'medium' ? 600 : 960,
          icon: '📱',
          color: 'purple'
        });
    }
    
    return recs.slice(0, 3);
  }, [projectedBalance, currentBalance, insights]);

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

      {/* Carousel on Mobile, List on Desktop */}
      <div className="flex overflow-x-auto pb-4 gap-3 px-4 md:grid md:grid-cols-1 md:gap-3 md:px-4 md:pb-4 snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {recommendations.map((rec, index) => {
          return (
            <div key={index} className="min-w-[80%] md:min-w-0 snap-center p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 hover:border-slate-500 transition-colors flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-start gap-2">
                  <span className="text-lg opacity-90 mt-0.5">{rec.icon}</span>
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-200 text-sm leading-tight">{rec.title}</span>
                  </div>
                </div>
                <span className="text-cyan-400 font-mono text-xs font-bold bg-cyan-950/30 px-1.5 py-0.5 rounded whitespace-nowrap mr-2">₪{rec.amount.toLocaleString('he-IL')}{rec.title.includes('חיסכון') ? '/חודש' : ''}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-2 opacity-90 line-clamp-2">{rec.description}</p>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 border-t border-slate-700/50 pt-2 mt-auto">
                <span>💰 חיסכון שנתי:</span>
                <span className="font-bold text-emerald-400 text-xs">₪{rec.impact.toLocaleString('he-IL')}</span>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="px-3 pb-3">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 text-center">
          <p className="text-xs text-emerald-300 font-medium flex flex-col sm:flex-row items-center justify-center gap-1">
            <span>סה"כ חיסכון פוטנציאלי:</span>
            <span>
              <span className="text-lg font-bold text-emerald-400">₪{recommendations.reduce((sum, r) => sum + r.impact, 0).toLocaleString('he-IL')}</span>
              <span className="text-[10px] mr-1 opacity-80">לשנה</span>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LeverageCard;