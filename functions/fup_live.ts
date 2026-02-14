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
      body: JSON.stringify({ 
        userId: psuId, 
        clientId: API_KEY, 
        clientSecret: API_SECRET 
      })
    });
    const tokenData = await tokenRes.json();
    const access_token = tokenData.access_token;

    // הדפסת הטוקן ללוגים בשבילך (זה ה-eyJ שחיפשת)
    console.log("PORTAL_TOKEN_EYJ:", access_token);

    if (!access_token) throw new Error("Failed to get token: " + JSON.stringify(tokenData));

    // 2. יצירת Connection עם הרשאות ופלאג Sandbox
    const connRes = await fetch(`${BASE_URL}/connections`, {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${access_token}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ 
        customerId: psuId, 
        connectionMode: "PSD2", 
        language: "he",
        includeFakeProviders: true, // חובה לעבודה עם סנדבוקס
        permissions: ["READ_ACCOUNTS", "READ_BALANCES", "READ_TRANSACTIONS"] 
      })
    });
    const connData = await connRes.json();
    if (!connData.id) throw new Error("Failed to create connection: " + JSON.stringify(connData));

    // 3. יצירת הלינק להזדהות ספציפית לבנק הפועלים (Init)
    const initRes = await fetch(`${BASE_URL}/connect/open-banking-init`, {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${access_token}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ 
        connectionId: connData.id, 
        providerId: "hapoalim-sandbox", // בנק הפועלים סנדבוקס
        psuId: psuId, 
        psuIdType: "NATIONAL_ID",
        redirectUri: "https://google.com" // לאן תחזור אחרי האישור
      })
    });
    const initData = await initRes.json();

    // חילוץ ה-URL שאתה צריך לפתוח בדפדפן
    const finalUrl = initData.connectUrl || initData.scaOAuth || initData.url;

    // זה מה שיחזור לך ל-Output ב-Base44
    return Response.json({ 
      success: true, 
      url: finalUrl, 
      connectionId: connData.id,
      token_preview: access_token.substring(0, 20) + "..."
    });

  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
});