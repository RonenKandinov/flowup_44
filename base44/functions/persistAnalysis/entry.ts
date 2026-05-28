// persistAnalysis — Underwriting Analysis Persistence Service
// ================================================================
// Persists a complete underwriting analysis (insights + rescue strategies +
// credit justifications) to the UnderwritingAnalysis entity. Implements the
// CTO-approved hybrid privacy model: structured intelligence is stored
// plaintext (for analytics, dashboards, ML), narrative intelligence is
// AES-GCM encrypted with SECURE_VAULT_SECRET.
//
// Actions:
//   - save:    create or update an analysis record (auto-dedupe by analysis_hash)
//   - load:    fetch an analysis by id (decrypts narrative on the fly)
//   - list:    list analyses for the current user (paginated, no decryption)
//   - update_state: transition lifecycle state (draft → generated → reviewed → approved → archived)
//
// Reuses the AES-GCM helpers from systemUtils via inlined copy — backend
// functions cannot import from each other in this runtime.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MODEL_VERSION = 'v1.0.0';

// -----------------------------------------------------------------------------
// AES-GCM helpers (inlined from systemUtils — no cross-function imports allowed)
// -----------------------------------------------------------------------------
async function getEncryptionKey() {
    const secret = Deno.env.get('SECURE_VAULT_SECRET');
    if (!secret) throw new Error('Secure Vault encryption key missing');
    const encoder = new TextEncoder();
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
    return await crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

async function encryptJson(data) {
    const key = await getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const arr = new Uint8Array(cipherBuf);
    return JSON.stringify({
        iv: bufferToBase64(iv),
        ciphertext: bufferToBase64(arr.slice(0, -16)),
        authTag: bufferToBase64(arr.slice(-16))
    });
}

async function decryptJson(payloadStr) {
    const payload = JSON.parse(payloadStr);
    const key = await getEncryptionKey();
    const iv = base64ToBuffer(payload.iv);
    const ciphertext = base64ToBuffer(payload.ciphertext);
    const authTag = base64ToBuffer(payload.authTag);
    const combined = new Uint8Array(ciphertext.length + authTag.length);
    combined.set(ciphertext, 0);
    combined.set(authTag, ciphertext.length);
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, combined);
    return JSON.parse(new TextDecoder().decode(plainBuf));
}

// -----------------------------------------------------------------------------
// Stable hash for dedupe — same metrics + same loan request = same hash
// -----------------------------------------------------------------------------
async function computeAnalysisHash(input) {
    const stable = {
        score: Math.round(input.score || 0),
        income: Math.round(input.total_income || 0),
        expenses: Math.round(input.total_expenses || 0),
        liquid: Math.round(input.liquid_assets || 0),
        dti: Math.round(input.dti || 0),
        tier: input.risk_tier || ''
    };
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(stable)));
    return bufferToBase64(buf).slice(0, 24);
}

// -----------------------------------------------------------------------------
// Build the persistence record from raw analysis bundle
// -----------------------------------------------------------------------------
function buildRecord(payload, user, analysisHash, encryptedNarrative) {
    const { insights, loanMetrics, rescueResult, creditJustifications, snapshotId, connectionId, partnerId, userId, userEmail } = payload;
    const effectiveUserId = user?.id || userId || loanMetrics?.userId || 'anonymous';
    const effectiveUserEmail = user?.email || userEmail || '';

    // Slim summary of rescue strategies (no narrative text — that's encrypted separately)
    const strategiesSummary = Array.isArray(rescueResult?.rescueStrategies)
        ? rescueResult.rescueStrategies.map(s => ({
            type: s.type,
            status: s.status,
            loanAmount: s.loanAmount,
            termMonths: s.termMonths,
            monthlyPayment: s.monthlyPayment,
            interestRate: s.interestRate,
            dsr: s.dsr,
            tier: s.tier || null
        }))
        : [];

    return {
        user_id: effectiveUserId,
        user_email: effectiveUserEmail,
        partner_id: partnerId || '',
        snapshot_id: snapshotId || '',
        connection_id: connectionId || '',
        model_version: MODEL_VERSION,
        analysis_hash: analysisHash,
        state: 'generated',
        // Structured intelligence (plaintext)
        score: Number(loanMetrics?.score ?? insights?.score ?? 0),
        risk_tier: insights?.risk_tier || (loanMetrics?.status === 'GREEN' ? 'Green' : loanMetrics?.status === 'RED' ? 'Red' : 'Orange'),
        approval_probability: Number(rescueResult?.after?.approval_probability ?? 0),
        dsr: Number(rescueResult?.after?.dsr ?? loanMetrics?.dsr ?? 0),
        dti: Number(insights?.metrics?.structural_dti ?? loanMetrics?.dti ?? 0),
        adjusted_dti: Number(insights?.metrics?.adjusted_dti ?? 0),
        liquidity_index: Number(insights?.metrics?.liquidity_buffer_months ?? 0),
        income_volatility: Number(insights?.metrics?.income_volatility ?? 0),
        total_income: Number(loanMetrics?.totalIncome ?? 0),
        total_expenses: Number(loanMetrics?.totalExpenses ?? 0),
        fixed_expenses: Number(loanMetrics?.totalFixedExpenses ?? 0),
        liquid_assets: Number(loanMetrics?.liquidAssets ?? 0),
        behavioral_classification: insights?.behavioral_classification || '',
        structured_metrics: insights?.metrics || {},
        rescue_strategies_summary: strategiesSummary,
        xai_factors: rescueResult?.xai_factors || {},
        risk_flags: Array.isArray(insights?.risk_flags) ? insights.risk_flags : [],
        // Narrative intelligence (encrypted)
        narrative_encrypted: encryptedNarrative
    };
}

// -----------------------------------------------------------------------------
// HTTP handler
// -----------------------------------------------------------------------------
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me().catch(() => null);

        const payload = await req.json().catch(() => ({}));
        const { action } = payload;
        const effectiveUserId = user?.id || payload.userId || payload.loanMetrics?.userId || null;
        if (!user && action !== 'save') return Response.json({ error: 'Unauthorized' }, { status: 401 });
        if (action === 'save' && !effectiveUserId) return Response.json({ error: 'Missing userId' }, { status: 400 });

        // -------------------- SAVE (create or upsert by analysis_hash) --------------------
        if (action === 'save') {
            const { insights, loanMetrics } = payload;
            if (!insights && !loanMetrics) {
                return Response.json({ error: 'Missing insights or loanMetrics' }, { status: 400 });
            }

            // Build narrative bundle (everything text-heavy and AI-generated)
            const narrative = {
                executive_summary: insights?.executive_summary || insights?.narrative || '',
                recommended_loan_structure: insights?.recommended_loan_structure || '',
                classification_reason: insights?.classification_reason || '',
                credit_justifications: Array.isArray(payload.creditJustifications) ? payload.creditJustifications : [],
                rescue_strategy_titles: Array.isArray(payload.rescueResult?.rescueStrategies)
                    ? payload.rescueResult.rescueStrategies.map(s => s.title || '')
                    : []
            };

            const hashInput = {
                score: loanMetrics?.score ?? insights?.score ?? 0,
                total_income: loanMetrics?.totalIncome ?? 0,
                total_expenses: loanMetrics?.totalExpenses ?? 0,
                liquid_assets: loanMetrics?.liquidAssets ?? 0,
                dti: insights?.metrics?.structural_dti ?? loanMetrics?.dti ?? 0,
                risk_tier: insights?.risk_tier || ''
            };
            const analysisHash = await computeAnalysisHash(hashInput);

            // Dedupe: if an analysis with the same hash already exists for this user, update it instead
            const analysisEntity = user ? base44.entities.UnderwritingAnalysis : base44.asServiceRole.entities.UnderwritingAnalysis;
            const existing = await analysisEntity.filter({
                user_id: effectiveUserId,
                analysis_hash: analysisHash
            }, '-created_date', 1);

            const encryptedNarrative = await encryptJson(narrative);
            const record = buildRecord(payload, user, analysisHash, encryptedNarrative);

            let saved;
            if (existing && existing.length > 0) {
                saved = await analysisEntity.update(existing[0].id, record);
            } else {
                saved = await analysisEntity.create(record);
            }

            // Audit (non-blocking)
            base44.asServiceRole.entities.AuditLog.create({
                action: 'UNDERWRITING_ANALYSIS_PERSISTED',
                user_id: user?.email || effectiveUserId,
                details: { analysis_id: saved.id, hash: analysisHash, score: record.score, risk_tier: record.risk_tier },
                status: 'SUCCESS'
            }).catch(() => {});

            return Response.json({ success: true, id: saved.id, analysis_hash: analysisHash, deduped: !!(existing && existing.length > 0) });
        }

        // -------------------- LOAD (decrypts narrative) --------------------
        if (action === 'load') {
            const { id } = payload;
            if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

            const all = await base44.entities.UnderwritingAnalysis.filter({ id });
            const record = all?.[0];
            if (!record) return Response.json({ error: 'Not found' }, { status: 404 });
            if (record.user_id !== user.id && user.role !== 'admin') {
                return Response.json({ error: 'Forbidden' }, { status: 403 });
            }

            let narrative = null;
            if (record.narrative_encrypted) {
                try { narrative = await decryptJson(record.narrative_encrypted); }
                catch (e) { console.error('decrypt narrative failed:', e?.message); }
            }

            return Response.json({ success: true, analysis: { ...record, narrative_encrypted: undefined, narrative } });
        }

        // -------------------- LIST (no decryption — list view) --------------------
        if (action === 'list') {
            const { limit = 20 } = payload;
            const records = await base44.entities.UnderwritingAnalysis.filter(
                { user_id: user.id },
                '-created_date',
                Math.min(Number(limit) || 20, 100)
            );
            // Strip the encrypted blob from list responses to keep them light
            const stripped = (records || []).map(r => ({ ...r, narrative_encrypted: undefined }));
            return Response.json({ success: true, analyses: stripped });
        }

        // -------------------- UPDATE_STATE --------------------
        if (action === 'update_state') {
            const { id, state } = payload;
            const ALLOWED = ['draft', 'generated', 'reviewed', 'approved', 'archived'];
            if (!id || !ALLOWED.includes(state)) {
                return Response.json({ error: 'Invalid id or state' }, { status: 400 });
            }
            const all = await base44.entities.UnderwritingAnalysis.filter({ id });
            const record = all?.[0];
            if (!record) return Response.json({ error: 'Not found' }, { status: 404 });
            if (record.user_id !== user.id && user.role !== 'admin') {
                return Response.json({ error: 'Forbidden' }, { status: 403 });
            }

            const patch = { state };
            if (state === 'reviewed' || state === 'approved') {
                patch.reviewed_by = user.email || user.id;
                patch.reviewed_at = new Date().toISOString();
            }
            const updated = await base44.entities.UnderwritingAnalysis.update(id, patch);

            base44.asServiceRole.entities.AuditLog.create({
                action: 'UNDERWRITING_ANALYSIS_STATE_CHANGE',
                user_id: user.email || user.id,
                details: { analysis_id: id, from: record.state, to: state },
                status: 'SUCCESS'
            }).catch(() => {});

            return Response.json({ success: true, analysis: { ...updated, narrative_encrypted: undefined } });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('persistAnalysis error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});