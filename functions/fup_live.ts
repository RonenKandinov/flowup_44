Deno.serve(async (req) => {
  const API_BASE = "https://api.open-finance.ai";
  const API_V2 = "https://api.open-finance.ai/v2";

  const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
  const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

  try {
    if (!API_KEY || !API_SECRET) {
      throw new Error("Missing API credentials");
    }

    const { psuId } = await req.json();

    if (!psuId) {
      throw new Error("psuId is required");
    }

    // =========================
    // 1️⃣ TOKEN
    // =========================
    const tokenRes = await fetch(`${API_BASE}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: API_KEY,
        clientSecret: API_SECRET
      })
    });

    if (!tokenRes.ok) {
      throw new Error(await tokenRes.text());
    }

    const tokenJson = await tokenRes.json();
    const access_token = tokenJson.accessToken;

    if (!access_token) {
      throw new Error("No accessToken returned");
    }

    // =========================
    // 2️⃣ CREATE CONNECTION
    // =========================
    const connRes = await fetch(`${API_V2}/connections`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
     body: JSON.stringify({
  data: {
    userId: psuId,
    connectionMode: "PSD2",
    includeFakeProviders: true
  }
})
    });

    const connText = await connRes.text();

    if (!connRes.ok) {
      throw new Error(connText);
    }

    const connData = JSON.parse(connText);

    if (!connData.id) {
      throw new Error("Connection ID missing");
    }

    // =========================
    // 3️⃣ INIT FLOW
    // =========================
    const initRes = await fetch(`${API_V2}/connect/open-banking-init`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        connectionId: connData.id,
        providerId: "hapoalim-sandbox",
        psuId: psuId,
        psuIdType: "NATIONAL_ID",
        redirectUri: "https://google.com"
      })
    });

    const initText = await initRes.text();

    if (!initRes.ok) {
      throw new Error(initText);
    }

    const initData = JSON.parse(initText);

    return Response.json({
      success: true,
      connectionId: connData.id,
      connectUrl: initData.connectUrl || initData.scaOAuth || null
    });

  } catch (err) {
    return Response.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
});
