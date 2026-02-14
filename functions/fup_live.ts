Deno.serve(async (req) => {
  const API_ROOT = "https://api.open-finance.ai";
  const API_V2 = "https://api.open-finance.ai/v2";

  const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
  const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

  try {
    if (!API_KEY || !API_SECRET) {
      return Response.json({
        success: false,
        error: "Missing API credentials"
      });
    }

    const { userId, psuId } = await req.json();

    if (!userId || !psuId) {
      return Response.json({
        success: false,
        error: "userId and psuId are required"
      });
    }

    // ===============================
    // 1️⃣ GET TOKEN
    // ===============================
    const tokenRes = await fetch(`${API_ROOT}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        
        clientId: API_KEY,
        clientSecret: API_SECRET
      })
    });

    const tokenJson = await tokenRes.json();

    console.log("TOKEN STATUS:", tokenRes.status);
    console.log("TOKEN RESPONSE:", tokenJson);

    if (!tokenRes.ok) {
      return Response.json({
        success: false,
        step: "TOKEN",
        error: tokenJson
      });
    }

   const access_token = tokenJson.accessToken;

if (!access_token) {
  return Response.json({
    success: false,
    step: "TOKEN_NO_ACCESS_TOKEN",
    tokenResponse: tokenJson
  });
}


    // ===============================
    // 🔎 DECODE TOKEN
    // ===============================
    const payload = JSON.parse(
      atob(access_token.split(".")[1])
    );

    console.log("DECODED TOKEN:", payload);

    // ===============================
    // 🔎 TEST GET CONNECTIONS
    // ===============================
    const testRes = await fetch(`${API_V2}/connections`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${access_token}`
      }
    });

    const testJson = await testRes.json();

    console.log("TEST GET STATUS:", testRes.status);
    console.log("TEST GET RESPONSE:", testJson);

    if (!testRes.ok) {
      return Response.json({
        success: false,
        step: "TEST_GET_CONNECTIONS",
        error: testJson,
        decodedToken: payload
      });
    }

    // ===============================
    // 2️⃣ CREATE CONNECTION
    // ===============================
    const connRes = await fetch(`${API_V2}/connections`, {
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

    console.log("CREATE CONNECTION STATUS:", connRes.status);
    console.log("CREATE CONNECTION RESPONSE:", connJson);

    if (!connRes.ok) {
      return Response.json({
        success: false,
        step: "CREATE_CONNECTION",
        error: connJson,
        decodedToken: payload
      });
    }

    const connectionId = connJson.id;

    // ===============================
    // 3️⃣ INIT OPEN BANKING
    // ===============================
    const initRes = await fetch(`${API_V2}/connect/open-banking-init`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        connectionId,
        providerId: "mizrahi-tefahot-sandbox",
        psuId,
        psuIdType: "NATIONAL_ID",
        redirectUri: "https://google.com"
      })
    });

    const initJson = await initRes.json();

    console.log("INIT STATUS:", initRes.status);
    console.log("INIT RESPONSE:", initJson);

    if (!initRes.ok) {
      return Response.json({
        success: false,
        step: "INIT",
        error: initJson
      });
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