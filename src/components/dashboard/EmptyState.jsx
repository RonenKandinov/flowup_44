import React from 'react';
import { motion } from 'framer-motion';
import { Activity, BarChart3, FileCheck2, GitBranch, ShieldCheck, TrendingUp, Users } from 'lucide-react';

export default function EmptyState() {
  const analystModules = [
    { icon: Users, title: 'ניהול לקוחות', text: 'בחר או חבר לקוח חדש כדי להתחיל תהליך חיתום מבוסס Open Finance.' },
    { icon: BarChart3, title: 'תובנות חיתום', text: 'לאחר חיבור לקוח יוצגו DSR, DTI, נזילות, דגלי סיכון וציון FlowUp.' },
    { icon: GitBranch, title: 'אופטימיזציית אישור', text: 'המנוע מציע חלופות מימון במקום החלטת כן/לא בינארית.' }
  ];

  const steps = ['לחץ על “חבר לקוח” בראש המסך', 'שלח ללקוח קישור אימות מאובטח', 'המתן לניתוח והמשך לבדיקה אנליטית'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-[60vh] px-4 py-8 text-right"
      dir="rtl"
    >
      <div className="max-w-5xl mx-auto space-y-8">
        <section className="rounded-3xl border border-slate-800/70 bg-slate-900/55 p-6 md:p-8 backdrop-blur-sm shadow-2xl shadow-slate-950/30">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-4 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
                <Activity className="w-3.5 h-3.5" />
                עמדת אנליסט FlowUp
              </div>
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">ברוך הבא לדשבורד החיתום</h2>
                <p className="mt-3 text-slate-400 leading-7">
                  כאן מתחילים בדיקת לקוח, צופים בתובנות התנהגותיות, ומנתחים יכולת שירות חוב על בסיס נתוני Open Finance אמיתיים.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-blue-500/25 bg-blue-500/10 p-5 min-w-[220px]">
              <p className="text-xs text-blue-300 mb-2">הפעולה הבאה</p>
              <p className="text-lg font-semibold text-white">חבר לקוח חדש מהכפתור העליון</p>
              <p className="text-sm text-slate-400 mt-2">האנליסט לא מחבר חשבון אישי — הלקוח מאשר את החיבור בקישור מאובטח.</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {analystModules.map((module, index) => (
            <motion.div
              key={module.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.08 }}
              className="rounded-2xl border border-slate-800/70 bg-slate-900/45 p-5 backdrop-blur-sm"
            >
              <module.icon className="w-5 h-5 text-cyan-300 mb-4" />
              <h3 className="font-semibold text-white mb-2">{module.title}</h3>
              <p className="text-sm leading-6 text-slate-400">{module.text}</p>
            </motion.div>
          ))}
        </div>

        <section className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/45 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <FileCheck2 className="w-5 h-5 text-emerald-300" />
              <h3 className="font-semibold text-white">תהליך עבודה מומלץ</h3>
            </div>
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-xl bg-slate-950/45 border border-slate-800/60 p-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-300 text-xs font-bold">{index + 1}</span>
                  <span className="text-sm text-slate-300">{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/45 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-blue-300" />
              <h3 className="font-semibold text-white">עקרונות ניתוח</h3>
            </div>
            <ul className="space-y-3 text-sm text-slate-400 leading-6">
              <li>• מקור נתונים יחיד: תנועות Open Finance ותמונת מצב פיננסית.</li>
              <li>• שקיפות מלאה: גורמי XAI חיוביים ושליליים לכל החלטה.</li>
              <li>• פרטיות: נרטיבים רגישים נשמרים מוצפנים, נתונים מובנים נשמרים לניתוח.</li>
            </ul>
            <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
              <TrendingUp className="w-3.5 h-3.5" />
              מותאם ל־Behavioral Underwriting ו־Approval Optimization
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
}