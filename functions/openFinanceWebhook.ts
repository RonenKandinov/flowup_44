const API_ROOT = "https://api.open-finance.ai";
const API_V2 = "https://api.open-finance.ai/v2";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { error: "Method not allowed" },
        { status: 405 }
      );
    }

    const payload = await req.json();
    const { eventType, connectionId, status } = payload;

    console.log("🔔 Webhook received:", payload);

    if (!eventType || !connectionId) {
      return Response.json(
        { error: "Missing eventType or connectionId" },
        { status: 400 }
      );
    }

    // ==============================
    // Handle DATA_READY
    // ==============================
    if (eventType === "DATA_READY") {

      console.log("📥 DATA_READY → fetching transactions...");

      // 1️⃣ Get Access Token
      const tokenRes = await fetch(`${API_ROOT}/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: connectionId, // זמני לבדיקה
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

      // 2️⃣ Fetch Transactions
      const txRes = await fetch(
        `${API_V2}/transactions?connectionId=${connectionId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json"
          }
        }
      );

      const txJson = await txRes.json();

      if (!txRes.ok) {
        console.error("❌ Failed to fetch transactions:", txJson);
        return Response.json(
          { error: "Failed to fetch transactions" },
          { status: 500 }
        );
      }

      const transactions =
        txJson.items ||
        txJson.data ||
        [];

      console.log(`✅ Fetched ${transactions.length} transactions`);

      return Response.json({
        success: true,
        eventType,
        connectionId,
        transactionsCount: transactions.length
      });
    }

    // ==============================
    // Other Events
    // ==============================
    console.log("ℹ️ Event ignored:", eventType);

    return Response.json({ received: true });

  } catch (err) {
    console.error("Webhook Error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
});