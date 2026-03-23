import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

Deno.serve(async (req) => {
    try {
        const API_ROOT = "https://api.open-finance.ai";
        const API_V2 = "https://api.open-finance.ai/v2";
        const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
        const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

        const tokenRes = await fetch(`${API_ROOT}/oauth/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: "ronenk2424@gmail.com",
                clientId: API_KEY,
                clientSecret: API_SECRET
            })
        });

        const tokenJson = await tokenRes.json();
        const accessToken = tokenJson.accessToken;

        const accountsRes = await fetch(`${API_V2}/data/accounts`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json"
            }
        });

        const accountsData = await accountsRes.json();
        
        const items = accountsData?.data || accountsData?.items || accountsData?.accounts || [];
        return Response.json({
            accounts: items.map(a => ({
                accountNumber: a.accountNumber,
                type: a.accountType || a.type,
                balances: a.balances,
                balance: a.balance,
                currentBalance: a.currentBalance,
                availableBalance: a.availableBalance
            }))
        });
    } catch (e) {
        return Response.json({ error: e.message });
    }
});