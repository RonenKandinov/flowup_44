Deno.serve(async (req) => {
  const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
  const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

  if (req.method !== "POST") return new Response("Use POST", { status: 405 });

  try {
    const { psuId } = await req.json();
    if (!psuId) throw new Error("Missing psuId in request body");

    // 1. קבלת טוקן - תיקון לפורמט v2
    const tokenRes = await fetch("https://api.open-finance.ai/v2/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        grant_type: "client_credentials",
        client_id: API_KEY, 
        client_secret: API_SECRET 
      })
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`Auth Error: ${tokenRes.status} - ${errText}`);
    }
    const tokenData = await tokenRes.json();
    const access_token = tokenData.access_token;

    // 2. יצירת חיבור (Connection)
    const connRes = await fetch("https://api.open-finance.ai/v2/connections", {
      method: "POST",
      headers: { "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: psuId, connectionMode: "PSD2", language: "he" })
    });
    if (!connRes.ok) throw new Error(`Connection Error: ${connRes.status}`);
    const connData = await connRes.json();

    // 3. קבלת לינק לבנק (Init)
    const initRes = await fetch("https://api.open-finance.ai/v2/connect/open-banking-init", {
      method: "POST",
      headers: { "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json" },
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
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
});