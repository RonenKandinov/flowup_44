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

            <header className="relative z-10 border-b border-white/[0.04] px-6 md:px-10 py-5">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-cyan-300 transition-colors text-sm">
                        <ArrowRight className="w-4 h-4" />
                        חזרה לדף הבית
                    </Link>
                    <div className="flex items-center gap-2 text-cyan-300/80 text-xs tracking-widest uppercase">
                        <FileText className="w-4 h-4" />
                        FlowUp
                    </div>
                </div>
            </header>

            <main className="relative z-10 max-w-4xl mx-auto px-6 md:px-10 py-12 md:py-16">
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-3">תנאי שימוש</h1>
                <p className="text-slate-500 text-sm mb-12">עדכון אחרון: {new Date().toLocaleDateString('he-IL')}</p>

                <div className="prose prose-invert max-w-none space-y-8 text-slate-300 leading-relaxed">
                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">1. כללי</h2>
                        <p>
                            תנאי שימוש אלו ("התנאים") חלים על השימוש שלך בפלטפורמת FlowUp ("הפלטפורמה", "השירות").
                            השימוש בפלטפורמה מהווה הסכמה מלאה ובלתי חוזרת לתנאים אלו.
                            אם אינך מסכים — אנא הימנע משימוש בשירות.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">2. תיאור השירות</h2>
                        <p>
                            FlowUp מספקת מערכת חיתום אשראי וניתוח פיננסי לעסקים, מבוססת על נתוני Open Finance,
                            מנוע חיתום היברידי ובינה מלאכותית. השירות מספק תובנות, ציון אשראי והמלצות
                            בלבד — ואינו מהווה ייעוץ פיננסי, משפטי או השקעות מחייב.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">3. כשירות שימוש</h2>
                        <p>
                            השירות מיועד למשתמשים בגירים (18+) המורשים מבחינה משפטית להתקשר בהסכם זה,
                            ושיש להם הרשאה לחבר חשבונות פיננסיים שבבעלותם או בסמכותם החוקית.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">4. חשבון משתמש</h2>
                        <ul className="list-disc pr-6 space-y-2">
                            <li>הינך אחראי לשמירה על סודיות פרטי ההתחברות שלך.</li>
                            <li>חל איסור על שיתוף חשבון או הענקת גישה לצדדים שלישיים.</li>
                            <li>יש לעדכן אותנו מיידית על שימוש בלתי מורשה בחשבונך.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">5. שימוש מותר ואסור</h2>
                        <p>חל איסור להשתמש בשירות לצורך:</p>
                        <ul className="list-disc pr-6 space-y-2 mt-2">
                            <li>הונאה, הלבנת הון או כל פעילות בלתי חוקית.</li>
                            <li>ניסיונות פריצה, הנדסה לאחור או עקיפת מנגנוני אבטחה.</li>
                            <li>סריקה אוטומטית, scraping או שימוש בבוטים ללא רשות מפורשת.</li>
                            <li>העלאת נתונים שאינם שייכים לך או נאספו ללא הסכמה.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">6. קניין רוחני</h2>
                        <p>
                            הפלטפורמה, האלגוריתמים, הקוד, העיצוב, התכנים והסימנים המסחריים — הם רכושה הבלעדי של FlowUp.
                            השימוש בשירות אינו מקנה לך כל זכות בעלות בקניין הרוחני.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">7. אחריות והגבלתה</h2>
                        <p>
                            השירות ניתן כפי שהוא ("AS IS"). FlowUp לא תישא באחריות לנזקים ישירים או עקיפים
                            שייגרמו כתוצאה מהסתמכות על תובנות, ציונים או המלצות המוצגים במערכת.
                            ההחלטות הפיננסיות הסופיות הן באחריות המשתמש בלבד.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">8. דיוק המידע</h2>
                        <p>
                            אנו עושים מאמצים סבירים לוודא דיוק הנתונים, אך אין אנו מתחייבים על שלמות, עדכניות
                            או היעדר טעויות. נתוני Open Finance תלויים בזמינות ובדיוק של ספקי הנתונים החיצוניים.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">9. שינויים בשירות ובתנאים</h2>
                        <p>
                            אנו שומרים לעצמנו את הזכות לעדכן את התנאים מעת לעת. שינויים מהותיים יפורסמו במערכת
                            וייכנסו לתוקף 14 ימים לאחר ההודעה. המשך השימוש מהווה הסכמה לתנאים המעודכנים.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">10. סיום ההתקשרות</h2>
                        <p>
                            ניתן לסגור את חשבונך בכל עת. FlowUp רשאית להשהות או לחסום חשבון במקרה של הפרת התנאים,
                            פעילות חשודה או דרישה רגולטורית.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">11. דין וסמכות שיפוט</h2>
                        <p>
                            על תנאים אלו יחולו דיני מדינת ישראל. סמכות השיפוט הבלעדית בכל מחלוקת תהיה לבתי המשפט המוסמכים במחוז תל אביב-יפו.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">12. יצירת קשר</h2>
                        <p>
                            לכל שאלה בנוגע לתנאים: <span className="text-cyan-300">legal@flowup.io</span>
                        </p>
                    </section>
                </div>
            </main>

            <footer className="relative z-10 border-t border-cyan-500/10 px-6 md:px-10 py-6 bg-slate-950/40">
                <div className="max-w-4xl mx-auto text-center text-slate-500 text-[11px] tracking-wider">
                    © {new Date().getFullYear()} <span className="text-cyan-400 font-medium">FlowUp</span>
                </div>
            </footer>
        </div>
    );
}