Deno.serve(async (req) => {
  try {
    const API_ROOT = "https://api.open-finance.ai";
    const API_V2 = "https://api.open-finance.ai/v2";
    const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
    const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

    const body = await req.json();
    const userId = body?.userId || "ronenk2424@gmail.com";

    // 1️⃣ Token
    const tokenRes = await fetch(`${API_ROOT}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, clientId: API_KEY, clientSecret: API_SECRET })
    });

    const { accessToken } = await tokenRes.json();

    // 2️⃣ Transactions
    const txRes = await fetch(`${API_V2}/data/transactions`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    });

    const txData = await txRes.json();
    const transactions = txData.data || txData.items || [];

    let income = 0;
    let fixed = 0;
    let lifestyle = 0;

    transactions.forEach((tx) => {
      const amount = tx.amount?.chargedAmount?.amount || 0;
      const category = (tx.category?.main || "").toLowerCase();
      const direction = (tx.type || tx.direction || "").toLowerCase();

      // CREDIT = income
      if (direction.includes("credit")) {
        income += Math.abs(amount);
      }

      // DEBIT = expense
      if (direction.includes("debit")) {
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

    // 🚨 Hard Fail Rules
    let status = "GREEN";

    if (netCashFlow < 0) status = "RED";
    else if (dti >= 60) status = "RED";
    else if (dti >= 40) status = "ORANGE";

    // 🎯 Strength Score
    let rawScore =
      100 -
      (dti * 1.5) -
      (netCashFlow < 0 ? 30 : 0);

    // clamp
    const financialStrengthScore = Math.max(
      0,
      Math.min(100, Math.round(rawScore))
    );

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
    return Response.json(
      { error: "Analysis Failed", details: err.message },
      { status: 500 }
    );
  }
});