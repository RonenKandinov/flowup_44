import React from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Cpu, Sparkles, ArrowLeft, Lock } from 'lucide-react';

const FEATURES = [
    {
        icon: Cpu,
        title: 'מנוע חיתום היברידי',
        text: 'ציון אשראי מבוסס Open Finance עם ניתוח AI חי, כולל מסלולי הצלה אוטומטיים לעסקאות גבוליות.',
        accent: 'cyan'
    },
    {
        icon: ShieldCheck,
        title: 'אבטחה ופרטיות מובנית',
        text: 'הצפנת נתונים מתקדמת, הרשאות גישה מבוקרות וניהול מידע פיננסי מאובטח.',
        accent: 'emerald'
    },
    {
        icon: Sparkles,
        title: 'B2B Suite מלא',
        text: 'ניכיון חשבוניות, מימון ספקים, ניהול הון חוזר, אוצר וגבייה חכמה — הכל ממקום אחד.',
        accent: 'amber'
    }
];

const ACCENT_RING = {
    cyan: 'bg-cyan-500/10 border-cyan-400/40 text-cyan-300 group-hover:border-cyan-300/70 group-hover:bg-cyan-500/20',
    emerald: 'bg-emerald-500/10 border-emerald-400/40 text-emerald-300 group-hover:border-emerald-300/70 group-hover:bg-emerald-500/20',
    amber: 'bg-amber-500/10 border-amber-400/40 text-amber-300 group-hover:border-amber-300/70 group-hover:bg-amber-500/20'
};

export default function Landing() {
    const navigate = useNavigate();
    // Clean client-side navigation — no auth gate, no page reload
    const handleLogin = () => navigate('/Dashboard');

    return (
        <div className="min-h-screen bg-[#020617] relative overflow-hidden" dir="rtl">
            {/* Layered background — sharper contrast */}
            <div className="fixed inset-0 pointer-events-none">
                {/* Deep blue gradient base */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#020617] via-[#0a1628] to-[#020617]" />
                {/* Grid pattern */}
                <div className="absolute inset-0 opacity-40" style={{
                    backgroundImage: `linear-gradient(rgba(56, 189, 248, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.07) 1px, transparent 1px)`,
                    backgroundSize: '60px 60px'
                }} />
                {/* Glowing orbs */}
                <div className="absolute top-[-200px] right-[-100px] w-[700px] h-[700px] bg-cyan-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-200px] left-[-100px] w-[700px] h-[700px] bg-blue-600/10 rounded-full blur-[120px]" />
                <div className="absolute top-[40%] left-[20%] w-[400px] h-[400px] bg-sky-400/5 rounded-full blur-[100px]" />
            </div>

            {/* Header — clean rounded logo card, right side (RTL) */}
            <header className="relative z-10 px-6 py-6 md:px-10 border-b border-white/[0.04]">
                <div className="max-w-6xl mx-auto flex items-center">
                    <div className="bg-white rounded-2xl px-5 py-3 shadow-xl shadow-cyan-500/10 flex flex-col items-center justify-center min-w-[88px]">
                        <img
                            src="https://media.base44.com/images/public/6952b136798aa2d444ccb308/84003185a_image.png"
                            alt="FlowUp"
                            className="h-10 w-auto object-contain"
                        />
                    </div>
                </div>
            </header>

            {/* Hero */}
            <main className="relative z-10 px-6 md:px-10 pt-16 pb-20">
                <div className="max-w-6xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center max-w-3xl mx-auto"
                    >
                        <h2 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]">
                            <span className="bg-gradient-to-b from-white via-white to-slate-400 bg-clip-text text-transparent">
                                מערכת החלטות אשראי
                            </span>
                            <br />
                            <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-400 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(56,189,248,0.3)]">
                                בזמן אמת
                            </span>
                        </h2>

                        <p className="text-slate-300 text-base md:text-lg mt-8 leading-relaxed max-w-2xl mx-auto">
                            אופטימיזציית עסקאות, ניתוח התנהגות פיננסית
                            <br />
                            <span className="text-cyan-300/90">וחיתום דינמי בפלטפורמה אחת.</span>
                        </p>

                        <div className="flex flex-col items-center gap-4 mt-12">
                            <Button
                                onClick={handleLogin}
                                className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-semibold h-11 px-8 shadow-xl shadow-cyan-500/30 border-0 text-sm tracking-wide"
                            >
                                כניסה למערכת
                                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                            </Button>

                            <p className="text-slate-500 text-[11px] tracking-wider flex items-center justify-center gap-1.5">
                                <Lock className="w-3 h-3" />
                                התחברות מאובטחת · אין צורך בהרשמה ידנית
                            </p>
                        </div>
                    </motion.div>

                    {/* Features */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-20">
                        {FEATURES.map((f, i) => (
                            <motion.div
                                key={f.title}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 + i * 0.08 }}
                                className="group rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/60 to-slate-950/60 backdrop-blur-sm p-6 hover:border-cyan-400/40 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/10 hover:-translate-y-1"
                            >
                                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 transition-all ${ACCENT_RING[f.accent]}`}>
                                    <f.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-white text-lg font-semibold mb-2">{f.title}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">{f.text}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </main>

            <footer className="relative z-10 border-t border-cyan-500/10 px-6 md:px-10 py-8 bg-slate-950/40 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-slate-500 text-[11px] tracking-wider">
                        © {new Date().getFullYear()} <span className="text-cyan-400 font-medium">FlowUp</span> · מערכת חיתום אשראי מאובטחת
                    </p>
                    <div className="flex items-center gap-6 text-[11px] tracking-wider">
                        <Link to="/privacy" className="text-slate-500 hover:text-cyan-300 transition-colors">
                            מדיניות פרטיות
                        </Link>
                        <span className="w-px h-3 bg-white/10" />
                        <Link to="/terms" className="text-slate-500 hover:text-cyan-300 transition-colors">
                            תנאי שימוש
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}