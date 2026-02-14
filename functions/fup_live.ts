Deno.serve(async (req) => {
  const BASE_URL = "https://api.open-finance.ai/v2";
  const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
  const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

  try {
    const { psuId } = await req.json();

    // 1. קבלת טוקן
    const tokenRes = await fetch(`${BASE_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: psuId, clientId: API_KEY, clientSecret: API_SECRET })
    });
    const { access_token } = await tokenRes.json();

    // 2. איתור החיבור הפעיל שלך
    const listRes = await fetch(`${BASE_URL}/connections?customerId=${psuId}`, {
      headers: { "Authorization": `Bearer ${access_token}` }
    });
    const connections = await listRes.json();
    const activeConn = connections.find(c => c.status === "CONNECTED");

    if (!activeConn) throw new Error("לא נמצא חיבור פעיל");

    // 3. שליפת רשימת החשבונות
    const accountsRes = await fetch(`${BASE_URL}/accounts`, {
      headers: { "Authorization": `Bearer ${access_token}`, "X-Connection-Id": activeConn.id }
    });
    const accounts = await accountsRes.json();
    
    // ניקח את ה-ID של החשבון הראשון שמצאנו
    const accountId = accounts[0]?.id;
    if (!accountId) throw new Error("לא נמצאו חשבונות בחיבור הזה");

    // 4. שליפת העסקאות עבור החשבון הזה
    const transRes = await fetch(`${BASE_URL}/transactions?accountId=${accountId}`, {
      headers: { 
        "Authorization": `Bearer ${access_token}`,
        "X-Connection-Id": activeConn.id 
      }
    });
    const transactions = await transRes.json();

    // החזרת הנתונים בצורה מסודרת
    return Response.json({
      success: true,
      bank: activeConn.providerId,
      account_summary: {
        id: accountId,
        balance: accounts[0].balances?.current?.amount,
        currency: accounts[0].currency
      },
      recent_transactions: transactions.slice(0, 5) // מציג רק את 5 העסקאות האחרונות
    });

  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
});