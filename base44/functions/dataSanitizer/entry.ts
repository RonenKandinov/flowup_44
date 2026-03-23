import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export const sanitizeText = (text) => {
    if (!text) return '';
    let sanitized = text;
    sanitized = sanitized.replace(/0\d{1,2}-?\d{7}/g, '[PHONE]');
    sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
    sanitized = sanitized.replace(/\b(?:\d{4}[ -]?){3}\d{4}\b/g, '[CARD]');
    return sanitized;
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await req.json();

        if (payload.action === 'sanitize_text') {
            return Response.json({ success: true, sanitized: sanitizeText(payload.text) });
        } else if (payload.action === 'sanitize_transaction') {
            return Response.json({ 
                success: true, 
                transaction: { ...payload.transaction, description: sanitizeText(payload.transaction.description) } 
            });
        } else if (payload.action === 'sanitize_transactions') {
            const sanitizedTxns = payload.transactions.map(tx => ({ 
                ...tx, 
                description: sanitizeText(tx.description) 
            }));
            return Response.json({ success: true, transactions: sanitizedTxns });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});