
Deno.serve(async (req) => {
  const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
  const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");
  const BASE_URL = "https://api.open-finance.ai/v2";

  if (req.method !== "POST") return new Response("Use POST", { status: 405 });

  try {
    const { psuId } = await req.json();
    if (!psuId) throw new Error("Missing psuId in payload");

    // 1. קבלת Access Token
    const tokenRes = await fetch(`${BASE_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: psuId, clientId: API_KEY, clientSecret: API_SECRET })
    });
    const { access_token } = await tokenRes.json();

    // 2. יצירת Connection עם הרשאות מלאות
    const connRes = await fetch(`${BASE_URL}/connections`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ 
        customerId: psuId, 
        connectionMode: "PSD2", 
        includeFakeProviders: true, // חובה כדי שהפועלים-סנדבוקס יופיע
        permissions: ["READ_ACCOUNTS", "READ_BALANCES", "READ_TRANSACTIONS"] 
      })
    });
    const connData = await connRes.json();

    // 3. יצירת הלינק (Init) ספציפית לבנק הפועלים
    const initRes = await fetch(`${BASE_URL}/connect/open-banking-init`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ 
        connectionId: connData.id, 
        providerId: "hapoalim-sandbox", // זה המזהה של הפועלים בסנדבוקס
        psuId: psuId, 
        psuIdType: "NATIONAL_ID",
        redirectUri: "https://google.com" 
      })
    });
    const initData = await initRes.json();

    // חילוץ ה-URL שהקוד יציג לך ב-Output
    const finalUrl = initData.connectUrl || initData.scaOAuth;

    return Response.json({ 
      success: true, 
      url: finalUrl, 
      connectionId: connData.id 
    });

  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
});