import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await req.json();

        if (payload.action === 'save') {
            const stringified = JSON.stringify(payload.data);
            
            const existing = await base44.entities.SecureVault.filter({ user_id: user.id });
            if (existing && existing.length > 0) {
                await base44.entities.SecureVault.update(existing[0].id, { encrypted_data: stringified });
            } else {
                await base44.entities.SecureVault.create({ user_id: user.id, encrypted_data: stringified });
            }
            return Response.json({ success: true });
        } else if (payload.action === 'load') {
            const existing = await base44.entities.SecureVault.filter({ user_id: user.id });
            if (existing && existing.length > 0) {
                return Response.json({ success: true, data: JSON.parse(existing[0].encrypted_data) });
            }
            return Response.json({ success: true, data: null });
        } else if (payload.action === 'clear') {
            const existing = await base44.entities.SecureVault.filter({ user_id: user.id });
            if (existing && existing.length > 0) {
                await base44.entities.SecureVault.delete(existing[0].id);
            }
            return Response.json({ success: true });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});