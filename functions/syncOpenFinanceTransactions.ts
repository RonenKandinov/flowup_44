import { createClientFromRequest } from 'npm:@base44/sdk@0.8.11';

Deno.serve(async (req) => {
    try {
        // 1. Properly initialize Base44 SDK from request
        const base44 = createClientFromRequest(req);

        // 2. Authenticate user
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 3. Get request payload
        const { userId, connectionId } = await req.json();
        const targetUserId = userId || user.email;

        // 4. Fetch Open Finance credentials
        const API_ROOT = "https://api.open-finance.ai";
        const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
        const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

        if (!API_KEY || !API_SECRET) {
            return Response.json(
                { error: "Missing Open Finance API credentials" },
                { status: 500 }
            );
        }

        // 5. Get access token from stored connection
        const tokenRecords = await base44.asServiceRole.entities.OpenFinanceToken.filter({ 
            user_id: targetUserId 
        });

        if (tokenRecords.length === 0) {
            return Response.json(
                { error: "No access token found. Please connect your account first." },
                { status: 404 }
            );
        }

        const accessToken = tokenRecords[0].access_token;

        // 6. Fetch accounts
        const accountsRes = await fetch(`${API_ROOT}/accounts`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            }
        });

        if (!accountsRes.ok) {
            const error = await accountsRes.json();
            return Response.json(
                { error: "Failed to fetch accounts", details: error },
                { status: accountsRes.status }
            );
        }

        const accountsData = await accountsRes.json();
        const accounts = accountsData.accounts || [];

        let totalTransactionsSaved = 0;

        // 7. For each account, fetch and save transactions
        for (const account of accounts) {
            const accountId = account.id;

            // Save or update account
            const existingAccounts = await base44.asServiceRole.entities.OpenFinanceAccount.filter({ 
                account_id: accountId 
            });

            if (existingAccounts.length === 0) {
                await base44.asServiceRole.entities.OpenFinanceAccount.create({
                    account_id: accountId,
                    connection_id: connectionId || `conn_${targetUserId}`,
                    currency: account.currency || "ILS",
                    balance: account.balance || 0,
                    balance_type: account.balanceType || "closingBooked",
                    name: account.name || "Main Account",
                    type: account.type || "CHECKING"
                });
            }

            // Fetch transactions for this account
            const transactionsRes = await fetch(
                `${API_ROOT}/accounts/${accountId}/transactions`,
                {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "Content-Type": "application/json"
                    }
                }
            );

            if (!transactionsRes.ok) {
                console.error(`Failed to fetch transactions for account ${accountId}`);
                continue;
            }

            const transactionsData = await transactionsRes.json();
            const transactions = transactionsData.transactions || [];

            // 8. Save each transaction to OpenFinanceTransaction entity
            for (const txn of transactions) {
                const existingTxns = await base44.asServiceRole.entities.OpenFinanceTransaction.filter({ 
                    transaction_id: txn.id 
                });

                if (existingTxns.length === 0) {
                    await base44.asServiceRole.entities.OpenFinanceTransaction.create({
                        transaction_id: txn.id,
                        account_id: accountId,
                        connection_id: connectionId || `conn_${targetUserId}`,
                        amount: txn.amount || 0,
                        currency: txn.currency || "ILS",
                        date: txn.date || new Date().toISOString(),
                        description: txn.description || "",
                        category: txn.category || "uncategorized",
                        status: txn.status || "booked"
                    });
                    totalTransactionsSaved++;
                }
            }
        }

        // 9. Update connection sync timestamp
        if (connectionId) {
            const connections = await base44.asServiceRole.entities.OpenFinanceConnection.filter({ 
                connection_id: connectionId 
            });
            
            if (connections.length > 0) {
                await base44.asServiceRole.entities.OpenFinanceConnection.update(
                    connections[0].id,
                    { last_synced_at: new Date().toISOString() }
                );
            }
        }

        return Response.json({
            success: true,
            accountsProcessed: accounts.length,
            transactionsSaved: totalTransactionsSaved,
            message: "Transactions synced successfully"
        });

    } catch (error) {
        console.error("Sync error:", error);
        return Response.json(
            { error: "Failed to sync transactions", details: error.message },
            { status: 500 }
        );
    }
});