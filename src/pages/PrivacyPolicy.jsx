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

            <header className="relative z-10 border-b border-white/[0.04] px-6 md:px-10 py-5">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-cyan-300 transition-colors text-sm">
                        <ArrowRight className="w-4 h-4" />
                        חזרה לדף הבית
                    </Link>
                    <div className="flex items-center gap-2 text-cyan-300/80 text-xs tracking-widest uppercase">
                        <ShieldCheck className="w-4 h-4" />
                        FlowUp
                    </div>
                </div>
            </header>

            <main className="relative z-10 max-w-4xl mx-auto px-6 md:px-10 py-12 md:py-16">
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-3">מדיניות פרטיות</h1>
                <p className="text-slate-500 text-sm mb-12">עדכון אחרון: {new Date().toLocaleDateString('he-IL')}</p>

                <div className="prose prose-invert max-w-none space-y-8 text-slate-300 leading-relaxed">
                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">1. הקדמה</h2>
                        <p>
                            FlowUp ("אנחנו", "החברה") מחויבת להגנה על פרטיות המשתמשים בפלטפורמת החיתום והניהול הפיננסי שלנו.
                            מדיניות זו מתארת אילו מידע אנו אוספים, כיצד אנו משתמשים בו, וכיצד אנו מגנים עליו בהתאם
                            לחוק הגנת הפרטיות, התשמ"א-1981 ולתקנות אבטחת מידע.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">2. איזה מידע אנו אוספים</h2>
                        <ul className="list-disc pr-6 space-y-2">
                            <li><strong className="text-white">פרטי זיהוי:</strong> שם מלא, כתובת דוא"ל, מספר זיהוי.</li>
                            <li><strong className="text-white">נתונים פיננסיים:</strong> תנועות חשבון בנק, יתרות, חשבוניות ונתוני אשראי הנאספים דרך Open Finance.</li>
                            <li><strong className="text-white">נתוני שימוש:</strong> פעולות במערכת, לוגים טכניים וכתובות IP.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">3. בסיס משפטי לעיבוד</h2>
                        <p>
                            איסוף ועיבוד הנתונים נעשים על בסיס הסכמה מפורשת שלך במהלך תהליך החיבור ל-Open Finance,
                            ולצורך מתן השירותים שביקשת מאיתנו.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">4. שימוש בנתונים</h2>
                        <ul className="list-disc pr-6 space-y-2">
                            <li>חישוב ציון אשראי וביצוע ניתוחי חיתום.</li>
                            <li>הצגת תובנות פיננסיות, תחזיות תזרים והמלצות AI.</li>
                            <li>שיפור המוצר, אבטחת המידע ומניעת הונאות.</li>
                            <li>עמידה בחובות רגולטוריות וחוקיות.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">5. אבטחת מידע</h2>
                        <p>
                            אנו משתמשים בהצפנת AES-256 לנתונים רגישים, הפרדת רשתות, בקרות גישה מבוססות תפקיד (RBAC),
                            רישום ביקורת (Audit Logs) מלא, וסקירות אבטחה תקופתיות בהתאם לסטנדרטים בינלאומיים.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">6. שיתוף נתונים עם צדדים שלישיים</h2>
                        <p>
                            איננו מוכרים מידע אישי. שיתוף נתונים מתבצע רק עם ספקי תשתית מאושרים (כגון ספקי Open Finance מורשי בנק ישראל)
                            ולצרכים מבצעיים מוגדרים, תחת הסכמי סודיות וחובת אבטחה.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">7. תקופת שמירת מידע</h2>
                        <p>
                            המידע נשמר כל עוד חשבונך פעיל או כנדרש למתן השירות. ניתן לבקש מחיקה בכל עת,
                            בכפוף לחובות שמירה רגולטוריות (לדוגמה, רישומי AML למשך 7 שנים).
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">8. זכויותיך</h2>
                        <p>על פי דין, עומדות לך הזכויות הבאות:</p>
                        <ul className="list-disc pr-6 space-y-2 mt-2">
                            <li>זכות עיון במידע שנאסף עליך.</li>
                            <li>זכות תיקון מידע שגוי או לא מדויק.</li>
                            <li>זכות מחיקה (כפוף לחריגים החוקיים).</li>
                            <li>זכות לבטל הסכמה ולנתק חיבור Open Finance בכל עת.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">9. עוגיות (Cookies)</h2>
                        <p>
                            אנו משתמשים בעוגיות חיוניות לתפקוד המערכת ולאבטחת ההתחברות.
                            ניתן לנהל את העוגיות בהגדרות הדפדפן.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-3">10. יצירת קשר</h2>
                        <p>
                            לכל שאלה, בקשה או תלונה בנושא פרטיות, ניתן ליצור קשר עם הממונה על הגנת הפרטיות
                            בכתובת: <span className="text-cyan-300">privacy@flowup.io</span>
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