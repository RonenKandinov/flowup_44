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
    const { action, psuId } = body; 
    const userId = psuId; // Mapping for consistency with base snippet

    // --- INIT CONNECTION ---
    if (action === 'init_connection') {
        // Using the direct auth capability shown in the base snippet (userId + creds = token)
        // We simulate the auth flow by redirecting back immediately
        const origin = req.headers.get("origin");
        // We return a URL that the frontend will redirect to, closing the loop
        const connectUrl = `${origin}/?callback=true&code=direct_auth_simulation`;
        
        return Response.json({ 
            success: true, 
            connectUrl 
        });
    }

    // --- FINALIZE CONNECTION ---
    if (action === 'finalize_connection') {
        if (!userId) {
            return Response.json({ error: "userId (psuId) is required" }, { status: 400 });
        }

        // 🔑 Get Token (Using the exact logic from the provided base)
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
        const connectionId = `conn_${userId}_${Date.now()}`;

        // 💾 Save Token & Connection (Base44 Logic)
        
        // 1. Save Token
        await base44.entities.OpenFinanceToken.create({
            user_id: userId,
            access_token: accessToken,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });

        // 2. Save/Update Connection
        const existing = await base44.entities.OpenFinanceConnection.filter({ psu_id: userId });
        
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
                provider_id: 'mizrahi',
                status: 'ACTIVE',
                last_synced_at: new Date().toISOString(),
                metadata: { type: 'checking', bank: 'mizrahi' }
            });
        }

        return Response.json({ 
            success: true, 
            connectionId 
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