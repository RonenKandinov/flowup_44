Deno.serve(async (req) => {
  // 1. משיכת המפתחות מה-Secrets וניקוי רווחים
  const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY")?.trim();
  const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET")?.trim();

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const { psuId } = await req.json();
    if (!psuId) throw new Error("Missing psuId in payload");

    console.log(`Starting process for user: ${psuId}`);

    // שלב א': קבלת Access Token
    const tokenRes = await fetch("https://api.open-finance.ai/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        userId: psuId, 
        clientId: API_KEY, 
        clientSecret: API_SECRET 
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(`Auth failed: ${JSON.stringify(tokenData)}`);
    const accessToken = tokenData.accessToken || tokenData.access_token;

    // שלב ב': יצירת חיבור (Connection)
    const connRes = await fetch("https://api.open-finance.ai/v2/connections", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${accessToken}`, 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        customerId: psuId, 
        connectionMode: "PSD2", 
        language: "he" 
      })
    });

    const connData = await connRes.json();
    if (!connRes.ok) throw new Error(`Connection creation failed: ${JSON.stringify(connData)}`);

    // שלב ג': קבלת הלינק לבנק (Init)
    const initRes = await fetch("https://api.open-finance.ai/v2/connect/open-banking-init", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${accessToken}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ 
        connectionId: connData.id, 
        providerId: "leumi-sandbox", 
        psuId: psuId, 
        psuIdType: "NATIONAL_ID" 
      })
    });

    const initData = await initRes.json();
    const finalUrl = initData.connectUrl || initData.scaOAuth || initData.url;

    if (!finalUrl) throw new Error("Bank URL not found in response");

    console.log("Success! Link generated.");

    // השלב הקריטי: מחזירים את ה-URL שהאפליקציה מחפשת
    return Response.json({ 
      success: true, 
      url: finalUrl 
    });

  } catch (err) {
    console.error(`Error: ${err.message}`);
    return Response.json({ 
      success: false, 
      error: err.message 
    }, { status: 500 });
  }
});