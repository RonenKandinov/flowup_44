Deno.serve(async (req) => {
  const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
  const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");
  const BASE_URL = "https://api.open-finance.ai/v2";

  if (req.method !== "POST") return new Response("Use POST", { status: 405 });

  try {
    const { psuId } = await req.json();

    // שלב 1: קבלת Token
    const tokenRes = await fetch(`${BASE_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: psuId, clientId: API_KEY, clientSecret: API_SECRET })
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error("Token Error: " + JSON.stringify(tokenData));

    // שלב 2: יצירת Connection (כמו בתיעוד שצילמת)
    const connRes = await fetch(`${BASE_URL}/connections`, {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        customerId: psuId, 
        connectionMode: "PSD2", 
        includeFakeProviders: true, // חובה לסנדבוקס
        permissions: ["READ_ACCOUNTS", "READ_BALANCES", "READ_TRANSACTIONS"]
      })
    });
    const connData = await connRes.json();
    if (!connRes.ok) throw new Error("Connection Error: " + JSON.stringify(connData));

    // שלב 3: הפקת לינק להתחברות
    const initRes = await fetch(`${BASE_URL}/connect/open-banking-init`, {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        connectionId: connData.id, 
        providerId: "open-finance-sandbox", 
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