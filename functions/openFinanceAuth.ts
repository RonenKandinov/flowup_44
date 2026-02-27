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
    const { action, psuId, providerId } = body; 
    const userId = psuId;

    // --- INIT CONNECTION ---
    if (action === 'init_connection') {
        if (!providerId) {
            return Response.json({ error: "providerId is required" }, { status: 400 });
        }
        
        const origin = req.headers.get("origin");
        const connectUrl = `${origin}/?callback=true&code=direct_auth_simulation&provider=${providerId}`;
        
        return Response.json({ 
            success: true, 
            connectUrl,
            providerId
        });
    }

    // --- FINALIZE CONNECTION ---
    if (action === 'finalize_connection') {
        if (!userId) {
            return Response.json({ error: "userId (psuId) is required" }, { status: 400 });
        }
        
        if (!providerId) {
            return Response.json({ error: "providerId is required" }, { status: 400 });
        }

        // 🔑 Get Token
        const tokenRes = await fetch(`${API_ROOT}/oauth/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId,
                clientId: API_KEY,
                clientSecret: API_SECRET
            })
        });

        const tokenJson = await tokenRes.json();

        if (!tokenRes.ok || !tokenJson?.accessToken) {
            return Response.json(
                { error: "Failed to get access token", details: tokenJson },
                { status: 500 }
            );
        }

        const accessToken = tokenJson.accessToken;
        const connectionId = `conn_${providerId}_${userId}_${Date.now()}`;

        // 💾 Save Token & Connection
        
        // 1. Save Token
        await base44.entities.OpenFinanceToken.create({
            user_id: userId,
            access_token: accessToken,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });

        // 2. Save/Update Connection per provider
        const existing = await base44.entities.OpenFinanceConnection.filter({ 
            psu_id: userId,
            provider_id: providerId
        });
        
        if (existing.length > 0) {
            await base44.entities.OpenFinanceConnection.update(existing[0].id, {
                status: 'ACTIVE',
                last_synced_at: new Date().toISOString(),
                connection_id: connectionId
            });
        } else {
             await base44.entities.OpenFinanceConnection.create({
                connection_id: connectionId,
                psu_id: userId,
                provider_id: providerId,
                status: 'ACTIVE',
                last_synced_at: new Date().toISOString(),
                metadata: { 
                    type: 'banking', 
                    provider: providerId,
                    connected_at: new Date().toISOString()
                }
            });
        }

        return Response.json({ 
            success: true, 
            connectionId,
            providerId
        });
    }

    return Response.json({ error: "Invalid Action" }, { status: 400 });

  } catch (err) {
    return Response.json(
      { error: "Unexpected server error", details: err.message },
      { status: 500 }
    );
  }
});