import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, CreditCard, Wallet, AlertTriangle, Phone, Shield, Tv, ChevronDown, ChevronUp } from 'lucide-react';

const LeverageCard = ({ projectedBalance, currentBalance, insights = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkScreen = () => {
      const desktop = window.innerWidth >= 768;
      setIsDesktop(desktop);
      if (desktop) setIsOpen(true);
    };
    
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  // חישוב המלצות ספציפיות לפי המצב הפיננסי
  const recommendations = useMemo(() => {
    const recs = [];
    
    // 1. Add AI Smart Insights first
    if (insights && insights.length > 0) {
      insights.forEach(insight => {
        if (insight.type === 'spotlight') {
             recs.unshift({ // Add to top
                 title: 'שים לב: חריגה מהשגרה',
                 amount: Math.round(insight.impact),
                 description: insight.description,
                 impact: Math.round(insight.impact), // One-time impact mainly
                 icon: <Lightbulb className="w-5 h-5 text-yellow-400" />,
                 color: 'yellow',
                 isSpotlight: true,
                 isAI: true
             });
        } else if (insight.type === 'alert') {
          recs.push({
            title: insight.title,
            amount: Math.round(insight.impact),
            description: insight.description,
            impact: Math.round(insight.impact * 12),
            icon: <AlertTriangle className="w-5 h-5 text-red-400" />,
            color: 'red',
            isAI: true
          });
        } else if (insight.type === 'info') {
            // Map icon string back to component if needed
            let IconComp = CreditCard;
            if (insight.icon === 'Phone') IconComp = Phone;
            if (insight.icon === 'Shield') IconComp = Shield;
            if (insight.icon === 'Tv') IconComp = Tv;
            if (insight.icon === 'Wallet') IconComp = Wallet;

          recs.push({
            title: insight.title,
            amount: Math.round(insight.impact / 12),
            description: insight.description,
            impact: Math.round(insight.impact),
            icon: <IconComp className="w-5 h-5 text-purple-400" />,
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
          icon: <Wallet className="w-5 h-5 text-blue-400" />,
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
          icon: <Wallet className="w-5 h-5 text-red-400" />,
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
          icon: <Wallet className="w-5 h-5 text-purple-400" />,
          color: 'purple'
        });
    }
    
    return recs.slice(0, 3);
  }, [projectedBalance, currentBalance, insights]);

  // אם אין נתונים - לא מציגים כלום
  if (!projectedBalance && projectedBalance !== 0) {
    return null;
  }

  // High balance optimization recommendations
  if (projectedBalance > 3000 && recommendations.length < 2) {
     recommendations.push({
       title: 'הגדל את החיסכון החודשי',
       amount: 500,
       description: 'המצב היציב מאפשר לך להפריש יותר לחיסכון או השקעה',
       impact: 6000,
       icon: <Wallet className="w-5 h-5 text-emerald-400" />,
       color: 'green'
     });

     recommendations.push({
       title: 'בדיקת תיק השקעות',
       amount: 200,
       description: 'זה הזמן לבדוק ערוצי השקעה לכסף הפנוי שלך',
       impact: 2400,
       icon: <Shield className="w-5 h-5 text-emerald-400" />,
       color: 'green'
     });
  }

  const colorMap = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-600' },
    red: { bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-600' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-600' }
  };

  return (
    <div className="w-full bg-slate-800/40 rounded-xl border border-slate-700/40 overflow-hidden" dir="rtl">
      {/* Collapsible Header */}
      <div 
        className={`px-5 py-4 border-b border-slate-700/40 transition-colors ${!isDesktop ? 'cursor-pointer hover:bg-slate-800/50' : ''}`}
        onClick={() => !isDesktop && setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
                <Lightbulb className="w-5 h-5 text-cyan-400" />
                <div>
                    <h2 className="text-white text-sm font-medium uppercase tracking-wide leading-none">המלצות חיסכון</h2>
                </div>
            </div>
            {!isDesktop && (isOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />)}
        </div>
      </div>

      <AnimatePresence>
        {(isOpen || isDesktop) && (
            <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
            >
                {/* Mobile: Grid (Compact), Desktop: List (Original) */}
                <div className="grid grid-cols-2 gap-3 px-4 py-4 md:grid-cols-1 md:gap-3">
                    {recommendations.map((rec, index) => {
                    return (
                        <div key={index} className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 hover:border-slate-500 hover:bg-slate-800 transition-all flex flex-col justify-between h-32 md:h-auto md:min-h-[100px] md:flex-row md:items-center md:gap-4">
                        
                        {/* Header / Main Info */}
                        <div className="flex flex-col md:flex-row md:items-center md:flex-1 md:gap-4">
                            <div className="flex justify-between items-start mb-1 md:mb-0 md:justify-start md:gap-3 md:w-1/3">
                                <div className="flex items-start gap-2 max-w-[85%] md:max-w-none md:items-center">
                                    <span className="opacity-90 mt-0.5 md:mt-0 shrink-0">{rec.icon}</span>
                                    <span className="font-bold text-slate-200 text-xs md:text-sm leading-tight line-clamp-2">{rec.title}</span>
                                </div>
                                {/* Price on Mobile Top Right */}
                                <span className="md:hidden text-cyan-400 font-mono text-[10px] font-bold bg-cyan-950/30 px-1.5 py-0.5 rounded whitespace-nowrap">₪{rec.amount}</span>
                            </div>
                            
                            {/* Description */}
                            <div className="md:flex-1">
                                {rec.isSpotlight ? (
                                    <div className="text-[11px] md:text-xs text-slate-300 leading-relaxed whitespace-pre-line p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                                        {rec.description}
                                    </div>
                                ) : (
                                    <p className="text-[11px] md:text-xs text-slate-400 leading-snug mb-1 md:mb-0 opacity-90 line-clamp-2 md:line-clamp-none">
                                        {rec.description}
                                    </p>
                                )}
                            </div>
                        </div>
                        
                        {/* Footer / Stats */}
                        <div className="flex items-center justify-between border-t border-slate-700/50 pt-1.5 mt-auto md:border-t-0 md:pt-0 md:mt-0 md:w-auto md:gap-6 md:justify-end">
                            {/* Price on Desktop (In flow) */}
                            <span className="hidden md:block text-cyan-400 font-mono text-xs font-bold bg-cyan-950/30 px-2 py-1 rounded whitespace-nowrap">₪{rec.amount}</span>

                            <div className="flex items-center gap-1.5 md:flex-col md:items-end md:gap-0">
                                <span className="text-[10px] text-slate-500 md:text-[10px] md:uppercase md:tracking-wider">חיסכון שנתי</span>
                                <span className="font-bold text-emerald-400 text-xs md:text-sm">₪{rec.impact.toLocaleString('he-IL')}</span>
                            </div>
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
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeverageCard;