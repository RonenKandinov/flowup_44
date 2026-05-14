import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { ShieldCheck, Cpu, Sparkles, ArrowLeft, LogIn } from 'lucide-react';

const FEATURES = [
    {
        icon: Cpu,
        title: 'מנוע חיתום היברידי',
        text: 'ציון אשראי מבוסס Open Finance עם ניתוח AI חי, כולל מסלולי הצלה אוטומטיים לעסקאות גבוליות.'
    },
    {
        icon: ShieldCheck,
        title: 'אבטחה ברמת בנק',
        text: 'הצפנת AES-GCM, ארכיטקטורת Local-First, ושמירת נתונים פיננסיים בכספת מאובטחת בלבד.'
    },
    {
        icon: Sparkles,
        title: 'B2B Suite מלא',
        text: 'ניכיון חשבוניות, מימון ספקים, ניהול הון חוזר, אוצר וגבייה חכמה — הכל ממקום אחד.'
    }
];

export default function Landing() {
    const { navigateToLogin, isAuthenticated } = useAuth();

    const handleLogin = () => navigateToLogin();
    const handleEnter = () => { window.location.href = '/Dashboard'; };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden" dir="rtl">
            {/* Background pattern */}
            <div className="fixed inset-0 opacity-30 pointer-events-none">
                <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, rgba(34, 211, 238, 0.15) 1px, transparent 0)`,
                    backgroundSize: '40px 40px'
                }} />
            </div>
            <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <header className="relative z-10 px-6 py-6 md:px-10">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">FlowUp</h1>
                        <p className="text-slate-500 text-[10px] mt-0.5 tracking-[0.2em] uppercase">FutureFlow FinTech</p>
                    </div>
                    <Button
                        onClick={isAuthenticated ? handleEnter : handleLogin}
                        size="sm"
                        className="bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/40 hover:text-white h-9 px-4"
                    >
                        <LogIn className="w-3.5 h-3.5 ml-1.5" />
                        <span className="text-xs font-medium">{isAuthenticated ? 'כניסה למערכת' : 'התחברות'}</span>
                    </Button>
                </div>
            </header>

            {/* Hero */}
            <main className="relative z-10 px-6 md:px-10 pt-12 pb-20">
                <div className="max-w-6xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center max-w-3xl mx-auto"
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 mb-6">
                            <Sparkles className="w-3 h-3 text-cyan-300" />
                            <span className="text-[11px] text-cyan-200 tracking-wider">פלטפורמת חיתום וניהול אשראי עסקי</span>
                        </div>

                        <h2 className="text-4xl md:text-6xl font-bold text-white tracking-tight leading-tight">
                            <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                                האינטליגנציה הפיננסית
                            </span>
                            <br />
                            <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
                                של העסק שלך
                            </span>
                        </h2>

                        <p className="text-slate-400 text-base md:text-lg mt-6 leading-relaxed">
                            ניתוח Open Finance בזמן אמת, חיתום אוטומטי, וניהול תזרים חכם — בפלטפורמה אחת מאובטחת.
                        </p>

                        <div className="flex items-center justify-center gap-3 mt-10">
                            <Button
                                onClick={isAuthenticated ? handleEnter : handleLogin}
                                size="lg"
                                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold h-12 px-8 shadow-lg shadow-cyan-500/20"
                            >
                                {isAuthenticated ? 'כניסה לדשבורד' : 'התחבר למערכת'}
                                <ArrowLeft className="w-4 h-4 mr-2" />
                            </Button>
                        </div>

                        <p className="text-slate-600 text-[11px] mt-4 tracking-wider">
                            התחברות מאובטחת · אין צורך בהרשמה ידנית
                        </p>
                    </motion.div>

                    {/* Features */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-20">
                        {FEATURES.map((f, i) => (
                            <motion.div
                                key={f.title}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15 + i * 0.08 }}
                                className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm p-6 hover:border-cyan-500/30 transition-colors"
                            >
                                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
                                    <f.icon className="w-5 h-5 text-cyan-300" />
                                </div>
                                <h3 className="text-white text-base font-semibold mb-2">{f.title}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">{f.text}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </main>

            <footer className="relative z-10 border-t border-slate-800/60 px-6 md:px-10 py-6">
                <div className="max-w-6xl mx-auto text-center">
                    <p className="text-slate-600 text-[11px] tracking-wider">
                        © {new Date().getFullYear()} FlowUp · מערכת חיתום אשראי מאובטחת
                    </p>
                </div>
            </footer>
        </div>
    );
}