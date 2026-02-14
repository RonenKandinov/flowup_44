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
    // 1️⃣ GET TOKEN (userId חובה כאן)
    // ===============================
    const tokenRes = await fetch(`${API_ROOT}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId,               // ✅ חייב כאן
        clientId: API_KEY,
        clientSecret: API_SECRET
      })
    });

    const tokenJson = await tokenRes.json();

    if (!tokenRes.ok) {
      return Response.json({
        success: false,
        step: "TOKEN",
        error: tokenJson
      });
    }

    // חשוב: השדה הנכון הוא accessToken (CamelCase)
    const access_token = tokenJson.accessToken;

    if (!access_token) {
      return Response.json({
        success: false,
        step: "TOKEN_NO_ACCESS_TOKEN",
        tokenResponse: tokenJson
      });
    }

    // ===============================
    // 2️⃣ CREATE CONNECTION (בלי userId!)
    // ===============================
    const connRes = await fetch(`${API_V2}/connections`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        connectionMode: "PSD2",
        includeFakeProviders: true
      })
    });

    const connJson = await connRes.json();

    if (!connRes.ok) {
      return Response.json({
        success: false,
        step: "CREATE_CONNECTION",
        error: connJson
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
       providerId: "mizrahi-sandbox",
        psuId,                      // ת"ז
        psuIdType: "NATIONAL_ID"
      })
    });

    const initJson = await initRes.json();

    if (!initRes.ok) {
      return Response.json({
        success: false,
        step: "INIT",
        error: initJson
      });
    }

    return new Response(null, {
  status: 302,
  headers: {
    Location: initJson.connectUrl
  }
});

  } catch (err) {
    return Response.json({
      success: false,
      error: err.message
    });
  }
});