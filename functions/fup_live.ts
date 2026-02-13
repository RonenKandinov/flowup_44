
Deno.serve(async (req) => {
  const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY")?.trim();
  const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET")?.trim();

  if (req.method !== "POST") return new Response("Use POST", { status: 405 });

  try {
    const { psuId } = await req.json();
    if (!psuId) throw new Error("Missing psuId");

    // 1. קבלת טוקן
    const tokenRes = await fetch("https://api.open-finance.ai/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: psuId, clientId: API_KEY, clientSecret: API_SECRET })
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.accessToken || tokenData.access_token;

    // 2. יצירת חיבור (Connection)
    const connRes = await fetch("https://api.open-finance.ai/v2/connections", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${accessToken}`, 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ customerId: psuId, connectionMode: "PSD2", language: "he" })
    });
    const connData = await connRes.json();

    // 3. קבלת לינק ספציפי לפועלים סנדבוקס
    const initRes = await fetch("https://api.open-finance.ai/v2/connect/open-banking-init", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${accessToken}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ 
        connectionId: connData.id, 
        providerId: "hapoalim-sandbox", // שינוי לפועלים
        psuId: psuId, 
        psuIdType: "ID" 
      })
    });

    const initData = await initRes.json();
    const finalUrl = initData.connectUrl || initData.scaOAuth || initData.url;

    if (!finalUrl) {
      return Response.json({ 
        success: false, 
        error: "הבנק לא החזיר לינק. וודא שפועלים סנדבוקס מאושר בפורטל.",
        debug: initData 
      });
    }

    return Response.json({ 
      success: true, 
      url: finalUrl 
    });

  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
});