Deno.serve(async (req) => {
  try {
    const API_ROOT = "https://api.open-finance.ai";
    const API_V2 = "https://api.open-finance.ai/v2";
    const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
    const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

    const body = await req.json();
    const userId = body?.userId || "ronenk2424@gmail.com";

    if (!API_KEY || !API_SECRET) {
      return Response.json({
        success: false,
        error: "Missing API credentials"
      }, { status: 500 });
    }

    // ===============================
    // 1️⃣ Get Access Token
    // ===============================
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

    if (!tokenJson?.accessToken) {
      return Response.json({
        success: false,
        error: "Failed to get access token",
        raw: tokenJson
      }, { status: 500 });
    }

    const accessToken = tokenJson.accessToken;

    // ===============================
    // 2️⃣ Fetch Transactions
    // ===============================
    const txRes = await fetch(`${API_V2}/data/transactions`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    });

    const txData = await txRes.json();

    const transactions =
      txData?.data ||
      txData?.items ||
      txData?.transactions ||
      [];

    if (!Array.isArray(transactions)) {
      return Response.json({
        success: false,
        error: "Invalid transactions format"
      }, { status: 500 });
    }

    // ===============================
    // 3️⃣ Delete Old Transactions
    // ===============================
    await base44.entities.OpenFinanceTransaction.deleteMany({
      user_id: userId
    });

    // ===============================
    // 4️⃣ Save Transactions
    // ===============================
    for (const tx of transactions) {

      const amount = Number(
        tx?.amount?.chargedAmount?.amount ||
        tx?.amount ||
        0
      );

      await base44.entities.OpenFinanceTransaction.create({
        user_id: userId,
        transaction_id: tx.id || crypto.randomUUID(),
        bookingDate: tx.bookingDate || tx.valueDate || null,
        amount,
        category: tx?.category?.main || "",
        description: tx?.description || "",
        balance: tx?.balance || null,
        raw_json: tx
      });
    }

    return Response.json({
      success: true,
      saved: transactions.length
    });

  } catch (err) {
    return Response.json({
      success: false,
      error: err.message
    }, { status: 500 });
  }
});