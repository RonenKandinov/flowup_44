import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Code, Terminal, Webhook, Key, BookOpen } from "lucide-react";

export default function DevelopersPortal() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500" dir="rtl">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-100 flex items-center gap-3">
          <Terminal className="w-8 h-8 text-cyan-400" />
          פורטל מפתחים - FlowUp API
        </h1>
        <p className="text-slate-400 text-lg">
          תיעוד מלא לאינטגרציה של מערכת החיתום וה-Open Finance של FlowUp לתוך תהליכי העבודה שלכם.
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full" dir="rtl">
        <TabsList className="grid w-full grid-cols-4 bg-slate-900 border border-slate-800">
          <TabsTrigger value="overview" className="data-[state=active]:bg-slate-800 data-[state=active]:text-cyan-400">סקירה כללית</TabsTrigger>
          <TabsTrigger value="auth" className="data-[state=active]:bg-slate-800 data-[state=active]:text-cyan-400">אימות (Auth)</TabsTrigger>
          <TabsTrigger value="api" className="data-[state=active]:bg-slate-800 data-[state=active]:text-cyan-400">יצירת בקשה (API)</TabsTrigger>
          <TabsTrigger value="webhooks" className="data-[state=active]:bg-slate-800 data-[state=active]:text-cyan-400">Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-xl text-slate-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                איך זה עובד?
              </CardTitle>
              <CardDescription className="text-slate-400">
                זרימת הנתונים בין המערכת שלכם ל-FlowUp
              </CardDescription>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <p>
                האינטגרציה עם FlowUp נועדה להיות פשוטה ואסינכרונית, ומשמשת כ"שכבת על" (Overlay) למערכות החיתום שלכם.
              </p>
              <ol className="list-decimal list-inside space-y-3 mr-4">
                <li><strong className="text-slate-200">יצירת בקשה:</strong> המערכת שלכם קוראת ל-API שלנו כדי ליצור "קישור קסם" (Magic Link) ייעודי ללקוח שלכם.</li>
                <li><strong className="text-slate-200">הפניית הלקוח:</strong> אתם מפנים את הלקוח לקישור שקיבלתם. הלקוח עובר תהליך חיבור מאובטח לחשבון הבנק שלו (Open Finance) בסביבה של FlowUp.</li>
                <li><strong className="text-slate-200">ניתוח נתונים:</strong> FlowUp מושכת את הנתונים, מפעילה את מנוע התובנות (Insight Engine) ומחשבת מדדי סיכון.</li>
                <li><strong className="text-slate-200">קבלת תוצאות:</strong> עם סיום הניתוח, FlowUp שולחת את התוצאות המלאות ישירות ל-Webhook שהגדרתם במערכת.</li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auth" className="mt-6 space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-xl text-slate-100 flex items-center gap-2">
                <Key className="w-5 h-5 text-cyan-400" />
                אימות מול ה-API
              </CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-4">
              <p>
                כל קריאה ל-API של FlowUp דורשת אימות באמצעות מפתח API (API Key) ייחודי לשותף.
                את המפתח ניתן להנפיק דרך ממשק ניהול השותפים.
              </p>
              <div className="bg-slate-950 p-4 rounded-md border border-slate-800 font-mono text-sm text-left" dir="ltr">
                <span className="text-slate-500">Authorization:</span> Bearer YOUR_API_KEY
              </div>
              <p className="text-sm text-slate-400 mt-2">
                * יש להעביר את המפתח ב-Header של הבקשה תחת <code>Authorization</code>.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="mt-6 space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-xl text-slate-100 flex items-center gap-2">
                <Code className="w-5 h-5 text-cyan-400" />
                יצירת קישור חיתום (Partner API)
              </CardTitle>
              <CardDescription className="text-slate-400">
                נקודת הקצה ליצירת תהליך חדש עבור לקוח
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-3">
                <Badge className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">POST</Badge>
                <code className="text-slate-300 font-mono bg-slate-950 px-2 py-1 rounded border border-slate-800">/api/functions/partnerAPI</code>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-slate-200 font-medium">Body (JSON)</h3>
                <div className="bg-slate-950 p-4 rounded-md border border-slate-800 font-mono text-sm text-left overflow-x-auto" dir="ltr">
<pre className="text-slate-300">
{`{
  "customer_id": "cust_987654321",
  "loan_amount": 50000,
  "loan_purpose": "רכב חדש"
}`}
</pre>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-slate-200 font-medium">Response (200 OK)</h3>
                <div className="bg-slate-950 p-4 rounded-md border border-slate-800 font-mono text-sm text-left overflow-x-auto" dir="ltr">
<pre className="text-green-400">
{`{
  "status": "success",
  "url": "https://your-app-domain.com/b2b-connect?partner=PartnerName&customer=cust_987654321",
  "partner": "PartnerName",
  "customer_id": "cust_987654321"
}`}
</pre>
                </div>
                <p className="text-sm text-slate-400 mt-2">
                  יש להפנות את הלקוח לכתובת ה-URL שהתקבלה בתשובה כדי להתחיל את תהליך חיבור הבנק.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="mt-6 space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-xl text-slate-100 flex items-center gap-2">
                <Webhook className="w-5 h-5 text-cyan-400" />
                קבלת תוצאות (Webhooks)
              </CardTitle>
              <CardDescription className="text-slate-400">
                כיצד אנו מעדכנים אתכם בסיום הניתוח
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-slate-300">
                לאחר שהלקוח מסיים לחבר את חשבון הבנק והמערכת שלנו מסיימת לנתח את הנתונים, אנו נשלח בקשת <code>POST</code> לכתובת ה-Webhook שהגדרתם עבור השותף.
              </p>

              <div className="space-y-2">
                <h3 className="text-slate-200 font-medium">מבנה ה-Payload (JSON)</h3>
                <div className="bg-slate-950 p-4 rounded-md border border-slate-800 font-mono text-sm text-left overflow-x-auto" dir="ltr">
<pre className="text-slate-300">
{`{
  "partner_name": "PartnerName",
  "customer_id": "cust_987654321",
  "status": "COMPLETED",
  "timestamp": "2026-03-27T10:00:00Z",
  "results": {
    "decision": "APPROVED",
    "risk_tier": "GREEN",
    "metrics": {
      "dti": 28.5,
      "liquidity_months": 3.2,
      "expense_income_ratio": 75.0,
      "avg_daily_spending": 350
    },
    "insights": [
      "יחס החזר חוב (DTI) תקין ועומד על 28.5%.",
      "קיימת כרית ביטחון נזילה המספיקה ל-3 חודשים."
    ],
    "second_chance_applied": false
  }
}`}
</pre>
                </div>
              </div>
              
              <Separator className="bg-slate-800" />
              
              <div className="space-y-2">
                <h3 className="text-slate-200 font-medium">אבטחה ואימות ה-Webhook</h3>
                <p className="text-sm text-slate-400">
                  מומלץ לוודא שהבקשות ל-Webhook שלכם מגיעות מכתובות ה-IP המורשות של FlowUp, או להשתמש בטוקן אימות ייחודי בכתובת ה-URL של ה-Webhook שלכם (לדוגמה: <code>https://your-api.com/webhook?token=SECRET</code>).
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}