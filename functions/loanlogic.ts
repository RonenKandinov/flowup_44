Deno.serve(async (req) => {
  try {
    const API_ROOT = "https://api.open-finance.ai";
    const API_V2 = "https://api.open-finance.ai/v2";
    const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
    const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

    const body = await req.json();
    const userId = body?.userId || "ronenk2424@gmail.com";

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

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return Response.json({
        success: true,
        message: "No transactions found",
        metrics: {
          totalIncome: 0,
          fixedExpenses: 0,
          lifestyleExpenses: 0,
          totalExpenses: 0,
          netCashFlow: 0,
          dti: 100,
          status: "RED"
        },
        analysis: {
          loanEligibility: false,
          safetyMargin: 0,
          financialStrengthScore: 0
        }
      });
    }

    // ===============================
    // 3️⃣ Financial Calculation
    // ===============================

    let income = 0;
    let fixed = 0;
    let lifestyle = 0;

    transactions.forEach((tx) => {
      const amount = Number(
        tx?.amount?.chargedAmount?.amount || 0
      );

      const category =
        (tx?.category?.main || "").toLowerCase();

      if (amount > 0) {
        // CREDIT
        income += amount;
      }

      if (amount < 0) {
        const absAmt = Math.abs(amount);

        const isFixed = [
          "housing",
          "loan",
          "insurance",
          "transportation"
        ].some((c) => category.includes(c));

        if (isFixed) fixed += absAmt;
        else lifestyle += absAmt;
      }
    });

    const totalExpenses = fixed + lifestyle;
    const netCashFlow = income - totalExpenses;
    const dti = income > 0 ? (fixed / income) * 100 : 100;

    // ===============================
    // 4️⃣ Underwriting Logic
    // ===============================

    let status = "GREEN";

    if (netCashFlow < 0) status = "RED";
    else if (dti >= 60) status = "RED";
    else if (dti >= 40) status = "ORANGE";

    let rawScore =
      100 -
      (dti * 1.5) -
      (netCashFlow < 0 ? 30 : 0);

    const financialStrengthScore = Math.max(
      0,
      Math.min(100, Math.round(rawScore))
    );

    // ===============================
    // 5️⃣ Response
    // ===============================

    return Response.json({
      success: true,
      metrics: {
        totalIncome: Math.round(income),
        fixedExpenses: Math.round(fixed),
        lifestyleExpenses: Math.round(lifestyle),
        totalExpenses: Math.round(totalExpenses),
        netCashFlow: Math.round(netCashFlow),
        dti: parseFloat(dti.toFixed(1)),
        status
      },
      analysis: {
        loanEligibility: status === "GREEN",
        safetyMargin: Math.round(netCashFlow),
        financialStrengthScore
      }
    });

  } catch (err) {
    return Response.json({
      success: false,
      error: "Analysis Failed",
      details: err.message
    }, { status: 500 });
  }
});
