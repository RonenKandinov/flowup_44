const ENV = {
    // הכתובת המעודכנת לפי צילום המסך שלך
    BASE_URL: "https://api.open-finance.ai/v2", 
    CLIENT_ID: Deno.env.get("OPEN_FINANCE_API_KEY"),
    CLIENT_SECRET: Deno.env.get("OPEN_FINANCE_API_SECRET")
};

async function getAccessToken(psuId) {
    // השלב הזה נשאר דומה - קבלת טוקן זמני
    const response = await fetch(`${ENV.BASE_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: psuId, 
            clientId: ENV.CLIENT_ID,
            clientSecret: ENV.CLIENT_SECRET
        })
    });
    const data = await response.json();
    return data.access_token;
}

Deno.serve(async (req) => {
    const url = new URL(req.url);

    // אנחנו מגדירים נתיב ספציפי כדי למנוע 404
    if (req.method === "POST" && url.pathname.endsWith("/connect")) {
        try {
            const { psuId } = await req.json();
            if (!psuId) return Response.json({ error: "psuId is required" }, { status: 400 });

            const token = await getAccessToken(psuId);

            // שלב 1: יצירת Connection לפי ה-Body בצילום המסך הראשון
            const connRes = await fetch(`${ENV.BASE_URL}/connections`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    customerId: psuId, // מופיע כ-Required בצילום
                    connectionMode: 'PSD2',
                    language: 'he',
                    includeFakeProviders: false,
                    refreshData: false,
                    iframe: false,
                    allowBusiness: false
                })
            });

            if (!connRes.ok) {
                const error = await connRes.text();
                throw new Error(`OpenFinance Error: ${error}`);
            }

            const { id: connectionId } = await connRes.json();

            // שלב 2: קבלת הלינק לבנק (SCA)
            const initRes = await fetch(`${ENV.BASE_URL}/connect/open-banking-init`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    connectionId,
                    providerId: "leumi-sandbox", // שנה ל-provider הרצוי
                    psuId: psuId,
                    psuIdType: "NATIONAL_ID"
                })
            });

            const initData = await initRes.json();
            
            return Response.json({
                connectionId,
                connectUrl: initData.connectUrl || initData.scaOAuth
            });

        } catch (err) {
            return Response.json({ error: err.message }, { status: 500 });
        }
    }

    return new Response("Not Found. Send POST to /connect", { status: 404 });
});
