import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me().catch(() => null);
        
        if (req.method !== 'POST') {
            return Response.json({ error: 'Method not allowed' }, { status: 405 });
        }

        const body = await req.json();
        const { action, details, status = 'SUCCESS' } = body;

        if (!action) {
            return Response.json({ error: 'Action is required' }, { status: 400 });
        }

        await base44.asServiceRole.entities.AuditLog.create({
            action,
            user_id: user ? user.email : 'system',
            details: details || {},
            status
        });

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});