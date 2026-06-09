import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, ShieldCheck, PiggyBank, Repeat, Sparkles, Banknote, CalendarRange, LifeBuoy, ArrowUpDown } from 'lucide-react';

const fmt = (n) => Math.round(Number(n || 0)).toLocaleString('en-US');

function SignalChip({ icon: Icon, title, value, tone = 'green' }) {
  const tones = {
    green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    slate: 'border-slate-600/40 bg-slate-700/20 text-slate-300',
  };
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${tones[tone]}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold leading-tight">{title}</p>
        {value && <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{value}</p>}
      </div>
    </div>
  );
}

export default function PositiveSignalsPanel({ positiveSignals, advancedSignals }) {
  const p = positiveSignals || {};
  const a = advancedSignals || {};

  const chips = [];
  if (p.surplusCreation?.detected) chips.push({ icon: PiggyBank, tone: 'green', title: 'יצירת עודף עקבי', value: `₪${fmt(p.surplusCreation.monthlySurplus)}/חודש (${p.surplusCreation.surplusRatio}% מההכנסה)` });
  if (p.financialDiscipline?.detected) chips.push({ icon: ShieldCheck, tone: 'green', title: 'משמעת פיננסית', value: 'הוצאות יציבות ללא קפיצות אימפולסיביות' });
  if (p.upwardMobility?.detected) chips.push({ icon: TrendingUp, tone: 'cyan', title: 'מוביליות כלפי מעלה', value: `צמיחת הכנסה ${p.upwardMobility.growthPct}%` });
  if (p.incomeMomentum?.direction === 'UP') chips.push({ icon: TrendingUp, tone: 'cyan', title: 'תאוצת הכנסה חיובית', value: `+${p.incomeMomentum.changePct}%` });
  if (p.wealthBuilding?.detected) chips.push({ icon: Sparkles, tone: 'green', title: 'בניית הון', value: `₪${fmt(p.wealthBuilding.monthlyOutflow)}/חודש לחיסכון והשקעות` });
  if (p.resilience?.recovered) chips.push({ icon: LifeBuoy, tone: 'green', title: 'חוסן פיננסי', value: 'התאושש מחודש קשה ללא כניסה למינוס' });

  if (a.cashDependency && a.cashDependency.level !== 'LOW') chips.push({ icon: Banknote, tone: 'amber', title: `תלות במזומן — ${a.cashDependency.level === 'HIGH' ? 'גבוהה' : 'בינונית'}`, value: `${a.cashDependency.cashShare}% מהפעילות במזומן` });
  if (a.seasonality?.detected) chips.push({ icon: CalendarRange, tone: 'amber', title: 'עונתיות זוהתה', value: 'הירידה עשויה להיות מחזורית ולא היחלשות אמיתית' });
  if (a.recovery?.detected) chips.push({ icon: LifeBuoy, tone: 'green', title: 'התאוששות פיננסית', value: 'חזר לתזרים חיובי ובנה מחדש כרית ביטחון' });
  if (a.lifestyleInflation?.detected) chips.push({ icon: ArrowUpDown, tone: 'amber', title: 'אינפלציית אורח חיים', value: `הוצאות +${a.lifestyleInflation.expenseGrowthPct}% מול הכנסה +${a.lifestyleInflation.incomeGrowthPct}%` });
  if (a.reinvestment?.detected) chips.push({ icon: Repeat, tone: 'cyan', title: 'השקעה מחדש', value: `${a.reinvestment.reinvestRatio}% מההכנסה מנותב להשקעה/חיסכון` });

  const opp = p.opportunityScore || 0;
  const hasContent = chips.length > 0 || opp > 0;
  if (!hasContent) return null;

  const oppColor = opp >= 70 ? 'text-emerald-400' : opp >= 40 ? 'text-cyan-400' : 'text-slate-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/80 to-emerald-950/20 backdrop-blur-sm p-5 overflow-hidden"
      dir="rtl"
    >
      <div className="absolute -top-16 -left-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
            <Trophy className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">סיגנלים חיוביים — למה דווקא כן לאשר</h3>
            <p className="text-[10px] text-slate-500 tracking-wide">Positive Underwriting Memo</p>
          </div>
        </div>
        {opp > 0 && (
          <div className="text-center">
            <p className={`text-2xl font-bold ${oppColor}`}>{opp}</p>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider">Opportunity</p>
          </div>
        )}
      </div>

      {opp >= 50 && (
        <div className="relative mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2">
          <p className="text-[11px] text-emerald-200 font-medium leading-snug">
            ⭐ לקוח שנראה טוב יותר מהציון הרשמי שלו — שווה לבחון אישור גם אם מודלים מסורתיים יהססו.
          </p>
        </div>
      )}

      <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {chips.map((c, i) => <SignalChip key={i} {...c} />)}
      </div>
    </motion.div>
  );
}