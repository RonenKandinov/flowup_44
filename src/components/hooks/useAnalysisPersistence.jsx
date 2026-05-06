import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * useAnalysisPersistence
 * ----------------------
 * Auto-saves a complete underwriting analysis bundle (insights + loanMetrics +
 * rescue strategies + credit justifications) to the UnderwritingAnalysis
 * entity via the persistAnalysis backend function.
 *
 * Privacy model (CTO direction):
 *   - Structured intelligence (scores, DSR, DTI, tiers, flags) → plaintext
 *   - Narrative intelligence (AI summaries, justifications)     → AES-GCM encrypted
 *
 * Dedupe: server hashes the input metrics; identical re-runs upsert the same row.
 *
 * Triggers a single save when the analysis bundle is "complete":
 *   - insights present
 *   - loanMetrics present
 *   - rescueResult present (optional — saves earlier if no rescue ran yet)
 *   - creditJustifications array (optional)
 *
 * Re-saves only when a stable signature of the bundle changes — so re-renders
 * never trigger duplicate saves.
 */
export function useAnalysisPersistence({
    insights,
    loanMetrics,
    rescueResult,
    creditJustifications,
    snapshotId,
    connectionId,
    partnerId,
    enabled = true
}) {
    const lastSignatureRef = useRef('');
    const inFlightRef = useRef(false);

    useEffect(() => {
        if (!enabled) return;
        if (!insights || insights.error) return;
        if (!loanMetrics) return;

        // Stable signature — only the inputs that meaningfully change the saved record
        const signature = JSON.stringify({
            score: Math.round(loanMetrics.score || 0),
            tier: insights.risk_tier || '',
            inc: Math.round(loanMetrics.totalIncome || 0),
            exp: Math.round(loanMetrics.totalExpenses || 0),
            liq: Math.round(loanMetrics.liquidAssets || 0),
            dti: Math.round(loanMetrics.dti || 0),
            rescue: rescueResult?.rescueStrategies?.length || 0,
            justN: Array.isArray(creditJustifications) ? creditJustifications.length : 0
        });

        if (signature === lastSignatureRef.current) return;
        if (inFlightRef.current) return;

        inFlightRef.current = true;
        lastSignatureRef.current = signature;

        base44.functions.invoke('persistAnalysis', {
            action: 'save',
            insights,
            loanMetrics,
            rescueResult: rescueResult || null,
            creditJustifications: creditJustifications || [],
            snapshotId: snapshotId || null,
            connectionId: connectionId || null,
            partnerId: partnerId || null
        })
        .then(res => {
            if (!res?.data?.success) {
                console.warn('persistAnalysis: non-success response', res?.data);
            }
        })
        .catch(err => {
            // Non-blocking: persistence failure must NOT break the analyst UI.
            // Common cases: 401 on cross-domain B2B-Connect, 500 transient.
            console.warn('persistAnalysis failed (non-blocking):', err?.response?.data || err?.message);
        })
        .finally(() => {
            inFlightRef.current = false;
        });
    }, [enabled, insights, loanMetrics, rescueResult, creditJustifications, snapshotId, connectionId, partnerId]);
}