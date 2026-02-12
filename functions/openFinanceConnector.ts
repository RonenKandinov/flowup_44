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
    CLIENT_ID: Deno.env.get("OPEN_FINANCE_API_KEY"),
    CLIENT_SECRET: Deno.env.get("OPEN_FINANCE_API_SECRET")
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
        if (response.status === 429) throw new Error("OAuth: Rate Limit Exceeded. Please try again later.");
        if (response.status >= 500) throw new Error(`OAuth: Provider Error (${response.status}).`);
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
        if (response.status === 429) throw new Error("Init Connection: Rate Limit Exceeded.");
        if (response.status >= 500) throw new Error(`Init Connection: Provider Error (${response.status}).`);
        throw new Error(`Init Connection Failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return {
        connectUrl: data.connectUrl,
        connectionId: connectionId
    };
}



// 3) Sync Transactions (Raw Data)
async function syncTransactions(userId, connectionId, base44) {
    const token = await getAccessToken(userId);
    
    // Fetch Transactions
    const response = await fetch(`${ENV.BASE_URL}/data/transactions?connectionId=${connectionId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        if (response.status === 429) throw new Error("Fetch Transactions: Rate Limit Exceeded.");
        throw new Error(`Fetch Transactions Failed: ${response.status}`);
    }

    const { transactions } = await response.json();
    
    if (transactions && transactions.length > 0) {
        const rawTransactions = transactions.map(tx => ({
            transaction_id: tx.id,
            account_id: tx.accountId,
            connection_id: connectionId,
            amount: tx.amount,
            currency: tx.currency,
            date: new Date(tx.bookingDate || tx.date).toISOString(),
            description: tx.description || tx.remittanceInformation || 'Transaction',
            category: tx.category || 'general',
            status: tx.status || 'booked'
        }));

        try {
            await base44.entities.OpenFinanceTransaction.bulkCreate(rawTransactions);
            console.log(`Saved ${rawTransactions.length} raw transactions.`);
        } catch (dbError) {
            console.error("DB Bulk Create Error:", dbError);
            throw new Error("Failed to save transactions to database.");
        }
    }

    return { count: transactions?.length || 0 };
}

// --- Main Server Handler ---
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        let user = await base44.auth.me();
        if (!user) {
            console.log("No authenticated user, using demo user.");
            user = { id: 'demo_user' };
        }

        const body = await req.json().catch(() => ({}));
        
        // Action Dispatcher
        if (body.action === 'sync_transactions') {
             if (!body.connectionId) return Response.json({ error: "Missing connectionId" }, { status: 400 });
             const result = await syncTransactions(user.id, body.connectionId, base44);
             return Response.json(result);
        }

        // Default: Initiate Connection
        if (!body.psuId) {
            return Response.json({ error: "Missing psuId or action" }, { status: 400 });
        }
        
        const result = await initiateConnection(user.id, body.psuId);
        return Response.json(result);

    } catch (error) {
        console.error("OpenFinance Connector Error:", error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});