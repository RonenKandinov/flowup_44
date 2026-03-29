import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

export const sanitizeText = (text) => {
    if (!text) return '';
    let sanitized = text;
    sanitized = sanitized.replace(/0\d{1,2}-?\d{7}/g, '[PHONE]');
    sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
    sanitized = sanitized.replace(/\b(?:\d{4}[ -]?){3}\d{4}\b/g, '[CARD]');
    return sanitized;
};

async function getEncryptionKey() {
    const secret = Deno.env.get("SECURE_VAULT_SECRET");
    if (!secret) {
        throw new Error("Secure Vault encryption key missing");
    }
    const encoder = new TextEncoder();
    const keyMaterial = encoder.encode(secret);
    const hash = await crypto.subtle.digest("SHA-256", keyMaterial);
    return await crypto.subtle.importKey(
        "raw",
        hash,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
    );
}

function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

async function encryptData(data) {
    const key = await getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(JSON.stringify(data));

    const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encodedData
    );

    const encryptedArray = new Uint8Array(encryptedBuffer);
    const ciphertext = encryptedArray.slice(0, -16);
    const authTag = encryptedArray.slice(-16);

    return {
        iv: bufferToBase64(iv),
        ciphertext: bufferToBase64(ciphertext),
        authTag: bufferToBase64(authTag)
    };
}

async function decryptData(payload) {
    const key = await getEncryptionKey();
    const iv = base64ToBuffer(payload.iv);
    const ciphertext = base64ToBuffer(payload.ciphertext);
    const authTag = base64ToBuffer(payload.authTag);

    const encryptedArray = new Uint8Array(ciphertext.length + authTag.length);
    encryptedArray.set(ciphertext, 0);
    encryptedArray.set(authTag, ciphertext.length);

    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        encryptedArray
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decryptedBuffer));
}

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me().catch(() => null);
        
        let payload = {};
        if (req.method === 'POST') {
            try { payload = await req.json(); } catch(e) {}
        }
        
        const { service, action } = payload;

        // --- Sanitizer Service ---
        if (service === 'sanitizer') {
            if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
            
            if (action === 'sanitize_text') {
                return Response.json({ success: true, sanitized: sanitizeText(payload.text) });
            } else if (action === 'sanitize_transaction') {
                return Response.json({ 
                    success: true, 
                    transaction: { ...payload.transaction, description: sanitizeText(payload.transaction.description) } 
                });
            } else if (action === 'sanitize_transactions') {
                const sanitizedTxns = payload.transactions.map(tx => ({ 
                    ...tx, 
                    description: sanitizeText(tx.description) 
                }));
                return Response.json({ success: true, transactions: sanitizedTxns });
            }
        }

        // --- Secure Storage Service ---
        if (service === 'storage') {
            if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
            
            if (action === 'save') {
                const encryptedPayload = await encryptData(payload.data);
                const stringified = JSON.stringify(encryptedPayload);
                
                const existing = await base44.entities.SecureVault.filter({ user_id: user.id });
                if (existing && existing.length > 0) {
                    await base44.entities.SecureVault.update(existing[0].id, { encrypted_data: stringified });
                } else {
                    await base44.entities.SecureVault.create({ user_id: user.id, encrypted_data: stringified });
                }
                return Response.json({ success: true });
            } else if (action === 'load') {
                const existing = await base44.entities.SecureVault.filter({ user_id: user.id });
                if (existing && existing.length > 0) {
                    const encryptedPayload = JSON.parse(existing[0].encrypted_data);
                    const decryptedData = await decryptData(encryptedPayload);
                    return Response.json({ success: true, data: decryptedData });
                }
                return Response.json({ success: true, data: null });
            } else if (action === 'clear') {
                const existing = await base44.entities.SecureVault.filter({ user_id: user.id });
                if (existing && existing.length > 0) {
                    await base44.entities.SecureVault.delete(existing[0].id);
                }
                return Response.json({ success: true });
            }
        }

        // --- Audit Log Service ---
        if (service === 'audit') {
            if (!action) return Response.json({ error: 'Action is required' }, { status: 400 });
            
            const { details, status = 'SUCCESS' } = payload;
            await base44.asServiceRole.entities.AuditLog.create({
                action,
                user_id: user ? user.email : 'system',
                details: details || {},
                status
            });
            return Response.json({ success: true });
        }

        return Response.json({ error: 'Invalid service or action' }, { status: 400 });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});