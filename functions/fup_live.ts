Deno.serve(async (req) => {
  const BASE_URL = "https://api.open-finance.ai/v2";
  const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
  const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

  try {
    const { psuId } = await req.json();

    // 1. קבלת טוקן רענן
    const tokenRes = await fetch(`${BASE_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: psuId, clientId: API_KEY, clientSecret: API_SECRET })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("שגיאת טוקן: " + JSON.stringify(tokenData));
    const access_token = tokenData.access_token;

    // 2. שליפת רשימת החיבורים
    const listRes = await fetch(`${BASE_URL}/connections?customerId=${psuId}`, {
      headers: { "Authorization": `Bearer ${access_token}` }
    });
    const connections = await listRes.json();
    
    // בדיקה שהחזיר מערך (כדי למנוע את שגיאת ה-find)
    if (!Array.isArray(connections)) throw new Error("השרת לא החזיר רשימת חיבורים תקינה");

    const activeConn = connections.find(c => c.status === "CONNECTED");
    if (!activeConn) throw new Error("לא נמצא חיבור פעיל. אנא בצע הזדהות מחדש");

    // 3. שליפת החשבון הראשון
    const accountsRes = await fetch(`${BASE_URL}/accounts`, {
      headers: { "Authorization": `Bearer ${access_token}`, "X-Connection-Id": activeConn.id }
    });
    const accounts = await accountsRes.json();
    const accountId = accounts[0]?.id;

    if (!accountId) throw new Error("לא נמצאו חשבונות לחיבור זה");

    // 4. שליפת העסקאות (הדובדבן שבקצפת)
    const transRes = await fetch(`${BASE_URL}/transactions?accountId=${accountId}`, {
      headers: { 
        "Authorization": `Bearer ${access_token}`,
        "X-Connection-Id": activeConn.id 
      }
    });
    const transactions = await transRes.json();

    return Response.json({
      success: true,
      bank: activeConn.providerId,
      balance: accounts[0].balances?.current?.amount + " " + accounts[0].currency,
      transactions_count: transactions.length,
      recent_data: transactions.slice(0, 3) // מציג 3 עסקאות לדוגמה
    });

  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
});