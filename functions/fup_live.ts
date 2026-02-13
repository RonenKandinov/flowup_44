Deno.serve(async (req) => {
  const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY")?.trim();
  const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET")?.trim();

  try {
    const { psuId } = await req.json();

    // 1. קבלת הטוקן (מה שהרגע עשית ידנית)
    const tokenRes = await fetch("https://api.open-finance.ai/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: psuId, clientId: API_KEY, clientSecret: API_SECRET })
    });
    const tokenData = await tokenRes.json();
    const access_token = tokenData.accessToken || tokenData.access_token;

    // 2. יצירת חיבור
    const connRes = await fetch("https://api.open-finance.ai/v2/connections", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${access_token}`, 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ customerId: psuId, connectionMode: "PSD2", language: "he" })
    });
    const connData = await connRes.json();

    // 3. קבלת הלינק
    const initRes = await fetch("https://api.open-finance.ai/v2/connect/open-banking-init", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${access_token}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ 
        connectionId: connData.id, 
        providerId: "leumi-sandbox", 
        psuId: psuId, 
        psuIdType: "NATIONAL_ID" 
      })
    });
    const initData = await initRes.json();

    return Response.json({ 
      success: true, 
      url: initData.connectUrl || initData.scaOAuth || initData.url 
    });

  } catch (err) {
    return Response.json({ success: false, error: err.message });
  }
});