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

    // 2. איתור החיבור הפעיל
    const listRes = await fetch(`${BASE_URL}/connections?customerId=${psuId}`, {
      headers: { "Authorization": `Bearer ${access_token}` }
    });
   const listJson = await listRes.json();
console.log("RAW CONNECTION LIST:", listJson);

const connections = Array.isArray(listJson)
  ? listJson
  : listJson.data || [];
console.log("ALL CONNECTIONS FULL OBJECT:", JSON.stringify(connections, null, 2));
const activeConn = connections.find(c => c.status === "CONNECTED");


    if (!activeConn) {
      return Response.json({ message: "לא נמצא חיבור פעיל. וודא שאישרת במזרחי." });
    }

    // 3. שליפת חשבון
    const accountsRes = await fetch(`${BASE_URL}/accounts`, {
      headers: { "Authorization": `Bearer ${access_token}`, "X-Connection-Id": activeConn.id }
    });
    const accounts = await accountsRes.json();
    const accountId = accounts[0]?.id;

    // 4. שליפת עסקאות
    const transRes = await fetch(`${BASE_URL}/transactions?accountId=${accountId}`, {
      headers: { "Authorization": `Bearer ${access_token}`, "X-Connection-Id": activeConn.id }
    });
    const transactions = await transRes.json();

    // החזרת התוצאה המלאה למסך
    return Response.json({
      success: true,
      bank: activeConn.providerId,
      balance: accounts[0].balances?.current?.amount + " " + accounts[0].currency,
      transactions: transactions.slice(0, 10) // יציג את 10 העסקאות האחרונות
    });

  } catch (err) {
    return Response.json({ success: false, error: err.message });
  }
});