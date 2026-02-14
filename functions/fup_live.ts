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
    
    const tokenData = await tokenRes.json();
    
    // הדפסה ללוגים כדי שנראה מה השגיאה אם יש כזו
    console.log("DEBUG - Token Response:", JSON.stringify(tokenData));

    const access_token = tokenData.access_token;

    if (!access_token) {
      return Response.json({ 
        success: false, 
        error: "שגיאת טוקן - המפתחות לא מזוהים ב-Settings",
        debug: tokenData 
      });
    }

    // 2. בדיקת חיבור קיים (מזרחי שכבר אישרת)
    const listRes = await fetch(`${BASE_URL}/connections?customerId=${psuId}`, {
      headers: { "Authorization": `Bearer ${access_token}` }
    });
    const connections = await listRes.json();
    const activeConn = connections.find(c => c.status === "CONNECTED");

    if (!activeConn) {
      return Response.json({ 
        success: false, 
        message: "הטוקן עובד! אבל לא מצאתי חיבור פעיל. וודא שאישרת בדפדפן."
      });
    }

    return Response.json({
      success: true,
      token_found: true,
      connection_id: activeConn.id,
      bank: activeConn.providerId
    });

  } catch (err) {
    return Response.json({ success: false, error: err.message });
  }
});