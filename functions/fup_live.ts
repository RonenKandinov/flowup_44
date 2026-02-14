Deno.serve(async (req) => {
  const BASE_URL = "https://api.open-finance.ai/v2";
  const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
  const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

  try {
    const { psuId } = await req.json();

    // 1. הפקת Access Token
    const tokenRes = await fetch(`${BASE_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: psuId, clientId: API_KEY, clientSecret: API_SECRET })
    });
    const tokenData = await tokenRes.json();
    const access_token = tokenData.access_token;

    // --- ההדפסה החשובה ללוגים ---
    console.log("--- COPY THIS TOKEN FOR PORTAL ---");
    console.log(access_token); 
    console.log("----------------------------------");

    // 2. יצירת Connection ו-Init
    const connRes = await fetch(`${BASE_URL}/connections`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: psuId, connectionMode: "PSD2", includeFakeProviders: true })
    });
    const connData = await connRes.json();

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
      real_token: access_token,
      url: initData.connectUrl || initData.scaOAuth
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});