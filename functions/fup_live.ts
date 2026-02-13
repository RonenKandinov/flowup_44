Deno.serve(async (req) => {
  const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
  const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

  if (req.method !== "POST") return new Response("Use POST", { status: 405 });

  try {
    const body = await req.json();
    const psuId = body.psuId;
    
    if (!psuId) throw new Error("Missing psuId in Payload");

    // 1. קבלת טוקן - כולל ה-userId והכתובת המדויקת מהדוקומנטציה
    const tokenRes = await fetch("https://api.open-finance.ai/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        userId: psuId,        // הנה תעודת הזהות שלך נכנסת לפעולה
        clientId: API_KEY, 
        clientSecret: API_SECRET 
      })
    });

    if (!tokenRes.ok) {
      const errorMsg = await tokenRes.text();
      throw new Error(`Auth Error (${tokenRes.status}): ${errorMsg}`);
    }

    const tokenData = await tokenRes.json();
    const access_token = tokenData.access_token;

    // 2. יצירת חיבור (Connection)
    const connRes = await fetch("https://api.open-finance.ai/v2/connections", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${access_token}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ customerId: psuId, connectionMode: "PSD2", language: "he" })
    });
    
    if (!connRes.ok) {
        const connErr = await connRes.text();
        throw new Error(`Connection Error: ${connRes.status} - ${connErr}`);
    }
    const connData = await connRes.json();

    // 3. יצירת לינק להתחברות לבנק לאומי (Init)
    const initRes = await fetch("https://api.open-finance.ai/v2/connect/open-banking-init", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${access_token}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ 
        connectionId: connData.id, 
        providerId: "leumi-sandbox", 
        psuId: psuId, 
        psuIdType: "NATIONAL_ID" 
      })
    });
    
    if (!initRes.ok) {
        const initErr = await initRes.text();
        throw new Error(`Init Error: ${initRes.status} - ${initErr}`);
    }
    const initData = await initRes.json();

    // מחזיר את הלינק הסופי!
    return Response.json({ 
      success: true, 
      url: initData.connectUrl || initData.scaOAuth || initData.url 
    });

  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
});