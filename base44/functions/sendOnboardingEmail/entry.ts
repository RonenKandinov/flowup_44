import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

    const safeName = customer_name || 'לקוח/ה יקר/ה';
    const body = `שלום ${safeName},

לצורך המשך טיפול בבקשת האשראי שלך, אנא חבר/י את חשבון הבנק שלך באמצעות הקישור המאובטח הבא:

${link}

הקישור מאובטח וחד-פעמי. אם לא ביקשת זאת, ניתן להתעלם מהודעה זו.

בברכה,
צוות FlowUp`;

    await base44.integrations.Core.SendEmail({
      from_name: 'FlowUp',
      to,
      subject: 'חיבור חשבון הבנק להמשך בקשת האשראי — FlowUp',
      body
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});