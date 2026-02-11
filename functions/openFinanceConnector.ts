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
        const base44 = createClientFromRequest(req);
        
        // 0. Auth Check
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(req.url);
        const path = url.pathname; // e.g. /api/open-finance/init

        // ROUTER
        
        // Handle root POST (SDK invoke) or /init
        if (req.method === 'POST' && (path.endsWith('/init') || path === '/' || path === '')) {
            const body = await req.json().catch(() => ({}));
            // If called via invoke, body is the payload.
            if (!body.psuId) throw new Error("Missing psuId in body");
            
            const result = await initiateConnection(user.id, body.psuId);
            return Response.json(result);
        }

        // GET /api/open-finance/finalize
        if (req.method === 'GET' && path.endsWith('/finalize')) {
            // Note: In real flow, 'state' comes from query param
            // Assuming frontend passes it or we extract it
            // The prompt says: finalizeConnection(connectionId)
            // We'll extract connectionId from query param 'connectionId' or 'state'
            const connectionId = url.searchParams.get('connectionId') || url.searchParams.get('state');
            if (!connectionId) throw new Error("Missing connectionId query param");
            
            const result = await finalizeConnection(user.id, connectionId);
            return Response.json(result);
        }

        // GET /api/open-finance/accounts
        if (req.method === 'GET' && path.endsWith('/accounts')) {
            const connectionId = url.searchParams.get('connectionId');
            if (!connectionId) throw new Error("Missing connectionId query param");

            const result = await fetchAccounts(user.id, connectionId);
            return Response.json(result);
        }

        // GET /api/open-finance/transactions
        if (req.method === 'GET' && path.endsWith('/transactions')) {
            const connectionId = url.searchParams.get('connectionId');
            if (!connectionId) throw new Error("Missing connectionId query param");

            const result = await fetchTransactions(user.id, connectionId);
            return Response.json(result);
        }

        return Response.json({ error: "Route not found" }, { status: 404 });

    } catch (error) {
        console.error("OpenFinance Connector Error:", error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});