Deno.serve(async (req) => {
  const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY")?.trim();
  const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET")?.trim();

  try {
    const { psuId } = await req.json();

    // 1. טוקן
    const tokenRes = await fetch("https://api.open-finance.ai/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: psuId, clientId: API_KEY, clientSecret: API_SECRET })
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.accessToken || tokenData.access_token;

    // 2. חיבור ישיר - הוספתי הגדרות ל-Sandbox של הפועלים
    const initRes = await fetch("https://api.open-finance.ai/v2/connect/open-banking-init", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${accessToken}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ 
        providerId: "hapoalim-sandbox", 
        psuId: psuId, 
        psuIdType: "ID",
        connectionMode: "PSD2",
        // כתובת חזרה ברירת מחדל לסנדבוקס
        redirectUri: "https://portal.open-finance.ai/callback" 
      })
    });

    const initData = await initRes.json();
    const finalUrl = initData.connectUrl || initData.scaOAuth || initData.url;

    if (!finalUrl) throw new Error("No URL received");

    return Response.json({ success: true, url: finalUrl });

  } catch (err) {
    return Response.json({ success: false, error: err.message });
  }
});