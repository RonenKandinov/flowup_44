import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

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
        includeFakeProviders: false,
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
        await base44.entities.OpenFinanceToken.create({
          user_id: userId,
          access_token: accessToken,
          expires_at: new Date(Date.now() + 3600000).toISOString()
        });
      } catch (e) {
        console.error("Failed to save token:", e);
      }

      try {
        const existing = await base44.entities.OpenFinanceConnection.filter({
          psu_id: userId,
          provider_id: providerId || 'auto'
        });
        if (existing.length > 0) {
          await base44.entities.OpenFinanceConnection.update(existing[0].id, {
            status: 'INACTIVE',
            connection_id: connectionId,
            last_synced_at: new Date().toISOString()
          });
        } else {
          await base44.entities.OpenFinanceConnection.create({
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
        const existing = await base44.entities.OpenFinanceConnection.filter({
          connection_id: connectionId
        });
        if (existing.length > 0) {
          await base44.entities.OpenFinanceConnection.update(existing[0].id, {
            status: connectionStatus,
            last_synced_at: new Date().toISOString()
          });
        }
      } catch (e) {
        console.error("Failed to update connection status:", e);
      }

      return Response.json({ success: true, status: connectionStatus, connectionId });
    }

    // --- FINALIZE CONNECTION (legacy / status update) ---
    if (action === 'finalize_connection') {
      const connectionId = bodyConnectionId;
      if (!connectionId || !userId) {
        // Legacy callers that don't pass connectionId: just return success
        return Response.json({ success: true });
      }
      try {
        const existing = await base44.entities.OpenFinanceConnection.filter({
          connection_id: connectionId
        });
        if (existing.length > 0) {
          await base44.entities.OpenFinanceConnection.update(existing[0].id, {
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