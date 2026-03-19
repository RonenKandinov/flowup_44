Deno.serve(async (req) => {
  try {
    const API_ROOT = "https://api.open-finance.ai";
    const API_V2 = "https://api.open-finance.ai/v2";
    const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
    const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

    const body = await req.json();
    const userId = body?.userId || "ronenk2424@gmail.com";

    // 1️⃣ קבלת Access Token
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
      throw new Error("Failed to get access token");
    }
    const accessToken = tokenJson.accessToken;

    // 2️⃣ משיכת עסקאות (Transactions)
    const txRes = await fetch(`${API_V2}/data/transactions`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    });

    const txData = await txRes.json();
    const transactions = txData?.data || txData?.items || txData?.transactions || [];

    // 3️⃣ עיבוד נתונים ולוגיקה פיננסית
    let income = 0;
    let fixed = 0;
    let lifestyle = 0;

    transactions.forEach((tx) => {
      const amount = Number(tx?.amount?.chargedAmount?.amount || 0);
      const category = (tx?.category?.main || "").toLowerCase();

      if (amount > 0) {
        income += amount; // הכנסות
      } else {
        const absAmt = Math.abs(amount);
        // זיהוי הוצאות קבועות (Fixed)
        const isFixed = ["housing", "loan", "insurance", "transportation", "utilities", "rent"]
          .some((c) => category.includes(c));

        if (isFixed) fixed += absAmt;
        else lifestyle += absAmt; // הוצאות בילוי ופנאי
      }
    });

    const totalExpenses = fixed + lifestyle;
    const netCashFlow = income - totalExpenses;
    const dti = income > 0 ? (fixed / income) * 100 : 100;

    // 4️⃣ לוגיקת החיתום המדויקת (התאמה למחוג בדאשבורד)
    let status = "GREEN";
    let statusColor = "#10B981"; // צבע ירוק
 
    if (dti >= 57 || netCashFlow < 0) {
      status = "RED";
      statusColor = "#EF4444";
    } else if (dti >= 40) {
      status = "ORANGE";
      statusColor = "#F59E0B";
    }

    // חישוב הציון (Score) - שיקלול של DTI ונזילות
    let rawScore = 100 - (dti * 1.2);
    if (netCashFlow < 0) rawScore -= 20;
    
    let finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

    // --- EXTREME RISK CLAMP LAYER ---
    const isExtremeDTI = dti > 120;
    const isExtremeCashFlow = income > 0 ? (totalExpenses > income * 1.2) : (totalExpenses > 0);
    
    if (isExtremeDTI || isExtremeCashFlow) {
        finalScore = Math.min(finalScore, 10);
        if (dti > 150 || (income > 0 && totalExpenses > income * 1.5)) {
             finalScore = Math.min(finalScore, 5);
        }
    }
    // --------------------------------

    // 5️⃣ החזרת התוצאה לפרונטנד
    return Response.json({
      success: true,
      score: finalScore,
      status,
      color: statusColor,
      metrics: {
        totalIncome: Math.round(income),
        fixedExpenses: Math.round(fixed),
        lifestyleExpenses: Math.round(lifestyle),
        totalExpenses: Math.round(totalExpenses),
        netCashFlow: Math.round(netCashFlow),
        dti: parseFloat(dti.toFixed(2))
      },
      analysis: {
        loanEligibility: status !== "RED",
        monthlySurplus: Math.round(netCashFlow)
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