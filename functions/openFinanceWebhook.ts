

const API_ROOT = "https://api.open-finance.ai";
const API_V2 = "https://api.open-finance.ai/v2";


Deno.serve(async (req) => {
  try {
    const adminService = globalThis.base44.asServiceRole;

    const payload = await req.json();
    const { eventType, connectionId, status } = payload;

    console.log(`🔔 Webhook: ${eventType} for ${connectionId}`);

    const [connection] =
      await adminService.entities.OpenFinanceConnection.filter({
        connection_id: connectionId
      });

    if (!connection) {
      console.warn(`⚠️ Connection ${connectionId} not found.`);
      return Response.json({ ignored: true });
    }

    switch (eventType) {

      case "CONNECTION_STATUS_CHANGED":
        await adminService.entities.OpenFinanceConnection.update(
          connection.id,
          {
            status,
            last_synced_at: new Date().toISOString()
          }
        );
        console.log(`✅ Status updated to ${status}`);
        break;

      case "DATA_READY":
        console.log(`📥 DATA_READY received. Starting sync...`);

        // 1️⃣ Get token
        const tokenRes = await fetch(`${API_ROOT}/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: connection.user_id,
            clientId: Deno.env.get("OPEN_FINANCE_API_KEY"),
            clientSecret: Deno.env.get("OPEN_FINANCE_API_SECRET")
          })
        });

        const tokenJson = await tokenRes.json();
        const accessToken = tokenJson.accessToken;

        if (!accessToken) {
          console.error("❌ Failed to get access token");
          break;
        }

        // 2️⃣ Fetch transactions
        const txRes = await fetch(
          `${API_V2}/transactions?connectionId=${connectionId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json"
            }
          }
        );

        const txJson = await txRes.json();
        const transactions =
          txJson.items || txJson.data || [];

        if (!Array.isArray(transactions)) {
          console.error("❌ Invalid transactions format");
          break;
        }

        console.log(`📊 Fetched ${transactions.length} transactions`);

        // 3️⃣ Optional: Clear old transactions (for demo simplicity)
        const existing =
          await adminService.entities.OpenFinanceTransaction.filter({
            connection_id: connectionId
          });

        for (const row of existing) {
          await adminService.entities.OpenFinanceTransaction.delete(row.id);
        }

        // 4️⃣ Save new transactions
        for (const tx of transactions) {
          await adminService.entities.OpenFinanceTransaction.create({
            connection_id: connectionId,
            date: tx.bookingDate || tx.valueDate,
            amount: Number(tx.transactionAmount?.amount || 0),
            description:
              tx.remittanceInformationUnstructured ||
              tx.additionalInformation ||
              "",
            category: tx.creditorName || null
          });
        }

        console.log(`✅ Synced ${transactions.length} transactions`);
        break;

      case "CONSENT_REVOKED":
        await adminService.entities.OpenFinanceConnection.update(
          connection.id,
          { status: "REVOKED" }
        );
        break;

      default:
        console.log(`ℹ️ Unhandled event type: ${eventType}`);
    }

    return Response.json({ received: true });

  } catch (error) {
    console.error("Webhook Error:", error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});