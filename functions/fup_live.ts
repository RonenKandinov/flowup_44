Deno.serve(async (req) => {
  const API_BASE = "https://api.open-finance.ai";
  const API_V2 = "https://api.open-finance.ai/v2";

  const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
  const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

  try {
    console.log("=== FLOWUP OPEN FINANCE START ===");

    if (!API_KEY || !API_SECRET) {
      throw new Error("Missing OPEN_FINANCE_API_KEY or OPEN_FINANCE_API_SECRET");
    }

    const { psuId } = await req.json();
    console.log("PSU ID:", psuId);

    // =====================================================
    // 1️⃣ GET ACCESS TOKEN
    // =====================================================
    console.log("STEP 1: Requesting Access Token...");

    const tokenRes = await fetch(`${API_BASE}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: API_KEY,
        client_secret: API_SECRET
      })
    });

    const tokenText = await tokenRes.text();
    console.log("TOKEN STATUS:", tokenRes.status);
    console.log("TOKEN RAW RESPONSE:", tokenText);

    if (!tokenRes.ok) {
      throw new Error(`Token request failed: ${tokenText}`);
    }

    const tokenData = JSON.parse(tokenText);

    if (!tokenData.accessToken) {
      throw new Error("No accessToken received from OAuth");
    }

    const access_token = tokenData.accessToken;
    console.log("ACCESS TOKEN RECEIVED");

    // =====================================================
    // 2️⃣ CREATE CONNECTION
    // =====================================================
    console.log("STEP 2: Creating Connection...");

    const connRes = await fetch(`${API_V2}/connections`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        customerId: psuId,
        connectionMode: "PSD2",
        includeFakeProviders: true
      })
    });

    const connText = await connRes.text();
    console.log("CONNECTION STATUS:", connRes.status);
    console.log("CONNECTION RAW RESPONSE:", connText);

    if (!connRes.ok) {
      throw new Error(`Connection failed: ${connText}`);
    }

    const connData = JSON.parse(connText);

    if (!connData.id) {
      throw new Error("Connection ID missing in response");
    }

    console.log("CONNECTION CREATED:", connData.id);

    // =====================================================
    // 3️⃣ INIT OPEN BANKING FLOW
    // =====================================================
    console.log("STEP 3: Initializing Open Banking...");

    const initRes = await fetch(`${API_V2}/connect/open-banking-init`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        connectionId: connData.id,
        providerId: "hapoalim-sandbox", // אם ייפול נבדוק provider list
        psuId: psuId,
        psuIdType: "NATIONAL_ID",
        redirectUri: "https://google.com"
      })
    });

    const initText = await initRes.text();
    console.log("INIT STATUS:", initRes.status);
    console.log("INIT RAW RESPONSE:", initText);

    if (!initRes.ok) {
      throw new Error(`Init failed: ${initText}`);
    }

    const initData = JSON.parse(initText);

    console.log("=== FLOW COMPLETE SUCCESS ===");

    return Response.json({
      success: true,
      connectionId: connData.id,
      connectUrl: initData.connectUrl || initData.scaOAuth || null,
      debug: {
        tokenStatus: tokenRes.status,
        connectionStatus: connRes.status,
        initStatus: initRes.status
      }
    });

  } catch (err) {
    console.error("=== FLOW FAILED ===");
    console.error(err);

    return Response.json({
      success: false,
      error: err.message
    }, { status: 500 });
  }
});