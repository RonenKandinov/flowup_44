Deno.serve(async (req) => {
  const BASE_URL = "https://api.open-finance.ai/v2";
  const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
  const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

  if (req.method !== "POST") return new Response("Use POST", { status: 405 });

  try {
    const { psuId } = await req.json();

    // 1. קבלת Token
    const tokenRes = await fetch(`${BASE_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: psuId, clientId: API_KEY, clientSecret: API_SECRET })
    });
    const tokenData = await tokenRes.json();
    const access_token = tokenData.access_token;

    // 2. יצירת Connection
    const connRes = await fetch(`${BASE_URL}/connections`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ 
        customerId: psuId, 
        connectionMode: "PSD2", 
        includeFakeProviders: true,
        permissions: ["READ_ACCOUNTS", "READ_BALANCES", "READ_TRANSACTIONS"] 
      })
    });
    const connData = await connRes.json();

    // 3. יצירת הלינק (Init)
    const initRes = await fetch(`${BASE_URL}/connect/open-banking-init`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ 
        connectionId: connData.id, 
        providerId: "hapoalim-sandbox", 
        psuId: psuId, 
        psuIdType: "NATIONAL_ID",
        redirectUri: "https://google.com" 
      })
    });
    const initData = await initRes.json();
    const finalUrl = initData.connectUrl || initData.scaOAuth;

    // החזרה מפורשת של הנתונים כדי שיופיעו ב-Output
    const responseBody = JSON.stringify({
      message: "Success! Copy the token and URL below",
      token: access_token, // הנה ה-eyJ שחיפשת
      url: finalUrl,       // הלינק לאישור בדפדפן
      connectionId: connData.id
    });

    return new Response(responseBody, {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});