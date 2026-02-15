Deno.serve(async (req) => {
  try {
    const API_ROOT = "https://api.open-finance.ai";
    const API_V2 = "https://api.open-finance.ai/v2";
    const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
    const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

    const body = await req.json();
    const userId = body?.userId || "ronenk2424@gmail.com";

    // 1. קבלת טוקן
    const tokenRes = await fetch(`${API_ROOT}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, clientId: API_KEY, clientSecret: API_SECRET })
    });
    const { accessToken } = await tokenRes.json();

    // 2. משיכת עסקאות
    const txRes = await fetch(`${API_V2}/data/transactions`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
    });
    const txData = await txRes.json();
    const transactions = txData.data || txData.items || [];

    let income = 0, fixed = 0, lifestyle = 0;

    transactions.forEach((tx) => {
      const amount = tx.amount?.chargedAmount?.amount || 0;
      const category = (tx.category?.main || "").toLowerCase();
      
      if (amount > 0) income += amount;
      else {
        const absAmt = Math.abs(amount);
        const isFixed = ["housing", "loan", "insurance", "transportation"].some(c => category.includes(c));
        if (isFixed) fixed += absAmt;
        else lifestyle += absAmt;
      }
    });

    const dti = income > 0 ? (fixed / income) * 100 : 0;

    // 🚀 החזרת התשובה עם הניתוח החדש
    return Response.json({
      success: true,
      metrics: {
        totalIncome: Math.round(income),
        fixedExpenses: Math.round(fixed),
        lifestyleExpenses: Math.round(lifestyle),
        dti: parseFloat(dti.toFixed(1)),
        status: dti < 40 ? "GREEN" : dti < 60 ? "ORANGE" : "RED"
      },
     
      analysis: {
        loanEligibility: dti < 40,    
        safetyMargin: parseFloat((40 - dti).toFixed(1)),
        financialStrengthScore: Math.round(100 - (dti * 2.5)) 
      }
    });

  } catch (err) {
    return Response.json({ error: "Analysis Failed", details: err.message }, { status: 500 });
  }
});