Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const API_ROOT = "https://api.open-finance.ai";
    const API_V2 = "https://api.open-finance.ai/v2";
    const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
    const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

    const body = await req.json().catch(() => ({}));
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

    if (!Array.isArray(transactions)) {
      throw new Error("Invalid transactions response");
    }

    let income = 0;
    let fixed = 0;
    let lifestyle = 0;
    let savedTransactions = 0;

    // ===============================
    // 3️⃣ Ingestion + Calculation
    // ===============================
    for (const tx of transactions) {

      const amount = Number(
        tx?.amount?.chargedAmount?.amount || 0
      );

      const category =
        (tx?.category?.main || "").toLowerCase();

      // ---------------------------
      // 💾 Save Transaction if new
      // ---------------------------
      const existing = await base44.asServiceRole
        .entities.OpenFinanceTransaction
        .filter({ transaction_id: tx.id });

      if (existing.length === 0) {
        await base44.asServiceRole
          .entities.OpenFinanceTransaction
          .create({
            transaction_id: tx.id,
            account_id: tx.accountId || "unknown",
            connection_id: "auto_sync",
            amount,
            currency: tx?.amount?.chargedAmount?.currency || "ILS",
            date: tx?.bookingDate || new Date().toISOString(),
            description: tx?.description || "",
            category: tx?.category?.main || "",
            status: tx?.status || "booked"
          });

        savedTransactions++;
      }

      // ---------------------------
      // 📊 Financial Calculation
      // ---------------------------
      if (amount > 0) {
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
    }

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

    const rawScore =
      100 -
      (dti * 1.5) -
      (netCashFlow < 0 ? 30 : 0);

    const financialStrengthScore = Math.max(
      0,
      Math.min(100, Math.round(rawScore))
    );

    // ===============================
    // 5️⃣ Save Snapshot
    // ===============================
    await base44.asServiceRole.entities.FinancialSnapshot.create({
      user_id: userId,
      total_income: Math.round(income),
      fixed_expenses: Math.round(fixed),
      lifestyle_expenses: Math.round(lifestyle),
      total_expenses: Math.round(totalExpenses),
      net_cash_flow: Math.round(netCashFlow),
      dti: parseFloat(dti.toFixed(1)),
      status,
      financial_strength_score: financialStrengthScore,
      created_at: new Date().toISOString()
    });

    // ===============================
    // 6️⃣ Response
    // ===============================
    return Response.json({
      success: true,
      savedTransactions,
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