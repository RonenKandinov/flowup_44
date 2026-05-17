import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-[#020617] text-slate-200" dir="rtl">
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-br from-[#020617] via-[#0a1628] to-[#020617]" />
                <div className="absolute top-[-200px] right-[-100px] w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[120px]" />
            </div>

            <header className="relative z-10 border-b border-white/[0.04] px-6 py-5 md:px-10">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-xl bg-white/95 flex items-center justify-center p-1.5">
                            <img
                                src="https://media.base44.com/images/public/6952b136798aa2d444ccb308/1de0c8e71_generated_image.png"
                                alt="FlowUp"
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <span className="text-white font-bold tracking-tight">FlowUp</span>
                    </Link>
                    <Link to="/" className="text-cyan-300 text-sm flex items-center gap-1.5 hover:text-cyan-200 transition">
                        חזרה לדף הבית
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </header>

            <main className="relative z-10 px-6 md:px-10 py-16">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center">
                            <ShieldCheck className="w-6 h-6 text-cyan-300" />
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">מדיניות פרטיות</h1>
                            <p className="text-slate-400 text-sm mt-1">עודכן לאחרונה: מאי 2026</p>
                        </div>
                    </div>

                    <div className="space-y-8 text-slate-300 leading-relaxed text-[15px]">
                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">1. הקדמה</h2>
                            <p>
                                FlowUp ("אנחנו", "החברה", "השירות") מחויבת להגנה על פרטיות המשתמשים. מדיניות זו מסבירה
                                איזה מידע אנו אוספים, כיצד אנו משתמשים בו, ומהן הזכויות שלך ביחס למידע הפיננסי שלך.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">2. איסוף מידע</h2>
                            <p>
                                אנו אוספים מידע פיננסי באמצעות חיבור ל-Open Finance (תחת רגולציה של בנק ישראל), הכולל:
                                יתרות חשבון, תנועות, פרטי חשבוניות, נתוני ספקים ומידע עסקי הנדרש לחיתום.
                                כל המידע נאסף בהסכמה מפורשת בלבד דרך זרימת OAuth מאובטחת.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">3. שימוש במידע</h2>
                            <p>המידע משמש למטרות הבאות בלבד:</p>
                            <ul className="list-disc pr-6 mt-2 space-y-1.5 marker:text-cyan-400">
                                <li>חיתום אשראי אוטומטי וניתוח סיכונים</li>
                                <li>חישוב יחס DSR, ציון אמון ותנודתיות הכנסה</li>
                                <li>הצעת מסלולי הצלה ומוצרי מימון מותאמים</li>
                                <li>תפעול שירותי B2B (ניכיון חשבוניות, גבייה, אוצר)</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">4. אבטחת מידע</h2>
                            <p>
                                כל הנתונים מוצפנים ב-AES-256-GCM הן ב-rest והן ב-transit. נרטיבים רגישים נשמרים
                                ב-Secure Vault מוצפן עם מפתח ייעודי. גישת אנשי החברה למידע מבוקרת לפי הרשאות ומבוקרת ב-Audit Log.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">5. שיתוף עם צדדים שלישיים</h2>
                            <p>
                                איננו מוכרים מידע אישי. שיתוף מתבצע רק עם: ספקי תשתית (Open-Finance.ai) הפועלים תחת
                                הסכמי DPA, שותפי B2B מאושרים בהסכמתך, ורשויות מוסמכות במקרי דרישה חוקית.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">6. הזכויות שלך</h2>
                            <p>
                                בכל עת תוכל לבקש: עיון במידע שלך, תיקון, מחיקה, ניתוק חיבור Open Finance,
                                והעברת מידע (Data Portability). פנייה לכתובת: privacy@flowup.io
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">7. שמירת מידע</h2>
                            <p>
                                מידע פיננסי נשמר במשך 7 שנים בהתאם לרגולציה. ניתן לבקש מחיקה מוקדמת
                                של מידע שאינו נדרש לחובות רגולטוריות.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">8. עדכונים למדיניות</h2>
                            <p>
                                שינויים מהותיים יישלחו אליך באימייל לפחות 30 יום לפני כניסתם לתוקף.
                            </p>
                        </section>
                    </div>
                </div>
            </main>

            <footer className="relative z-10 border-t border-white/[0.04] px-6 md:px-10 py-6 mt-10">
                <div className="max-w-4xl mx-auto text-center text-slate-500 text-[11px] tracking-wider">
                    © {new Date().getFullYear()} FlowUp · Powered by Open-Finance.ai
                </div>
            </footer>
        </div>
    );
}