import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ShieldCheck, Zap, TrendingUp, Users, Briefcase, CheckCircle2, ArrowLeft, Building2, BarChart3, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

const VALUE_PROPS = [
  { icon: Zap, title: 'תשובה ללקוח תוך דקות', desc: 'במקום שבוע של איסוף מסמכים אתה נותן תשובה באותה פגישה.' },
  { icon: TrendingUp, title: 'יותר עסקאות שנסגרות', desc: 'גם כשעסקה לא עומדת בתנאים הרגילים — אנחנו בונים מבנה החזר מותאם שמאפשר ללקוח לסגור אותה.' },
  { icon: BarChart3, title: 'מבט אמיתי על תזרים העסק', desc: 'איך הכנסות נכנסות איך הוצאות יוצאות ומתי בחודש נוצר לחץ נזילות.' },
  { icon: Lock, title: 'סטנדרט אבטחה כללי', desc: 'חיבור מאובטח לבנקים והגנה על נתוני הלקוחות שלך.' },
];

const STEPS = [
  { num: '01', title: 'הירשם כשותף', desc: 'נרשמים תוך 5 דקות ומקבלים גישה לפורטל האישי.' },
  { num: '02', title: 'שלח קישור ללקוח', desc: 'הלקוח העסקי מחבר את חשבון הבנק שלו בלחיצה אחת ואתה רואה את תזרים העסק שלו בזמן אמת.' },
  { num: '03', title: 'קבל תמונה מלאה על העסק', desc: 'איך נכנס הכסף איך הוא יוצא איפה הצווארי בקבוק ומה גובה ההחזר שהעסק באמת יכול לעמוד בו.' },
];

export default function ForPartners() {
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.company) {
      toast.error('נא למלא שם, חברה ואימייל');
      return;
    }
    setSubmitting(true);
    try {
      await base44.entities.AuditLog.create({
        action: 'PARTNER_SIGNUP_REQUEST',
        user_id: form.email,
        details: form,
        status: 'PENDING'
      });
      setSubmitted(true);
      toast.success('הבקשה נשלחה! ניצור איתך קשר בקרוב.');
    } catch (err) {
      toast.error('שליחה נכשלה — נסה שוב');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white" dir="rtl">
      {/* Ambient glow */}
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Hero */}
      <section className="relative z-10 px-6 pt-16 pb-20 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">

          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-cyan-100 to-blue-200 bg-clip-text text-transparent">
            הפוך את העסק שלך<br />למרכז חיתום חכם
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
            רואי חשבון, יועצי אשראי וחברות מימון — תן ללקוחות שלך תשובה תוך דקות, לא ימים.
            פחות ניירת, יותר עסקאות סגורות.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button asChild className="bg-cyan-600 hover:bg-cyan-500 text-white h-12 px-8 text-base">
              <a href="#signup">הצטרף עכשיו</a>
            </Button>
            <Button asChild variant="outline" className="bg-slate-800/50 border-slate-700 text-slate-200 hover:bg-slate-700 h-12 px-8 text-base">
              <a href="#demo">צפה בהדגמה</a>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Value Props */}
      <section className="relative z-10 px-6 py-16 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">למה שותפים בוחרים ב-FlowUp</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {VALUE_PROPS.map((v, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
              <Card className="bg-slate-900/60 border-slate-800 p-6 h-full hover:border-cyan-500/40 transition-all">
                <div className="w-11 h-11 bg-cyan-500/10 rounded-lg flex items-center justify-center mb-4 border border-cyan-500/20">
                  <v.icon className="w-5 h-5 text-cyan-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{v.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{v.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How It Works (Demo) */}
      <section id="demo" className="relative z-10 px-6 py-16 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">איך זה עובד</h2>
        <p className="text-slate-400 text-center mb-12">פשוט. מהיר. בלי כאבי ראש.</p>
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-center gap-4 md:gap-2">
          {STEPS.map((s, i) => (
            <React.Fragment key={i}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="flex-1"
              >
                <Card className="bg-slate-900/60 border-slate-800 p-6 h-full relative overflow-hidden">
                  <div className="absolute -bottom-4 -left-2 text-[110px] font-bold text-slate-700/25 leading-none select-none pointer-events-none tracking-tight">{s.num}</div>
                  <div className="relative">
                    <h3 className="font-bold text-white text-lg mb-2">{s.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
                  </div>
                </Card>
              </motion.div>
              {i < STEPS.length - 1 && (
                <div className="flex items-center justify-center text-cyan-400/60 md:px-1">
                  <ArrowLeft className="w-7 h-7 rotate-90 md:rotate-0" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

      </section>

      {/* Trust Bar */}
      <section className="relative z-10 px-6 py-12 max-w-6xl mx-auto">
        <Card className="bg-gradient-to-r from-slate-900/80 to-slate-800/60 border-slate-700 p-8">
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div>
              <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
              <div className="font-semibold text-white">סטנדרט אבטחה כללי</div>
              <div className="text-slate-400 text-sm mt-1">חיבור ישיר ומאובטח לכל הבנקים המובילים</div>
            </div>
            <div>
              <Lock className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
              <div className="font-semibold text-white">פרטיות הלקוחות שלך — מובטחת</div>
              <div className="text-slate-400 text-sm mt-1">הנתונים מוצפנים ברמה הגבוהה ביותר</div>
            </div>
            <div>
              <Users className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <div className="font-semibold text-white">אנחנו פה בשבילך</div>
              <div className="text-slate-400 text-sm mt-1">צוות תמיכה אנושי, לא צ׳אטבוט</div>
            </div>
          </div>
        </Card>
      </section>

      {/* Signup */}
      <section id="signup" className="relative z-10 px-6 py-16 max-w-2xl mx-auto">
        <Card className="bg-slate-900/80 border-slate-800 p-8">
          {submitted ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">תודה!</h3>
              <p className="text-slate-400">קיבלנו את הבקשה. הצוות שלנו יחזור אליך תוך 24 שעות עם פרטי גישה וטוקן.</p>
              <Button asChild className="mt-6 bg-cyan-600 hover:bg-cyan-500">
                <Link to="/partner-portal">לתצוגה מקדימה של הפורטל</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <Building2 className="w-10 h-10 text-cyan-400 mx-auto mb-3" />
                <h2 className="text-2xl font-bold text-white">הצטרף כשותף FlowUp</h2>
                <p className="text-slate-400 text-sm mt-2">השאר פרטים ונחזור אליך תוך יום עסקים אחד</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <Input placeholder="שם מלא" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
                  <Input placeholder="שם החברה / משרד" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
                </div>
                <Input type="email" placeholder="אימייל" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
                <Input placeholder="טלפון (אופציונלי)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
                <Button type="submit" disabled={submitting} className="w-full bg-cyan-600 hover:bg-cyan-500 h-12">
                  {submitting ? 'שולח...' : 'שלח בקשה להצטרפות'}
                </Button>
                <p className="text-xs text-slate-500 text-center">בלחיצה על שליחה אתה מסכים לתנאי השימוש ומדיניות הפרטיות</p>
              </form>
            </>
          )}
        </Card>
      </section>

      <section className="relative z-10 px-6 pb-4 max-w-6xl mx-auto text-center">
        <Button asChild variant="outline" className="bg-slate-800/50 border-slate-700 text-slate-200 hover:bg-slate-700 h-11 px-6">
          <Link to="/">
            <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
            חזרה למסך הבית
          </Link>
        </Button>
      </section>

      <footer className="relative z-10 px-6 py-8 max-w-6xl mx-auto border-t border-slate-800 mt-10">
        <div className="flex justify-between items-center text-sm text-slate-500 flex-wrap gap-3">
          <span>© FlowUp — פלטפורמת חיתום חכמה</span>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-slate-300">פרטיות</Link>
            <Link to="/terms" className="hover:text-slate-300">תנאים</Link>
            <Link to="/developers" className="hover:text-slate-300">מפתחים</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}