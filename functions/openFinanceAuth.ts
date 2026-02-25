import { createClientFromRequest } from 'npm:@base44/sdk@0.8.11';

// Base URL for the Open Finance Provider
const API_ROOT = "https://api.open-finance.ai";

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { action, providerId, code, psuId, connectionId } = await req.json();
        
        const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
        const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

        if (!API_KEY || !API_SECRET) {
            return Response.json({ error: "Configuration Error: Missing API Credentials" }, { status: 500 });
        }

        // --- 1. INITIALIZE CONNECTION ---
        if (action === 'init_connection') {
            if (!psuId) return Response.json({ error: "Missing psuId" }, { status: 400 });

            // In a real scenario, we creates a consent resource here
            // Mocking the Consent API call to get an Auth URL
            // const consentRes = await fetch(`${API_ROOT}/v1/consents`, { ... })
            
            // For now, we'll construct a direct auth URL for the provider
            // Assuming the provider accepts client_id and redirect_uri
            const redirectUri = `${req.headers.get("origin")}/?callback=true`; // Redirect back to Dashboard
            
            // Constructing a "Simulated" Auth URL for the preview (or real if endpoints matched)
            // Using a structure common in Open Banking (OAuth2)
            const state = btoa(JSON.stringify({ psuId, providerId, nonce: Date.now() }));
            
            // NOTE: Since we are in a sandbox/dev environment for "api.open-finance.ai", 
            // and we want to simulate the user "approving" at the bank.
            // If the provider supports a sandbox URL:
            const authUrl = `${API_ROOT}/sandbox/authorize?client_id=${API_KEY}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&provider=${providerId || 'mizrahi'}&scope=accounts%20transactions`;

            return Response.json({ 
                success: true, 
                connectUrl: authUrl 
            });
        }

        // --- 2. FINALIZE CONNECTION (CALLBACK) ---
        if (action === 'finalize_connection') {
            if (!code) return Response.json({ error: "Missing auth code" }, { status: 400 });

            // Exchange Code for Token
            const tokenRes = await fetch(`${API_ROOT}/oauth/token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    grant_type: "authorization_code",
                    code,
                    client_id: API_KEY,
                    client_secret: API_SECRET,
                    redirect_uri: `${req.headers.get("origin")}/?callback=true`
                })
            });

            const tokenData = await tokenRes.json();
            
            if (!tokenRes.ok) {
                // Fallback for Sandbox Simulation if API fails (so you can test UI flow)
                // Remove this block in PROD
                if (code === 'mock_code') {
                    const mockConnectionId = `conn_${Date.now()}`;
                    await saveConnection(base44, psuId || 'user_unknown', mockConnectionId, 'mock_access_token', 'mizrahi');
                     return Response.json({ 
                        success: true, 
                        connectionId: mockConnectionId,
                        message: "Connected via Sandbox Mock"
                    });
                }
                
                return Response.json({ error: "Token Exchange Failed", details: tokenData }, { status: 400 });
            }

            // Save Connection & Token
            const connectionId = tokenData.connection_id || `conn_${Date.now()}`;
            await saveConnection(base44, psuId, connectionId, tokenData.access_token, providerId || 'mizrahi');

            return Response.json({ 
                success: true, 
                connectionId 
            });
        }

        return Response.json({ error: "Invalid Action" }, { status: 400 });

    } catch (error) {
        console.error("OpenFinance Auth Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function saveConnection(base44, psuId, connectionId, accessToken, providerId) {
    // 1. Store Token (Securely)
    await base44.entities.OpenFinanceToken.create({
        user_id: psuId,
        access_token: accessToken, // In prod, encrypt this!
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    });

    // 2. Store Connection Metadata
    // Check if exists first to avoid duplicates or update status
    const existing = await base44.entities.OpenFinanceConnection.filter({ connection_id: connectionId });
    
    if (existing.length > 0) {
        await base44.entities.OpenFinanceConnection.update(existing[0].id, {
            status: 'ACTIVE',
            last_synced_at: new Date().toISOString()
        });
    } else {
        await base44.entities.OpenFinanceConnection.create({
            connection_id: connectionId,
            psu_id: psuId,
            provider_id: providerId,
            status: 'ACTIVE',
            last_synced_at: new Date().toISOString(),
            metadata: { type: 'checking', bank: providerId }
        });
    }
}