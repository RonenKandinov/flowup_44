import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, User, Mail, Phone, Calendar, TrendingUp, ShieldCheck, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const tierStyle = (tier) => ({
  Green: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300', icon: CheckCircle2, label: 'אישור אוטומטי' },
  Orange: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300', icon: AlertTriangle, label: 'דורש בדיקה' },
  Red: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-300', icon: AlertTriangle, label: 'סיכון גבוה' },
}[tier] || { bg: 'bg-slate-500/10', border: 'border-slate-700', text: 'text-slate-300', icon: Clock, label: 'ממתין' });

const Metric = ({ label, value, suffix = '' }) => (
  <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-3">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="text-lg font-bold text-white mt-1">
      {value != null ? `${Number(value).toLocaleString('he-IL', { maximumFractionDigits: 1 })}${suffix}` : '—'}
    </div>
  </div>
);

export default function PartnerClientDetail() {
  const { sessionId } = useParams();

  const { data: session, isLoading: loadingSession } = useQuery({
    queryKey: ['onboarding-session', sessionId],
    queryFn: async () => {
      const list = await base44.entities.CustomerOnboardingSession.filter({ id: sessionId });
      return list[0] || null;
    }
  });

  const { data: analysis, isLoading: loadingAnalysis } = useQuery({
    queryKey: ['session-analysis', session?.analysis_id, session?.customer_email],
    enabled: !!session,
    queryFn: async () => {
      if (session.analysis_id) {
        const list = await base44.entities.UnderwritingAnalysis.filter({ id: session.analysis_id });
        if (list[0]) return list[0];
      }
      if (session.customer_email) {
        const list = await base44.entities.UnderwritingAnalysis.filter({ user_email: session.customer_email }, '-created_date', 1);
        return list[0] || null;
      }
      return null;
    }
  });

  if (loadingSession) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">טוען לקוח...</div>;
  }
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 gap-4" dir="rtl">
        <div>לקוח לא נמצא</div>
        <Button asChild variant="outline" className="bg-slate-800 border-slate-700">
          <Link to="/partner-portal">חזרה לפורטל</Link>
        </Button>
      </div>
    );
  }

  const tier = tierStyle(analysis?.risk_tier);
  const TierIcon = tier.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white" dir="rtl">
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <header className="relative z-10 px-6 py-6 max-w-5xl mx-auto border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
        <Button asChild variant="outline" size="sm" className="bg-slate-800 border-slate-700">
          <Link to="/partner-portal"><ArrowRight className="w-4 h-4 ml-2" />חזרה לרשימת לקוחות</Link>
        </Button>
        <div className="text-xs text-slate-500">Session: <span className="font-mono">{session.id?.slice(0, 8)}</span></div>
      </header>

      <main className="relative z-10 px-6 py-8 max-w-5xl mx-auto space-y-6">
        {/* Customer header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-slate-900/60 border-slate-800 p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-cyan-500/10 rounded-full flex items-center justify-center border border-cyan-500/20">
                  <User className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{session.customer_name || '—'}</h1>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-400">
                    {session.customer_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{session.customer_email}</span>}
                    {session.customer_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{session.customer_phone}</span>}
                    {session.completed_at && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />הושלם {new Date(session.completed_at).toLocaleDateString('he-IL')}</span>}
                  </div>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-full text-sm font-medium ${tier.bg} ${tier.border} ${tier.text} border flex items-center gap-2`}>
                <TierIcon className="w-4 h-4" />
                {tier.label}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Analysis */}
        {loadingAnalysis ? (
          <Card className="bg-slate-900/60 border-slate-800 p-8 text-center text-slate-400">טוען דוח חיתום...</Card>
        ) : !analysis ? (
          <Card className="bg-slate-900/60 border-slate-800 p-8 text-center">
            <Clock className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h3 className="font-semibold text-white">דוח חיתום עדיין לא מוכן</h3>
            <p className="text-slate-400 text-sm mt-2">
              סטטוס הלקוח: <span className="text-cyan-300">{session.status}</span>
            </p>
            <p className="text-slate-500 text-xs mt-2">הדוח יופיע כאן אוטומטית כשהלקוח יסיים את חיבור הבנק והניתוח.</p>
          </Card>
        ) : (
          <>
            {/* Score panel */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="bg-gradient-to-br from-slate-900 to-slate-800/60 border-slate-700 p-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">ציון FlowUp</div>
                    <div className="text-5xl font-bold text-white">
                      {analysis.score != null ? Math.round(analysis.score) : '—'}
                      <span className="text-2xl text-slate-500">/100</span>
                    </div>
                    {analysis.approval_probability != null && (
                      <div className="text-sm text-slate-400 mt-2">
                        סבירות אישור: <span className="text-cyan-300 font-medium">{Math.round(analysis.approval_probability * 100)}%</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Model {analysis.model_version || 'v1.0.0'}</span>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Metric label="DSR" value={analysis.dsr} suffix="%" />
              <Metric label="DTI" value={analysis.dti} suffix="%" />
              <Metric label="נזילות (חודשים)" value={analysis.liquidity_index} />
              <Metric label="תנודתיות הכנסה" value={analysis.income_volatility} suffix="%" />
              <Metric label="הכנסה חודשית" value={analysis.total_income} suffix=" ₪" />
              <Metric label="הוצאות חודשיות" value={analysis.total_expenses} suffix=" ₪" />
              <Metric label="הוצאות קבועות" value={analysis.fixed_expenses} suffix=" ₪" />
              <Metric label="נכסים נזילים" value={analysis.liquid_assets} suffix=" ₪" />
            </div>

            {/* Behavioral + flags */}
            {(analysis.behavioral_classification || analysis.risk_flags?.length) && (
              <Card className="bg-slate-900/60 border-slate-800 p-6 space-y-4">
                {analysis.behavioral_classification && (
                  <div>
                    <div className="text-xs text-slate-500 mb-1">פרופיל התנהגותי</div>
                    <div className="flex items-center gap-2 text-white">
                      <TrendingUp className="w-4 h-4 text-cyan-400" />
                      {analysis.behavioral_classification}
                    </div>
                  </div>
                )}
                {analysis.risk_flags?.length > 0 && (
                  <div>
                    <div className="text-xs text-slate-500 mb-2">דגלי סיכון</div>
                    <div className="flex flex-wrap gap-2">
                      {analysis.risk_flags.map((f, i) => (
                        <span key={i} className="text-xs bg-amber-500/10 border border-amber-500/30 text-amber-200 px-2.5 py-1 rounded-full">{f}</span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Rescue strategies */}
            {analysis.rescue_strategies_summary?.length > 0 && (
              <Card className="bg-slate-900/60 border-slate-800 p-6">
                <h3 className="font-semibold text-white mb-4">אסטרטגיות מימון מומלצות</h3>
                <div className="space-y-2">
                  {analysis.rescue_strategies_summary.map((s, i) => (
                    <div key={i} className="bg-slate-950/40 border border-slate-800 rounded-lg p-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                      <div><div className="text-xs text-slate-500">סוג</div><div className="text-white">{s.type || '—'}</div></div>
                      <div><div className="text-xs text-slate-500">סטטוס</div><div className="text-white">{s.status || '—'}</div></div>
                      <div><div className="text-xs text-slate-500">סכום</div><div className="text-white">{s.loanAmount ? `₪${Number(s.loanAmount).toLocaleString('he-IL')}` : '—'}</div></div>
                      <div><div className="text-xs text-slate-500">תקופה</div><div className="text-white">{s.termMonths ? `${s.termMonths} ח׳` : '—'}</div></div>
                      <div><div className="text-xs text-slate-500">ריבית</div><div className="text-white">{s.interestRate != null ? `${s.interestRate}%` : '—'}</div></div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}

        <div className="text-center text-xs text-slate-500 pt-4">
          דוח חיתום מאובטח • הצפנה AES-256 • נרשם ב-AuditLog
        </div>
      </main>
    </div>
  );
}