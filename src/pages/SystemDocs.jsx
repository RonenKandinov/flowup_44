import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Database, Box, Cpu, ShieldAlert, Activity, GitBranch, ArrowRight, Layout, Calculator, Search, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function SystemDocs() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-cyan-500/10 rounded-lg">
                    <FileText className="w-6 h-6 text-cyan-400" />
                </div>
                <h1 className="text-3xl font-bold text-white">תיעוד המערכת</h1>
            </div>
            <p className="text-slate-400 text-lg max-w-2xl">
                מבנה המערכת, הלוגיקה הפיננסית והסברים לצוות הפיתוח והמוצר.
                <br />
                <span className="text-sm text-slate-500">FlowUp Version 1.0.0 • Client-Side Architecture</span>
            </p>
        </header>

        <Tabs defaultValue="architecture" className="space-y-8">
            <TabsList className="bg-slate-900 border border-slate-800 p-1">
                <TabsTrigger value="architecture" className="data-[state=active]:bg-cyan-950 data-[state=active]:text-cyan-400">ארכיטקטורה</TabsTrigger>
                <TabsTrigger value="logic" className="data-[state=active]:bg-purple-950 data-[state=active]:text-purple-400">מנועי חישוב</TabsTrigger>
                <TabsTrigger value="files" className="data-[state=active]:bg-emerald-950 data-[state=active]:text-emerald-400">מבנה קבצים</TabsTrigger>
            </TabsList>

            {/* Architecture Tab */}
            <TabsContent value="architecture">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Activity className="w-5 h-5 text-cyan-400" />
                                זרימת המידע (Data Flow)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-4 p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                                <div className="p-2 bg-blue-500/10 rounded-full"><Upload className="w-4 h-4 text-blue-400" /></div>
                                <div>
                                    <h3 className="font-bold text-slate-200">1. העלאת קובץ</h3>
                                    <p className="text-sm text-slate-400">משתמש מעלה CSV/Excel. המערכת מזהה בנק אוטומטית.</p>
                                </div>
                            </div>
                            <div className="flex justify-center"><ArrowRight className="w-4 h-4 text-slate-600 rotate-90" /></div>
                            <div className="flex items-center gap-4 p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                                <div className="p-2 bg-purple-500/10 rounded-full"><Cpu className="w-4 h-4 text-purple-400" /></div>
                                <div>
                                    <h3 className="font-bold text-slate-200">2. עיבוד וניתוח</h3>
                                    <p className="text-sm text-slate-400">פרסור שורות, זיהוי הוצאות קבועות, חישוב תחזית היברידי.</p>
                                </div>
                            </div>
                            <div className="flex justify-center"><ArrowRight className="w-4 h-4 text-slate-600 rotate-90" /></div>
                            <div className="flex items-center gap-4 p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                                <div className="p-2 bg-emerald-500/10 rounded-full"><Layout className="w-4 h-4 text-emerald-400" /></div>
                                <div>
                                    <h3 className="font-bold text-slate-200">3. הצגה וסימולציה</h3>
                                    <p className="text-sm text-slate-400">דשבורד, גרפים, סוכן AI וסימולטור What-If.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Lock className="w-5 h-5 text-amber-400" />
                                אבטחה ופרטיות (Security)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-slate-300">
                            <ul className="list-disc list-inside space-y-2">
                                <li>
                                    <strong className="text-white">Local-First:</strong> כל החישובים מתבצעים בדפדפן המשתמש.
                                </li>
                                <li>
                                    <strong className="text-white">ללא API בנקאי:</strong> אין צורך בסיסמאות לבנק. עובדים עם קבצים בלבד.
                                </li>
                                <li>
                                    <strong className="text-white">הצפנה:</strong> נתונים נשמרים ב-IndexedDB מוצפן מקומית.
                                </li>
                                <li>
                                    <strong className="text-white">שליטה מלאה:</strong> המשתמש יכול למחוק את כל המידע בלחיצה אחת.
                                </li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>

            {/* Logic Tab */}
            <TabsContent value="logic">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Calculator className="w-5 h-5 text-purple-400" />
                                מנוע התחזיות (Forecasting Engine)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="p-3 bg-purple-950/10 border border-purple-900/30 rounded-lg">
                                <h4 className="font-bold text-purple-300 mb-1">אלגוריתם היברידי</h4>
                                <code className="block bg-slate-950 p-2 rounded text-xs font-mono text-slate-300">
                                    Hybrid Daily = (AvgDailyNet * 0.7) + (RecentTrend * 0.3)
                                </code>
                                <p className="mt-2 text-slate-400">משקלל 70% היסטוריה ארוכה ו-30% מגמה אחרונה כדי לייצר תחזית יציבה אך רגישה לשינויים.</p>
                            </div>
                            <div className="p-3 bg-red-950/10 border border-red-900/30 rounded-lg">
                                <h4 className="font-bold text-red-300 mb-1">Safety Buffer</h4>
                                <p className="text-slate-400">כל תחזית מופחתת אוטומטית ב-12% כמקדם בטיחות לאי-ודאות.</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5 text-amber-400" />
                                מנוע הסיכונים (Risk Engine)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <p className="text-slate-300">
                                המערכת מריצה <strong>500 סימולציות מונטה-קרלו</strong> כדי לחזות את ההסתברות לכניסה למינוס ב-30 הימים הקרובים.
                            </p>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    <span className="text-slate-300">ירוק: סיכוי נמוך (0-10%)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                    <span className="text-slate-300">צהוב: דורש מעקב (10-35%)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                    <span className="text-slate-300">אדום: סכנה מיידית (>35%)</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>

            {/* Files Tab */}
            <TabsContent value="files">
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Box className="w-5 h-5 text-emerald-400" />
                            מבנה הקבצים (File Structure)
                        </CardTitle>
                        <CardDescription>מיפוי הרכיבים העיקריים בקוד המקור</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[400px] pr-4">
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                        <Database className="w-4 h-4 text-slate-400" />
                                        Entities (שכבת המידע)
                                    </h3>
                                    <ul className="space-y-2 border-r-2 border-slate-800 pr-4">
                                        <li className="text-slate-300">
                                            <code className="text-emerald-400">Transaction.json</code>
                                            <span className="block text-sm text-slate-500">מגדיר מבנה עסקה בודדת (תאריך, סכום, תיאור).</span>
                                        </li>
                                        <li className="text-slate-300">
                                            <code className="text-emerald-400">FinancialSnapshot.json</code>
                                            <span className="block text-sm text-slate-500">שמירת מצב המערכת (יתרה נוכחית, תחזית, רמת סיכון).</span>
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                        <Layout className="w-4 h-4 text-slate-400" />
                                        Components (ממשק משתמש)
                                    </h3>
                                    <ul className="space-y-2 border-r-2 border-slate-800 pr-4">
                                        <li className="text-slate-300">
                                            <code className="text-blue-400">dashboard/SpeedometerGauge.jsx</code>
                                            <span className="block text-sm text-slate-500">הוויזואליזציה המרכזית - מד מהירות שמראה את מצב החשבון.</span>
                                        </li>
                                        <li className="text-slate-300">
                                            <code className="text-blue-400">dashboard/InsightsAgent.jsx</code>
                                            <span className="block text-sm text-slate-500">סוכן ה-AI שמציג תובנות והמלצות חכמות.</span>
                                        </li>
                                        <li className="text-slate-300">
                                            <code className="text-blue-400">upload/CSVUploader.jsx</code>
                                            <span className="block text-sm text-slate-500">רכיב העלאת הקבצים וניהול תהליך הפרסור.</span>
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                        <Cpu className="w-4 h-4 text-slate-400" />
                                        Utils & Logic (לוגיקה עסקית)
                                    </h3>
                                    <div className="p-3 bg-amber-950/10 border border-amber-900/20 rounded mb-2">
                                        <p className="text-xs text-amber-500 flex items-center gap-1">
                                            <Lock className="w-3 h-3" />
                                            קבצים אלו נמצאים תחת components/utils עקב מגבלות פלטפורמה
                                        </p>
                                    </div>
                                    <ul className="space-y-2 border-r-2 border-slate-800 pr-4">
                                        <li className="text-slate-300">
                                            <code className="text-purple-400">forecastingLogic.jsx</code>
                                            <span className="block text-sm text-slate-500">המנוע הראשי - מחבר בין כל החלקים ומייצר את התחזית.</span>
                                        </li>
                                        <li className="text-slate-300">
                                            <code className="text-purple-400">riskEngine.jsx</code>
                                            <span className="block text-sm text-slate-500">מנוע מונטה-קרלו לחישוב סיכונים.</span>
                                        </li>
                                        <li className="text-slate-300">
                                            <code className="text-purple-400">bankParsers.jsx</code>
                                            <span className="block text-sm text-slate-500">מתרגם קבצי בנק (פועלים, לאומי וכו') לפורמט אחיד.</span>
                                        </li>
                                        <li className="text-slate-300">
                                            <code className="text-purple-400">insightAgents.jsx</code>
                                            <span className="block text-sm text-slate-500">אוסף "סוכנים" שמחפשים תובנות ספציפיות (החזרי מס, כפילויות).</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Icon helper components needed
function Upload({ className }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
}