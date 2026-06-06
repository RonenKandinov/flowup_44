import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, customer_name, link } = await req.json();
    if (!to || !link) {
      return Response.json({ error: 'Missing email or link' }, { status: 400 });
    }

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
    }

    const safeName = customer_name || 'לקוח/ה יקר/ה';
    const html = `
      <div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;color:#1e293b;line-height:1.7">
        <p>שלום ${safeName},</p>
        <p style="font-size:16px;font-weight:bold;color:#0f172a">בקשת האשראי שלך ממתינה להשלמת אימות.</p>
        <p>השלמת האימות המאובטח תאפשר לנו להציג עבורך תמונה פיננסית מדויקת ותשובה מהירה יותר — תוך דקות, ללא ניירת.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">
            המשך לבדיקה
          </a>
        </p>
        <p style="direction:ltr;text-align:left;word-break:break-all;font-size:13px;color:#334155">${link}</p>
        <p style="font-size:13px;color:#64748b">הקישור מאובטח וחד-פעמי. אם לא ביקשת זאת, ניתן להתעלם מהודעה זו.</p>
        <p style="font-size:13px;color:#64748b">בברכה,<br/>צוות FlowUp</p>
      </div>`;

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'FlowUp <noreply@flowupfinance.com>',
        to: [to],
        subject: 'בקשת האשראי שלך ממתינה להשלמת אימות — FlowUp',
        html
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      return Response.json({ error: data?.message || 'Email sending failed' }, { status: 502 });
    }

    return Response.json({ success: true, id: data?.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});