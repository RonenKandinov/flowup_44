Deno.serve(async (req) => {
  const API_ROOT = "https://api.open-finance.ai";
  const API_V2 = "https://api.open-finance.ai/v2";

  const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
  const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

  const url = new URL(req.url);

  try {
    if (!API_KEY || !API_SECRET) {
      return Response.json({ error: "Missing API credentials" });
    }

    // ========================================
    // STEP 1️⃣ - START CONNECTION (POST)
    // ========================================
    if (req.method === "POST") {
      const { userId, psuId } = await req.json();

      // 1. Get machine token
      const tokenRes = await fetch(`${API_ROOT}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          clientId: API_KEY,
          clientSecret: API_SECRET
        })
      });

      const tokenJson = await tokenRes.json();
      const access_token = tokenJson.accessToken;

      if (!access_token) {
        return Response.json({ error: tokenJson });
      }

      // 2. Create connection
      const connRes = await fetch(`${API_V2}/connections`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          connectionMode: "PSD2"
        })
      });

      const connJson = await connRes.json();
      const connectionId = connJson.id;

      // 3. Init open banking
      const initRes = await fetch(`${API_V2}/connect/open-banking-init`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          connectionId,
          providerId: "mizrahi-sandbox",
          psuId,
          psuIdType: "NATIONAL_ID",
          redirectUrl: url.origin + url.pathname // חוזר לאותה פונקציה
        })
      });

      const initJson = await initRes.json();
      const redirectUrl = initJson.connectUrl;

     return Response.json({
  success: true,
  initResponse: initJson
});
    }

    // ========================================
    // STEP 2️⃣ - CALLBACK (GET עם code)
    // ========================================
    const code = url.searchParams.get("code");

    if (code) {
      // exchange authorization code
      const tokenRes = await fetch(`${API_ROOT}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grantType: "authorization_code",
          code,
          clientId: API_KEY,
          clientSecret: API_SECRET
        })
      });

      const tokenJson = await tokenRes.json();
      const access_token = tokenJson.accessToken;

      if (!access_token) {
        return Response.json({ error: tokenJson });
      }

      // get authorized connection
      const connectionsRes = await fetch(`${API_V2}/connections`, {
        headers: {
          "Authorization": `Bearer ${access_token}`
        }
      });

      const connections = await connectionsRes.json();

      const authorized = connections.data?.find(
        (c) => c.status === "AUTHORIZED"
      );

      if (!authorized) {
        return Response.json({ error: "No authorized connection found" });
      }

      const connectionId = authorized.id;

      // get accounts
      const accountsRes = await fetch(
        `${API_V2}/connections/${connectionId}/accounts`,
        {
          headers: {
            "Authorization": `Bearer ${access_token}`
          }
        }
      );

      const accounts = await accountsRes.json();
      const accountId = accounts.data?.[0]?.id;

      if (!accountId) {
        return Response.json({ error: "No accounts found", accounts });
      }

      // get transactions
      const txRes = await fetch(
        `${API_V2}/accounts/${accountId}/transactions`,
        {
          headers: {
            "Authorization": `Bearer ${access_token}`
          }
        }
      );

      const transactions = await txRes.json();

      return Response.json({
        success: true,
        connectionId,
        accounts,
        transactions
      });
    }

    return Response.json({ message: "No action" });

  } catch (err) {
    return Response.json({
      error: err.message
    });
  }
});