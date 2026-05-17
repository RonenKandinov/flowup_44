import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileText } from 'lucide-react';

export default function TermsOfUse() {
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
                            <FileText className="w-6 h-6 text-cyan-300" />
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">תנאי שימוש</h1>
                            <p className="text-slate-400 text-sm mt-1">עודכן לאחרונה: מאי 2026</p>
                        </div>
                    </div>

                    <div className="space-y-8 text-slate-300 leading-relaxed text-[15px]">
                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">1. הסכמה לתנאים</h2>
                            <p>
                                השימוש בפלטפורמת FlowUp מהווה הסכמה לתנאים אלה. אם אינך מסכים לתנאי כלשהו —
                                אנא הימנע משימוש בשירות.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">2. תיאור השירות</h2>
                            <p>
                                FlowUp היא פלטפורמת חיתום אשראי וניהול פיננסי לעסקים, המספקת ניתוח סיכונים בזמן אמת,
                                המלצות מימון, וכלי B2B (ניכיון חשבוניות, גבייה חכמה, מימון ספקים וניהול אוצר).
                                השירות מבוסס על נתוני Open Finance של בנק ישראל.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">3. כשירות לשימוש</h2>
                            <p>
                                השירות מיועד לבעלי עסקים בני 18+ ולחברות רשומות בישראל. עליך לספק מידע מדויק ועדכני
                                בכל אינטראקציה עם המערכת.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">4. אופי ההמלצות</h2>
                            <p>
                                ההמלצות, ציוני האשראי ומסלולי ההצלה המופקים על ידי המערכת הם <strong className="text-white">כלי תומך החלטה</strong>
                                {' '}ואינם מהווים אישור או דחייה סופית של אשראי. החלטות מימון סופיות מתבצעות על ידי מוסדות פיננסיים
                                מורשים בלבד.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">5. שימוש מותר</h2>
                            <p>אסור להשתמש בשירות לצורך:</p>
                            <ul className="list-disc pr-6 mt-2 space-y-1.5 marker:text-cyan-400">
                                <li>הזנת נתונים כוזבים או מטעים</li>
                                <li>ניסיונות הנדסה לאחור או חדירה לתשתית</li>
                                <li>שימוש מסחרי לא מורשה ב-API או בנתונים</li>
                                <li>פעילות בלתי חוקית או הלבנת הון</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">6. קניין רוחני</h2>
                            <p>
                                כל המנועים (Hybrid Prediction Engine, Deal Rescuer, Insight Engine), העיצובים,
                                הקוד והאלגוריתמים הם קניינה הבלעדי של FlowUp.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">7. הגבלת אחריות</h2>
                            <p>
                                השירות ניתן "כפי שהוא" (AS IS). FlowUp אינה אחראית להפסדים עקיפים הנובעים משימוש
                                במידע או בהמלצות המערכת. האחריות הכוללת מוגבלת לסכום ששולם בעבור השירות ב-12 החודשים האחרונים.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">8. הפסקת שירות</h2>
                            <p>
                                אנו רשאים להשעות או לסיים גישה במקרים של הפרת תנאים, פעילות חשודה או דרישה רגולטורית.
                                תוכל לסיים את החשבון בכל עת ולבקש מחיקת נתונים בהתאם למדיניות הפרטיות.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">9. דין וסמכות שיפוט</h2>
                            <p>
                                תנאים אלה כפופים לדין הישראלי. סמכות שיפוט בלעדית לבתי המשפט המוסמכים במחוז תל אביב.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">10. יצירת קשר</h2>
                            <p>שאלות? legal@flowup.io</p>
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