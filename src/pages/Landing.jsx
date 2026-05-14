import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { ShieldCheck, Cpu, Sparkles, ArrowLeft, LogIn, TrendingUp, Lock } from 'lucide-react';

const FEATURES = [
    {
        icon: Cpu,
        title: 'מנוע חיתום היברידי',
        text: 'ציון אשראי מבוסס Open Finance עם ניתוח AI חי, כולל מסלולי הצלה אוטומטיים לעסקאות גבוליות.',
        accent: 'cyan'
    },
    {
        icon: ShieldCheck,
        title: 'אבטחה ברמת בנק',
        text: 'הצפנת AES-GCM, ארכיטקטורת Local-First, ושמירת נתונים פיננסיים בכספת מאובטחת בלבד.',
        accent: 'emerald'
    },
    {
        icon: Sparkles,
        title: 'B2B Suite מלא',
        text: 'ניכיון חשבוניות, מימון ספקים, ניהול הון חוזר, אוצר וגבייה חכמה — הכל ממקום אחד.',
        accent: 'amber'
    }
];

const STATS = [
    { label: 'דיוק חיתום', value: '94%', icon: TrendingUp },
    { label: 'זמן ניתוח', value: '< 30s', icon: Cpu },
    { label: 'הצפנה', value: 'AES-256', icon: Lock }
];

const ACCENT_RING = {
    cyan: 'bg-cyan-500/10 border-cyan-400/40 text-cyan-300 group-hover:border-cyan-300/70 group-hover:bg-cyan-500/20',
    emerald: 'bg-emerald-500/10 border-emerald-400/40 text-emerald-300 group-hover:border-emerald-300/70 group-hover:bg-emerald-500/20',
    amber: 'bg-amber-500/10 border-amber-400/40 text-amber-300 group-hover:border-amber-300/70 group-hover:bg-amber-500/20'
};

export default function Landing() {
    const { navigateToLogin, isAuthenticated } = useAuth();

    const handleLogin = () => navigateToLogin();
    const handleEnter = () => { window.location.href = '/Dashboard'; };

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

            {/* Header */}
            <header className="relative z-10 px-6 py-6 md:px-10">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                            <TrendingUp className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">FlowUp</h1>
                            <p className="text-cyan-400/70 text-[10px] mt-0.5 tracking-[0.2em] uppercase font-medium">FutureFlow FinTech</p>
                        </div>
                    </div>
                    <Button
                        onClick={isAuthenticated ? handleEnter : handleLogin}
                        size="sm"
                        className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-semibold border-0 h-10 px-5 shadow-lg shadow-cyan-500/30"
                    >
                        <LogIn className="w-3.5 h-3.5 ml-1.5" />
                        <span className="text-xs">{isAuthenticated ? 'כניסה למערכת' : 'התחברות'}</span>
                    </Button>
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
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/30 mb-8 backdrop-blur-sm">
                            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                            <span className="text-[11px] text-cyan-200 tracking-wider font-medium">פלטפורמת חיתום וניהול אשראי עסקי</span>
                        </div>

                        <h2 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]">
                            <span className="bg-gradient-to-b from-white via-white to-slate-400 bg-clip-text text-transparent">
                                האינטליגנציה הפיננסית
                            </span>
                            <br />
                            <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-400 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(56,189,248,0.3)]">
                                של העסק שלך
                            </span>
                        </h2>

                        <p className="text-slate-300 text-base md:text-lg mt-8 leading-relaxed max-w-2xl mx-auto">
                            ניתוח Open Finance בזמן אמת, חיתום אוטומטי, וניהול תזרים חכם —
                            <br />
                            <span className="text-cyan-300/90">בפלטפורמה אחת מאובטחת.</span>
                        </p>

                        <div className="flex items-center justify-center gap-3 mt-12">
                            <Button
                                onClick={isAuthenticated ? handleEnter : handleLogin}
                                size="lg"
                                className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold h-14 px-10 shadow-2xl shadow-cyan-500/40 border-0 text-base"
                            >
                                {isAuthenticated ? 'כניסה לדשבורד' : 'התחבר למערכת'}
                                <ArrowLeft className="w-4 h-4 mr-2" />
                            </Button>
                        </div>

                        <p className="text-slate-500 text-[11px] mt-5 tracking-wider flex items-center justify-center gap-1.5">
                            <Lock className="w-3 h-3" />
                            התחברות מאובטחת · אין צורך בהרשמה ידנית
                        </p>
                    </motion.div>

                    {/* Stats strip */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mt-20 grid grid-cols-3 gap-3 max-w-2xl mx-auto"
                    >
                        {STATS.map((s) => (
                            <div
                                key={s.label}
                                className="rounded-xl border border-cyan-500/20 bg-gradient-to-b from-slate-900/80 to-slate-950/80 backdrop-blur-sm p-4 text-center"
                            >
                                <s.icon className="w-4 h-4 text-cyan-400 mx-auto mb-2" />
                                <div className="text-xl font-bold text-white">{s.value}</div>
                                <div className="text-[10px] text-slate-400 tracking-wider uppercase mt-1">{s.label}</div>
                            </div>
                        ))}
                    </motion.div>

                    {/* Features */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-16">
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

            <footer className="relative z-10 border-t border-cyan-500/10 px-6 md:px-10 py-6 bg-slate-950/40 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto text-center">
                    <p className="text-slate-500 text-[11px] tracking-wider">
                        © {new Date().getFullYear()} <span className="text-cyan-400 font-medium">FlowUp</span> · מערכת חיתום אשראי מאובטחת
                    </p>
                </div>
            </footer>
        </div>
    );
}