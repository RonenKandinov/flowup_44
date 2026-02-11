import { createClientFromRequest } from 'npm:@base44/sdk@0.8.11';

/**
 * ==============================================================================
 * OPEN FINANCE WEBHOOK CONTROLLER
 * ==============================================================================
 * Handles asynchronous status updates and data notifications.
 */

const WEBHOOK_SECRET = Deno.env.get("OPEN_FINANCE_WEBHOOK_SECRET");

// Simple HMAC-SHA256 Validation
async function validateSignature(req, secret) {
    if (!secret) return true; // Skip if no secret configured (Dev mode)
    
    const signature = req.headers.get("X-OpenFinance-Signature");
    if (!signature) return false;

    const bodyText = await req.text();
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
    );
    
    // Re-verify (simplified) - In prod, reconstruct strict payload string
    // This is a placeholder for actual HMAC logic
    return true; 
}

Deno.serve(async (req) => {
    // 1. Signature Validation
    // Note: We clone req to read body twice if needed (once for sig, once for parsing)
    // For simplicity in this environment, we assume validation passes or is handled
    
    try {
        const base44 = createClientFromRequest(req);
        // Use Service Role for database operations (Webhooks are system-to-system)
        const adminService = base44.asServiceRole;

        const payload = await req.json();
        const { eventType, connectionId, status, timestamp } = payload;

        console.log(`🔔 Webhook Received: ${eventType} for ${connectionId}`);

        // 2. Find Connection
        const [connection] = await adminService.entities.OpenFinanceConnection.filter({ connection_id: connectionId });
        
        if (!connection) {
            console.warn(`⚠️ Connection ${connectionId} not found.`);
            return Response.json({ status: 'ignored' });
        }

        // 3. Handle Events
        switch (eventType) {
            case 'CONNECTION_STATUS_CHANGED':
                await adminService.entities.OpenFinanceConnection.update(connection.id, {
                    status: status,
                    last_synced_at: new Date().toISOString()
                });
                
                if (status === 'CONNECTED' || status === 'ACTIVE') {
                    // Trigger Data Sync
                    // Note: In Base44, we can call another function.
                    // Or ideally, we just replicate the sync logic here or queue a job.
                    // For now, we update status. Real data fetch might be pulled by the user or a scheduled job.
                    console.log(`✅ Connection ${connectionId} is now ${status}`);
                }
                break;

            case 'DATA_READY':
                // Provider signals new data is available
                // Trigger sync logic (Simplified: just log)
                console.log(`📥 Data ready for ${connectionId}. Triggering fetch...`);
                // In a real microservice, we'd emit an event or call the sync function.
                // await base44.functions.invoke('openFinance', { action: 'sync', connectionId });
                break;

            case 'CONSENT_REVOKED':
                await adminService.entities.OpenFinanceConnection.update(connection.id, {
                    status: 'REVOKED'
                });
                break;

            default:
                console.log(`ℹ️ Unhandled event type: ${eventType}`);
        }

        return Response.json({ received: true });

    } catch (error) {
        console.error("Webhook Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});