Deno.serve(async (req) => {
  try {
    const API_ROOT = "https://api.open-finance.ai";
    const API_V2 = "https://api.open-finance.ai/v2";

    const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
    const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

    if (!API_KEY || !API_SECRET) {
      return Response.json(
        { error: "Missing Open Finance credentials" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const userId = body?.userId;

    if (!userId) {
      return Response.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // 🔑 Get Token (הגרסה שעבדה לך)
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

    if (!tokenRes.ok || !tokenJson?.accessToken) {
      return Response.json(
        { error: "Failed to get access token", tokenJson },
        { status: 500 }
      );
    }

    const accessToken = tokenJson.accessToken;

    // 📊 Get Transactions (endpoint שעבד לך)
    const txRes = await fetch(
      `${API_V2}/data/transactions`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json"
        }
      }
    );

    const transactionsJson = await txRes.json();

    if (!txRes.ok) {
      return Response.json(
        { error: "Failed to fetch transactions", transactionsJson },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      transactions: transactionsJson
    });

  } catch (err) {
    return Response.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
});