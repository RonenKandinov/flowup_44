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
async function initiateConnection(userId, psuId) {
    const token = await getAccessToken(userId);
    const connectionId = crypto.randomUUID();

    const response = await fetch(`${ENV.BASE_URL}/connect/open-banking-init`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            providerId: "leumi-sandbox", // Hardcoded as per requirements
            connectionId: connectionId,
            psuId: psuId
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Init Connection Failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return {
        connectUrl: data.connectUrl,
        connectionId: connectionId
    };
}

// 3) Finalize Connection
async function finalizeConnection(userId, connectionId) {
    const token = await getAccessToken(userId);

    const response = await fetch(`${ENV.BASE_URL}/connect/open-banking-finalize?state=${connectionId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Finalize Connection Failed: ${response.status} ${errorText}`);
    }

    return await response.json();
}

// 4) Fetch Accounts
async function fetchAccounts(userId, connectionId) {
    const token = await getAccessToken(userId);

    const response = await fetch(`${ENV.BASE_URL}/data/accounts?connectionId=${connectionId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Fetch Accounts Failed: ${response.status} ${errorText}`);
    }

    return await response.json();
}

// 5) Fetch Transactions
async function fetchTransactions(userId, connectionId) {
    const token = await getAccessToken(userId);

    const response = await fetch(`${ENV.BASE_URL}/data/transactions?connectionId=${connectionId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Fetch Transactions Failed: ${response.status} ${errorText}`);
    }

    return await response.json();
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
        
        const result = await initiateConnection(user.id, body.psuId);
        return Response.json(result);

    } catch (error) {
        console.error("OpenFinance Connector Error:", error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});