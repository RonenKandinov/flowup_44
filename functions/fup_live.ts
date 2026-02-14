Deno.serve(async (req) => {
  const BASE_URL = "https://api.open-finance.ai/v2";
  const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
  const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

  try {
    const { psuId } = await req.json();

    // 1. קבלת טוקן (כבר ראינו שזה עובד לך)
    const tokenRes = await fetch(`${BASE_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: psuId, clientId: API_KEY, clientSecret: API_SECRET })
    });
    const { access_token } = await tokenRes.json();

    // 2. איתור החיבור הפעיל (מזרחי טפחות שאישרת)
    const listRes = await fetch(`${BASE_URL}/connections?customerId=${psuId}`, {
      headers: { "Authorization": `Bearer ${access_token}` }
    });
    const connections = await listRes.json();
    const activeConn = connections.find(c => c.status === "CONNECTED");

    if (!activeConn) {
      return Response.json({ error: "לא נמצא חיבור פעיל. וודא שאישרת את הלינק בדפדפן." });
    }

    // 3. שליפת רשימת החשבונות מהבנק
    const accountsRes = await fetch(`${BASE_URL}/accounts`, {
      headers: { 
        "Authorization": `Bearer ${access_token}`,
        "X-Connection-Id": activeConn.id 
      }
    });
    const accounts = await accountsRes.json();
    const accountId = accounts[0]?.id;

    if (!accountId) {
      return Response.json({ error: "החיבור קיים אך לא נמצאו חשבונות." });
    }

    // 4. שליפת העסקאות של החשבון
    const transRes = await fetch(`${BASE_URL}/transactions?accountId=${accountId}`, {
      headers: { 
        "Authorization": `Bearer ${access_token}`,
        "X-Connection-Id": activeConn.id 
      }
    });
    const transactions = await transRes.json();

    // הצגת התוצאה הסופית
    return Response.json({
      success: true,
      bank: activeConn.providerId,
      balance: accounts[0].balances?.current?.amount + " " + accounts[0].currency,
      total_transactions: transactions.length,
      transactions: transactions.slice(0, 10) // מציג 10 עסקאות אחרונות
    });

  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
});