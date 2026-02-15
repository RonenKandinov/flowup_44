Deno.serve(async (req) => {
  try {
    const API_ROOT = "https://api.open-finance.ai";
    const API_V2 = "https://api.open-finance.ai/v2";

    const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
    const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

    if (!API_KEY || !API_SECRET) {
      return Response.json({
        error: "Missing Open Finance credentials"
      }, { status: 500 });
    }

    const { userId } = await req.json();

    if (!userId) {
      return Response.json({
        error: "userId is required"
      }, { status: 400 });
    }

    // ===============================
    // 1️⃣ GET ACCESS TOKEN
    // ===============================
    const tokenRes = await fetch(`${API_ROOT}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId,
        clientId: API_KEY,
        clientSecret: API_SECRET
      })
    });

    const tokenJson = await tokenRes.json();

    if (!tokenRes.ok) {
      return Response.json({
        error: "Failed to get access token",
        tokenJson
      }, { status: 500 });
    }

    const access_token = tokenJson.accessToken;

    // ===============================
    // 2️⃣ GET CONNECTIONS
    // ===============================
    const connectionsRes = await fetch(`${API_V2}/connections`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/json"
      }
    });

    const connectionsJson = await connectionsRes.json();

    if (!connectionsRes.ok) {
      return Response.json({
        error: "Failed to fetch connections",
        connectionsJson
      }, { status: 500 });
    }

    const list =
      connectionsJson.items ||
      connectionsJson.data ||
      connectionsJson;

    const completed = list.find(
      (c) => c.status === "COMPLETED"
    );

    if (!completed) {
      return Response.json({
        error: "No COMPLETED connection found",
        connections: list
      }, { status: 404 });
    }

    const connectionId = completed.id;

    // ===============================
    // 3️⃣ GET ACCOUNTS
    // ===============================
    const accountsRes = await fetch(
      `${API_V2}/accounts?connectionId=${connectionId}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/json"
        }
      }
    );

    const accountsJson = await accountsRes.json();

    if (!accountsRes.ok) {
      return Response.json({
        error: "Failed to fetch accounts",
        accountsJson
      }, { status: 500 });
    }

    const accounts =
      accountsJson.items ||
      accountsJson.data ||
      accountsJson;

    // ===============================
    // 4️⃣ GET TRANSACTIONS
    // ===============================
    const transactionsRes = await fetch(
      `${API_V2}/transactions?connectionId=${connectionId}&fromDate=2025-01-01`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/json"
        }
      }
    );

    const transactionsJson = await transactionsRes.json();

    if (!transactionsRes.ok) {
      return Response.json({
        error: "Failed to fetch transactions",
        transactionsJson
      }, { status: 500 });
    }

    const transactions =
      transactionsJson.items ||
      transactionsJson.data ||
      transactionsJson;

    // ===============================
    // SUCCESS RESPONSE
    // ===============================
    return Response.json({
      success: true,
      connectionId,
      accountsCount: accounts.length || 0,
      transactionsCount: transactions.length || 0,
      accounts,
      transactions
    });

  } catch (err) {
    return Response.json({
      error: "Unexpected error",
      message: err.message
    }, { status: 500 });
  }
});
