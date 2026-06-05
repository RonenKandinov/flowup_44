import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const API_ROOT = "https://api.open-finance.ai";
    const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
    const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

    if (!API_KEY || !API_SECRET) {
      return Response.json(
        { error: "Missing Open Finance credentials" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { action, psuId, providerId, connectionId: bodyConnectionId, redirectUrl: bodyRedirectUrl } = body;
    const userId = psuId;

    // Helper: get a fresh access token for a given userId
    async function getToken(uid) {
      const res = await fetch(`${API_ROOT}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, clientId: API_KEY, clientSecret: API_SECRET })
      });
      const json = await res.json();
      if (!res.ok || !json?.accessToken) {
        throw new Error(`Failed to get access token: ${JSON.stringify(json)}`);
      }
      return json.accessToken;
    }

    // --- INIT CONNECTION (Real Open Finance) ---
    if (action === 'init_connection') {
      if (!userId) {
        return Response.json({ error: "psuId (userId) is required" }, { status: 400 });
      }

      // 1. Get Access Token
      const accessToken = await getToken(userId);

      // 2. Create real connection — 6 months history, redirect back to app after consent
      // Prefer the redirectUrl sent by the frontend (window.location.origin) so it always points
      // back to the correct app URL regardless of what headers base44 forwards.
      const redirectUrl = bodyRedirectUrl;
      const sixMonthsAgo = new Date(Date.now() - 183 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];

      const connBody = {
        startDate: sixMonthsAgo,
        redirectUrl,
        language: "he",
        includeFakeProviders:true,
        refreshData: true,
      };
      if (providerId) connBody.providerIds = [providerId];

      const connRes = await fetch(`${API_ROOT}/v2/connections`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify(connBody)
      });
      const connJson = await connRes.json();

      if (!connRes.ok || !connJson?.id) {
        return Response.json(
          { error: "Failed to create connection", details: connJson },
          { status: 500 }
        );
      }

      const connectionId = connJson.id;
      const connectUrl = connJson.connectUrl;

      // 3. Persist token + connection in base44 (non-fatal if this fails)
      try {
        await base44.asServiceRole.entities.OpenFinanceToken.create({
          user_id: userId,
          access_token: accessToken,
          expires_at: new Date(Date.now() + 3600000).toISOString()
        });
      } catch (e) {
        console.error("Failed to save token:", e);
      }

      try {
        const existing = await base44.asServiceRole.entities.OpenFinanceConnection.filter({
          psu_id: userId,
          provider_id: providerId || 'auto'
        });
        if (existing.length > 0) {
          await base44.asServiceRole.entities.OpenFinanceConnection.update(existing[0].id, {
            status: 'INACTIVE',
            connection_id: connectionId,
            last_synced_at: new Date().toISOString()
          });
        } else {
          await base44.asServiceRole.entities.OpenFinanceConnection.create({
            connection_id: connectionId,
            psu_id: userId,
            provider_id: providerId || 'auto',
            status: 'INACTIVE',
            last_synced_at: new Date().toISOString(),
            metadata: { connected_at: new Date().toISOString() }
          });
        }
      } catch (e) {
        console.error("Failed to save connection:", e);
      }

      return Response.json({ success: true, connectUrl, connectionId, providerId });
    }

    // --- CHECK STATUS ---
    if (action === 'check_status') {
      const connectionId = bodyConnectionId;
      if (!connectionId || !userId) {
        return Response.json({ error: "connectionId and psuId are required" }, { status: 400 });
      }

      const accessToken = await getToken(userId);

      const statusRes = await fetch(`${API_ROOT}/v2/connections/${connectionId}`, {
        headers: { "Authorization": `Bearer ${accessToken}` }
      });

      if (!statusRes.ok) {
        return Response.json(
          { error: "Failed to check connection status", httpStatus: statusRes.status },
          { status: 500 }
        );
      }

      const statusJson = await statusRes.json();
      const connectionStatus = statusJson.status || 'UNKNOWN';

      // Update status in base44 (best-effort)
      try {
        const existing = await base44.asServiceRole.entities.OpenFinanceConnection.filter({
          connection_id: connectionId
        });
        if (existing.length > 0) {
          await base44.asServiceRole.entities.OpenFinanceConnection.update(existing[0].id, {
            status: connectionStatus,
            last_synced_at: new Date().toISOString()
          });
        }
      } catch (e) {
        console.error("Failed to update connection status:", e);
      }

      if (["ACTIVE", "COMPLETED", "CONNECTED"].includes(connectionStatus)) {
        try {
          const accessToken = await getToken(userId);

          const accountsRes = await fetch(`${API_ROOT}/v2/data/accounts`, {
            headers: { "Authorization": `Bearer ${accessToken}`, "Accept": "application/json" }
          });
          const accountsJson = accountsRes.ok ? await accountsRes.json() : {};
          const accounts = accountsJson?.data || accountsJson?.items || accountsJson?.accounts || [];

          const txRes = await fetch(`${API_ROOT}/v2/data/transactions`, {
            headers: { "Authorization": `Bearer ${accessToken}`, "Accept": "application/json" }
          });
          const txJson = txRes.ok ? await txRes.json() : {};
          const transactions = txJson?.data || txJson?.items || txJson?.transactions || [];

          const loanLogicRes = await base44.functions.invoke('loanLogicV2', { userId });
          const loanLogicData = loanLogicRes?.data;

          if (loanLogicData?.success) {
            const metrics = loanLogicData.metrics || {};
            const snapshotPayload = {
              current_balance: metrics.liquidAssets || 0,
              projected_eom_balance: metrics.netCashFlow || 0,
              total_income: metrics.totalIncome || 0,
              total_expenses: metrics.totalExpenses || 0,
              risk_level: String(loanLogicData.status || 'GREEN').toLowerCase(),
              risk_day: null,
              avg_daily_spending: Math.round((metrics.totalExpenses || 0) / 30),
              upload_date: new Date().toISOString()
            };

            const existingSnapshots = await base44.asServiceRole.entities.FinancialSnapshot.list('-created_date', 50);
            for (const snapshot of existingSnapshots) {
              await base44.asServiceRole.entities.FinancialSnapshot.delete(snapshot.id);
            }
            await base44.asServiceRole.entities.FinancialSnapshot.create(snapshotPayload);
          }

          const existingAccounts = await base44.asServiceRole.entities.OpenFinanceAccount.list('-created_date', 500);
          for (const account of existingAccounts) {
            await base44.asServiceRole.entities.OpenFinanceAccount.delete(account.id);
          }

          if (accounts.length > 0) {
            await base44.asServiceRole.entities.OpenFinanceAccount.bulkCreate(accounts.map((account) => ({
              account_id: String(account.id || account.accountId || account.accountNumber || crypto.randomUUID()),
              connection_id: connectionId,
              currency: account.currency || account?.balance?.currency || 'ILS',
              balance: Number(account.availableBalance || account.currentBalance || account?.balance?.amount || account?.balance || 0),
              balance_type: 'interimAvailable',
              name: account.name || account.accountName || 'חשבון בנק',
              type: account.type || account.accountType || 'CHECKING'
            })));
          }

          const existingTransactions = await base44.asServiceRole.entities.OpenFinanceTransaction.list('-created_date', 1000);
          for (const tx of existingTransactions) {
            await base44.asServiceRole.entities.OpenFinanceTransaction.delete(tx.id);
          }

          if (transactions.length > 0) {
            await base44.asServiceRole.entities.OpenFinanceTransaction.bulkCreate(transactions.slice(0, 1000).map((tx, index) => {
              const txDateObj = tx?.date;
              const dateStr = tx?.creationDate || (typeof txDateObj === 'string' ? txDateObj : (txDateObj?.valueDate || txDateObj?.bookingDate || txDateObj?.transactionDate)) || tx?.transactionDate || new Date().toISOString();
              let amount = 0;
              if (tx.amount !== undefined) {
                amount = typeof tx.amount === 'object' ? Number(tx.amount.amount || tx.amount.chargedAmount?.amount || 0) : Number(tx.amount);
                const ind = String(tx.creditDebitIndicator || tx.indicator || '').toUpperCase();
                if (ind === 'DBIT' || ind === 'DEBIT') amount = -Math.abs(amount);
                if (ind === 'CRDT' || ind === 'CREDIT') amount = Math.abs(amount);
              } else if (tx.credit !== undefined || tx.debit !== undefined) {
                amount = (Number(tx.credit) || 0) - (Number(tx.debit) || 0);
              }

              return {
                transaction_id: String(tx.id || tx.transactionId || `${connectionId}-${index}`),
                account_id: String(tx.accountId || tx.account_id || tx.accountNumber || 'unknown-account'),
                connection_id: connectionId,
                amount,
                currency: tx.currency || tx?.amount?.currency || 'ILS',
                date: new Date(dateStr).toISOString(),
                description: tx.description || tx.details || '',
                category: String(tx?.category?.main || tx?.categoryName || tx?.category || 'general'),
                status: 'booked'
              };
            }));
          }
        } catch (e) {
          console.error("Failed to sync Open Finance data:", e);
        }
      }

      return Response.json({ success: true, status: connectionStatus, connectionId });
    }

    // --- REVOKE CONNECTION (local cleanup + best-effort provider revoke) ---
    if (action === 'revoke') {
      const connectionId = bodyConnectionId;
      const psuId = userId;

      if (!connectionId && !psuId) {
        return Response.json({ error: "connectionId or psuId is required" }, { status: 400 });
      }

      const connections = connectionId
        ? await base44.asServiceRole.entities.OpenFinanceConnection.filter({ connection_id: connectionId })
        : await base44.asServiceRole.entities.OpenFinanceConnection.filter({ psu_id: psuId });

      const connectionIds = Array.from(new Set([
        ...(connectionId ? [connectionId] : []),
        ...connections.map((conn) => conn.connection_id).filter(Boolean)
      ]));

      // Best-effort revoke at Open Finance provider level. Local cleanup continues even if the provider has no DELETE endpoint.
      if (connectionIds.length > 0 && psuId) {
        try {
          const accessToken = await getToken(psuId);
          for (const id of connectionIds) {
            await fetch(`${API_ROOT}/v2/connections/${id}`, {
              method: "DELETE",
              headers: { "Authorization": `Bearer ${accessToken}` }
            }).catch(() => null);
          }
        } catch (e) {
          console.warn("Provider revoke skipped/failed:", e?.message || e);
        }
      }

      let deleted = { connections: 0, accounts: 0, transactions: 0, snapshots: 0, tokens: 0 };

      for (const id of connectionIds) {
        const accounts = await base44.asServiceRole.entities.OpenFinanceAccount.filter({ connection_id: id });
        for (const account of accounts) {
          await base44.asServiceRole.entities.OpenFinanceAccount.delete(account.id);
          deleted.accounts += 1;
        }

        const transactions = await base44.asServiceRole.entities.OpenFinanceTransaction.filter({ connection_id: id });
        for (const tx of transactions) {
          await base44.asServiceRole.entities.OpenFinanceTransaction.delete(tx.id);
          deleted.transactions += 1;
        }
      }

      for (const conn of connections) {
        await base44.asServiceRole.entities.OpenFinanceConnection.delete(conn.id);
        deleted.connections += 1;
      }

      if (psuId) {
        const userSnapshots = await base44.asServiceRole.entities.FinancialSnapshot.filter({ user_id: psuId });
        const snapshots = userSnapshots.length > 0
          ? userSnapshots
          : await base44.asServiceRole.entities.FinancialSnapshot.list('-created_date', 100);
        for (const snapshot of snapshots) {
          await base44.asServiceRole.entities.FinancialSnapshot.delete(snapshot.id);
          deleted.snapshots += 1;
        }

        const tokens = await base44.asServiceRole.entities.OpenFinanceToken.filter({ user_id: psuId });
        for (const token of tokens) {
          await base44.asServiceRole.entities.OpenFinanceToken.delete(token.id);
          deleted.tokens += 1;
        }
      }

      return Response.json({ success: true, revoked: true, connectionIds, deleted });
    }

    // --- FINALIZE CONNECTION (legacy / status update) ---
    if (action === 'finalize_connection') {
      const connectionId = bodyConnectionId;
      if (!connectionId || !userId) {
        // Legacy callers that don't pass connectionId: just return success
        return Response.json({ success: true });
      }
      try {
        const existing = await base44.asServiceRole.entities.OpenFinanceConnection.filter({
          connection_id: connectionId
        });
        if (existing.length > 0) {
          await base44.asServiceRole.entities.OpenFinanceConnection.update(existing[0].id, {
            status: 'ACTIVE',
            last_synced_at: new Date().toISOString()
          });
        }
      } catch (e) {
        console.error("Failed to update connection:", e);
      }
      return Response.json({ success: true, connectionId });
    }

    return Response.json({ error: "Invalid Action" }, { status: 400 });

  } catch (err) {
    return Response.json(
      { error: "Unexpected server error", details: err.message },
      { status: 500 }
    );
  }
});