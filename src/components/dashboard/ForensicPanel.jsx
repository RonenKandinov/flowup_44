import React from 'react';
import { motion } from 'framer-motion';
import { Search, TrendingDown, AlertTriangle, Coins, Scale } from 'lucide-react';

const fmt = (n) => Math.round(Number(n || 0)).toLocaleString('en-US');

function ForensicCard({ icon: Icon, title, tone, children }) {
  const tones = {
    green: 'border-emerald-500/30 bg-emerald-500/5',
    amber: 'border-amber-500/30 bg-amber-500/5',
    red: 'border-red-500/30 bg-red-500/5',
  };
  const iconTones = { green: 'text-emerald-400', amber: 'text-amber-400', red: 'text-red-400' };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${iconTones[tone]}`} />
        <p className="text-xs font-bold text-white">{title}</p>
      </div>
      <div className="text-[11px] text-slate-400 leading-relaxed space-y-1.5">{children}</div>
    </div>
  );
}

// Forensic Investigation view — signals BDI / credit reports can't see.
// Renders only channels that actually fired; hides itself when nothing detected.
export default function ForensicPanel({ forensic, undeclared }) {
  const f = forensic || {};
  const cards = [];

  if (f.sideIncome?.hasSideIncome) {
    cards.push(
      <ForensicCard key="side" icon={Coins} title="הכנסה צדדית זוהתה" tone="green">
        <p>₪{fmt(f.sideIncome.monthlyTotal)}/חודש מעבר לשכר הבסיס{f.sideIncome.gigEconomyDetected ? ' (כולל פלטפורמות Gig)' : ''}</p>
        {(f.sideIncome.streams || []).slice(0, 3).map((s, i) => (
          <p key={i} className="text-slate-500">• {s.label} — ₪{fmt(s.avgAmount)} ({s.occurrences} מופעים)</p>
        ))}
      </ForensicCard>
    );
  }

  if (f.activityDecline?.detected) {
    cards.push(
      <ForensicCard key="decline" icon={TrendingDown} title={`ירידת פעילות — חומרה ${f.activityDecline.severity}`} tone={f.activityDecline.severity === 'HIGH' ? 'red' : 'amber'}>
        <p>ירידה של {f.activityDecline.incomeDropPct}% בהכנסה החציונית (₪{fmt(f.activityDecline.priorMedianIncome)} → ₪{fmt(f.activityDecline.recentMedianIncome)})</p>
        <p className="text-slate-500">סיגנל מוקדם לעסק מצטמצם — לא ייראה ב-BDI עוד חודשים</p>
      </ForensicCard>
    );
  }

  if (f.earlyDistress?.detected) {
    cards.push(
      <ForensicCard key="distress" icon={AlertTriangle} title={`סימני מצוקה מוקדמים — רמה ${f.earlyDistress.riskLevel}`} tone={f.earlyDistress.riskLevel === 'HIGH' ? 'red' : 'amber'}>
        {(f.earlyDistress.flags || []).map((fl, i) => <p key={i}>• {fl.label}</p>)}
        {f.earlyDistress.leadIndicator && <p className="text-slate-500 pt-1">{f.earlyDistress.leadIndicator}</p>}
      </ForensicCard>
    );
  }

  // Declaration vs Reality — income gap (undeclared income) or expense gap
  if (undeclared?.hasUnreportedInflowIndication) {
    const declared = undeclared.formalIncome || 0;
    const actual = undeclared.actualInflow || 0;
    const maxV = Math.max(declared, actual) || 1;
    cards.push(
      <ForensicCard key="gap" icon={Scale} title="הצהרה מול מציאות — הכנסה" tone="green">
        <div className="space-y-2 pt-1">
          <div>
            <div className="flex justify-between text-[10px] mb-0.5">
              <span>הכנסה מדווחת (שכר)</span><span>₪{fmt(declared)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800"><div className="h-full rounded-full bg-slate-500" style={{ width: `${(declared / maxV) * 100}%` }} /></div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-0.5">
              <span className="text-emerald-300">תזרים נכנס בפועל</span><span className="text-emerald-300">₪{fmt(actual)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(actual / maxV) * 100}%` }} /></div>
          </div>
        </div>
        {undeclared.justificationText && <p className="text-slate-500 pt-2">{undeclared.justificationText}</p>}
      </ForensicCard>
    );
  }

  if (f.declarationGap?.available && f.declarationGap.materialMismatch) {
    cards.push(
      <ForensicCard key="expgap" icon={Scale} title="הצהרה מול מציאות — הוצאות" tone={f.declarationGap.direction === 'UNDER_DECLARED' ? 'red' : 'amber'}>
        <p>הוצאות מוצהרות: ₪{fmt(f.declarationGap.declaredMonthlyExpenses)} | בפועל: ₪{fmt(f.declarationGap.actualMonthlyExpenses)}</p>
        <p>פער של {Math.abs(f.declarationGap.gapPct)}% — {f.declarationGap.direction === 'UNDER_DECLARED' ? 'הצהרת חסר מהותית' : 'הצהרת יתר'}</p>
      </ForensicCard>
    );
  }

  if (cards.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-slate-900/80 to-purple-950/20 backdrop-blur-sm p-5"
      dir="rtl"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl bg-purple-500/15 border border-purple-500/30">
          <Search className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Forensic Intelligence — מה ש-BDI לא רואה</h3>
          <p className="text-[10px] text-slate-500 tracking-wide">סיגנלים ברמת התנועה הבודדת, חודשים לפני שיופיעו בדוח אשראי</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{cards}</div>
    </motion.div>
  );
}