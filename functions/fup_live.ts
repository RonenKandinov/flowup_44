Deno.serve(async (req) => {

  const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");

  const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");



  if (req.method !== "POST") return new Response("Use POST", { status: 405 });



  try {

    const { psuId } = await req.json();



    // 1. Get Access Token

    const tokenRes = await fetch("https://api.open-finance.ai/v2/oauth/token", {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ userId: psuId, clientId: API_KEY, clientSecret: API_SECRET })

    });

    const tokenData = await tokenRes.json();

    const access_token = tokenData.access_token;



    if (!access_token) throw new Error("Failed to get access token");



    // 2. Create Connection

    const connRes = await fetch("https://api.open-finance.ai/v2/connections", {

      method: "POST",

      headers: { "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json" },

      body: JSON.stringify({ customerId: psuId, connectionMode: "PSD2", language: "he" })

    });

    const connData = await connRes.json();



    if (!connData.id) throw new Error("Failed to create connection");



    // 3. Get Bank Link

    const initRes = await fetch("https://api.open-finance.ai/v2/connect/open-banking-init", {

      method: "POST",

      headers: { "Authorization": `Bearer ${access_token}`, "Content-Type": "application/json" },

      body: JSON.stringify({ connectionId: connData.id, providerId: "leumi-sandbox", psuId: psuId, psuIdType: "NATIONAL_ID" })

    });

    const initData = await initRes.json();



    return Response.json({

      success: true,

      url: initData.connectUrl || initData.scaOAuth

    });



  } catch (err) {

    return Response.json({ error: err.message }, { status: 500 });

  }

});