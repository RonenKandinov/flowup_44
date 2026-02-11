import { createClientFromRequest } from 'npm:@base44/sdk@0.8.11';

/**
 * Open Finance Connector (MVP)
 * Direct integration without mocking.
 * 
 * Environment Variables required:
 * - OPEN_FINANCE_BASE_URL
 * - OPEN_FINANCE_CLIENT_ID
 * - OPEN_FINANCE_CLIENT_SECRET
 */

const ENV = {
    BASE_URL: Deno.env.get("OPEN_FINANCE_BASE_URL") || "https://api.open-finance.ai",
    CLIENT_ID: Deno.env.get("OPEN_FINANCE_CLIENT_ID"),
    CLIENT_SECRET: Deno.env.get("OPEN_FINANCE_CLIENT_SECRET")
};

// --- Core Helper Functions ---

async function getAccessToken(userId) {
    if (!ENV.CLIENT_ID || !ENV.CLIENT_SECRET) {
        throw new Error("Missing Open Finance Client Credentials");
    }

    const response = await fetch(`${ENV.BASE_URL}/oauth/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            userId: userId,
            clientId: ENV.CLIENT_ID,
            clientSecret: ENV.CLIENT_SECRET
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OAuth Token Failed (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data.access_token;
}

async function initiateConnection(userId, providerId, psuId) {
    const token = await getAccessToken(userId);
    const connectionId = crypto.randomUUID();

    const response = await fetch(`${ENV.BASE_URL}/connect/open-banking-init`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            providerId,
            connectionId,
            psuId
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Init Connection Failed (${response.status}): ${error}`);
    }

    const data = await response.json();
    return {
        connectUrl: data.connectUrl,
        connectionId: connectionId
    };
}

async function finalizeConnection(userId, connectionId) {
    const token = await getAccessToken(userId);
    
    // Using the 'state' parameter as requested in the prompt
    const response = await fetch(`${ENV.BASE_URL}/connect/open-banking-finalize?state=${connectionId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Finalize Connection Failed (${response.status}): ${error}`);
    }

    return await response.json();
}

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
        const error = await response.text();
        throw new Error(`Fetch Accounts Failed (${response.status}): ${error}`);
    }

    return await response.json();
}

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
        const error = await response.text();
        throw new Error(`Fetch Transactions Failed (${response.status}): ${error}`);
    }

    return await response.json();
}

// --- Main Handler ---

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Authentication
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse Request
        const body = await req.json().catch(() => ({}));
        const { action, providerId, psuId, connectionId } = body;

        // 3. Router logic based on 'action'
        // Maps to the requested logical API routes
        switch (action) {
            case 'init': // POST /api/open-finance/init
                if (!providerId || !psuId) throw new Error("Missing providerId or psuId");
                const initData = await initiateConnection(user.id, providerId, psuId);
                return Response.json(initData);

            case 'finalize': // GET /api/open-finance/finalize
                if (!connectionId) throw new Error("Missing connectionId");
                const finalizeData = await finalizeConnection(user.id, connectionId);
                return Response.json(finalizeData);

            case 'accounts': // GET /api/open-finance/accounts
                if (!connectionId) throw new Error("Missing connectionId");
                const accountsData = await fetchAccounts(user.id, connectionId);
                return Response.json(accountsData);

            case 'transactions': // GET /api/open-finance/transactions
                if (!connectionId) throw new Error("Missing connectionId");
                const transactionsData = await fetchTransactions(user.id, connectionId);
                return Response.json(transactionsData);

            default:
                return Response.json({ error: "Invalid action. Supported: init, finalize, accounts, transactions" }, { status: 400 });
        }

    } catch (error) {
        console.error("OpenFinance Connector Error:", error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});