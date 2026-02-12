import { createClientFromRequest } from 'npm:@base44/sdk@0.8.11';

/**
 * Real Open Finance Sandbox Connector
 * -----------------------------------
 * No mocking. Real API calls only.
 * 
 * Environment Variables:
 * - OPEN_FINANCE_BASE_URL
 * - OPEN_FINANCE_CLIENT_ID
 * - OPEN_FINANCE_CLIENT_SECRET
 */

const ENV = {
    BASE_URL: Deno.env.get("OPEN_FINANCE_BASE_URL") || "https://api.open-finance.ai",
    CLIENT_ID: Deno.env.get("OPEN_FINANCE_CLIENT_ID"),
    CLIENT_SECRET: Deno.env.get("OPEN_FINANCE_CLIENT_SECRET")
};

// 1) Get Access Token (Client Credentials + User Context)
async function getAccessToken(userId) {
    if (!ENV.CLIENT_ID || !ENV.CLIENT_SECRET) {
        throw new Error("Missing Open Finance Client Credentials");
    }

    const response = await fetch(`${ENV.BASE_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: userId,
            clientId: ENV.CLIENT_ID,
            clientSecret: ENV.CLIENT_SECRET
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OAuth Failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.access_token;
}

// 2) Initiate Connection
async function initiateConnection(base44, userId, psuId) {
    const token = await getAccessToken(userId);

    // Step 1 – Create valid connection with Open Finance
    const connectionResponse = await fetch(`${ENV.BASE_URL}/connections`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            customerId: userId,
            providerIds: ["leumi-sandbox"],
            language: "he",
            psuId: psuId,
            connectionMode: "PSD2",
            access: {
                restrictedTo: ["CACC", "CARD"],
                psuIdType: "NATIONAL_ID"
            }
        })
    });

    if (!connectionResponse.ok) {
        const errorText = await connectionResponse.text();
        throw new Error(`Connection Creation Failed: ${connectionResponse.status} ${errorText}`);
    }

    const connectionData = await connectionResponse.json();
    const connectionId = connectionData.id;

    // Step 2 – Start identification flow
    const initResponse = await fetch(`${ENV.BASE_URL}/connect/open-banking-init`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            providerId: "leumi-sandbox",
            connectionId,
            psuId: psuId,
            psuIdType: "NATIONAL_ID",
            refreshData: true,
            restrictedTo: ["CACC", "CARD"]
        })
    });

    if (!initResponse.ok) {
        const errorText = await initResponse.text();
        throw new Error(`Open Banking Init Failed: ${initResponse.status} ${errorText}`);
    }

    // DB Insert (Bonus)
    await base44.entities.OpenFinanceConnection.create({
        connection_id: connectionId,
        user_id: userId,
        provider_id: "leumi-sandbox",
        status: "PENDING"
    });

    const initData = await initResponse.json();
    return {
        connectUrl: initData.connectUrl || initData.scaOAuth,
        connectionId
    };
}



// --- Main Server Handler ---
Deno.serve(async (req) => {
    try {
        if (req.method !== 'POST') {
            return Response.json({ error: 'Method Not Allowed' }, { status: 405 });
        }

        const base44 = createClientFromRequest(req);
        
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        
        if (!body.psuId) {
            return Response.json({ error: "Missing psuId in body" }, { status: 400 });
        }
        
        const result = await initiateConnection(base44, user.id, body.psuId);
        return Response.json(result);

    } catch (error) {
        console.error("OpenFinance Connector Error:", error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});