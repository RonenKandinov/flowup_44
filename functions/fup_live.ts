Deno.serve(async (req) => {
  // החלפתי את ה-URL לכתובת ישירה שעובדת בסנדבוקס
  const BASE_URL = "https://api.open-finance.ai/v2";
  const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
  const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

  try {
    const body = await req.json();
    const psuId = body.psuId;

    // שלב 1: קבלת Token
    const tokenRes = await fetch(`${BASE_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: psuId, clientId: API_KEY, clientSecret: API_SECRET })
    });
    
    const tokenData = await tokenRes.json();
    const access_token = tokenData.access_token;

    // כאן אני מדפיס את הטוקן שחיפשת - הוא יופיע ב-Logs ב-Base44
    console.log("MY_TOKEN_EYJ:", access_token);

    // שלב 2: יצירת Connection לפועלים
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

    // שלב 3: הפקת לינק (Init)
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

    return Response.json({ 
      success: true, 
      token: access_token, 
      url: initData.connectUrl || initData.scaOAuth 
    });

  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
});