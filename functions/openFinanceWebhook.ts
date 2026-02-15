const API_ROOT = "https://api.open-finance.ai";
const API_V2 = "https://api.open-finance.ai/v2";

const REAL_USER_ID = "ronenk2424@gmail.com"; // אותו userId שיצר את החיבור

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { error: "Method not allowed" },
        { status: 405 }
      );
    }

    const payload = await req.json();
    const { eventType, connectionId } = payload;

    console.log("🔔 Webhook received:", payload);

    if (!eventType || !connectionId) {
      return Response.json(
        { error: "Missing eventType or connectionId" },
        { status: 400 }
      );
    }

    if (eventType === "DATA_READY") {

      console.log("📥 DATA_READY → fetching connection data...");

      // 1️⃣ Get Access Token (correct userId!)
      const tokenRes = await fetch(`${API_ROOT}/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: REAL_USER_ID,
          clientId: Deno.env.get("OPEN_FINANCE_API_KEY"),
          clientSecret: Deno.env.get("OPEN_FINANCE_API_SECRET")
        })
      });

      const tokenJson = await tokenRes.json();

      if (!tokenRes.ok || !tokenJson?.accessToken) {
        console.error("❌ Failed to get token:", tokenJson);
        return Response.json(
          { error: "Failed to get access token" },
          { status: 500 }
        );
      }

      const accessToken = tokenJson.accessToken;

      // 2️⃣ Fetch full connection
      const dataRes = await fetch(
        `${API_V2}/connections/${connectionId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json"
          }
        }
      );

      const dataJson = await dataRes.json();

      if (!dataRes.ok) {
        console.error("❌ Failed to fetch connection:", dataJson);
        return Response.json(
          { error: "Failed to fetch connection", details: dataJson },
          { status: 500 }
        );
      }

      console.log("📦 Connection data:", dataJson);

      return Response.json({
        success: true,
        transactionsCount: dataJson.transactions,
        accountsCount: dataJson.accounts
      });
    }

    return Response.json({ received: true });

  } catch (err) {
    console.error("Webhook Error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
});