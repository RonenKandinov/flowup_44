import { createClientFromRequest } from 'npm:@base44/sdk@0.8.11';

const ENV = {
    BASE_URL: Deno.env.get("OPEN_FINANCE_BASE_URL") || "https://api.open-finance.ai",
    CLIENT_ID: Deno.env.get("OPEN_FINANCE_API_KEY"),
    CLIENT_SECRET: Deno.env.get("OPEN_FINANCE_API_SECRET")
};

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

async function initiateConnection(userId, psuId) {
    const token = await getAccessToken(userId);

    const connRes = await fetch(`${ENV.BASE_URL}/connections`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            customerId: userId,
            providerIds: ["leumi-sandbox"],
            language: "he",
            psuId,
            connectionMode: "PSD2",
            access: {
                restrictedTo: ["CACC", "CARD"],
                psuIdType: "NATIONAL_ID"
            }
        })
    });

    if (!connRes.ok) {
        const errText = await connRes.text();
        throw new Error(`Create Connection Failed: ${connRes.status} ${errText}`);
    }

    const { id: connectionId } = await connRes.json();

    const response = await fetch(`${ENV.BASE_URL}/connect/open-banking-init`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            providerId: "leumi-sandbox",
            connectionId,
            psuId,
            psuIdType: "NATIONAL_ID",
            refreshData: true,
            restrictedTo: ["CACC", "CARD"]
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Init Connection Failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return {
        connectUrl: data.connectUrl || data.scaOAuth,
        connectionId
    };
}

async function syncTransactions(userId, connectionId, base44) {
    const token = await getAccessToken(userId);
    
    const response = await fetch(`${ENV.BASE_URL}/data/transactions?connectionId=${connectionId}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
        }
    });

    if (!response.ok) {
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

        await base44.entities.OpenFinanceTransaction.bulkCreate(rawTransactions);
        console.log(`Saved ${rawTransactions.length} raw transactions.`);
    }

    return { count: transactions?.length || 0 };
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        let user = await base44.auth.me();
        if (!user) user = { id: "demo_user" };

        const body = await req.json().catch(() => ({}));

        if (body.action === 'sync_transactions') {
            if (!body.connectionId) return Response.json({ error: "Missing connectionId" }, { status: 400 });
            const result = await syncTransactions(user.id, body.connectionId, base44);
            return Response.json(result);
        }

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