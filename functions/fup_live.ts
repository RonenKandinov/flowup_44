Deno.serve(async (req) => {
  const BASE_URL = "https://api.open-finance.ai/v2";

  const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
  const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

  try {
    const { userId, psuId } = await req.json();

    if (!userId || !psuId) {
      return Response.json({
        success: false,
        error: "userId and psuId are required"
      });
    }

    // 1️⃣ GET TOKEN
    const tokenRes = await fetch(`${BASE_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        clientId: API_KEY,
        clientSecret: API_SECRET
      })
    });

    const tokenJson = await tokenRes.json();

    if (!tokenRes.ok) {
      throw new Error(JSON.stringify(tokenJson));
    }

    const access_token = tokenJson.access_token;

    // 2️⃣ CREATE CONNECTION
    const connRes = await fetch(`${BASE_URL}/connections`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId,
        connectionMode: "PSD2",
        includeFakeProviders: true
      })
    });

    const connJson = await connRes.json();

    if (!connRes.ok) {
      throw new Error(JSON.stringify(connJson));
    }

    const connectionId = connJson.id;

    // 3️⃣ INIT OPEN BANKING FLOW
    const initRes = await fetch(`${BASE_URL}/connect/open-banking-init`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        connectionId,
        providerId: "mizrahi-tefahot-sandbox",
        psuId: psuId,
        psuIdType: "NATIONAL_ID",
        redirectUri: "https://google.com"
      })
    });

    const initJson = await initRes.json();

    if (!initRes.ok) {
      throw new Error(JSON.stringify(initJson));
    }

    return Response.json({
      success: true,
      connectionId,
      connectUrl: initJson.connectUrl || initJson.scaOAuth
    });

  } catch (err) {
    return Response.json({
      success: false,
      error: err.message
    });
  }
});
