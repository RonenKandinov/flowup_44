// ============================================================================
// orchestrationEngine — Single Entry Point for ALL B2B Decisioning Flows
// ============================================================================
//
// This is the **Decision Orchestration Layer** described in B2B_MODULES.md §2.
// It is the ONLY function the frontend should call for credit decisions.
//
// Responsibilities:
//   1. Product Matching   — validates the product_type + required context
//   2. Routing            — dispatches to the right specialized analyzer
//   3. Approvals          — interprets analyzer output into a unified envelope
//   4. Fallback Logic     — when primary product fails, tries alternative
//   5. Persistence        — writes UnderwritingAnalysis (when applicable)
//
// Why this exists:
//   Before this layer, frontend tabs (CheckDiscountTab, B2BFinancingTab) called
//   `checkDiscountAnalyze` / `b2bFinancingAnalyze` directly. Each tab had its own
//   error handling, persistence logic, and response parsing — meaning a change
//   in one analyzer required updates across multiple components. This layer
//   normalizes the contract.
//
// Contract: see components/docs/ORCHESTRATION_CONTRACT.md
//
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Supported products & their required context ──────────────────────────────
const PRODUCT_REGISTRY = {
  check_discount: {
    layer: 'decisioning',
    analyzer: 'checkDiscountAnalyze',
    required: ['amount', 'due_date'],
    optional: ['third_party_tax_id', 'third_party_name', 'check_image_url', 'check_number'],
    persistEntity: 'CheckDiscountRequest'
  },
  working_capital: {
    layer: 'decisioning',
    analyzer: 'b2bFinancingAnalyze',
    productType: 'working_capital',
    required: ['requested_amount'],
    optional: ['term_months'],
    persistEntity: 'B2BFinancingRequest',
    fallback: 'factoring'
  },
  factoring: {
    layer: 'decisioning',
    analyzer: 'b2bFinancingAnalyze',
    productType: 'reverse_factoring',
    required: ['requested_amount'],
    optional: ['term_months', 'counterparty_tax_id'],
    persistEntity: 'B2BFinancingRequest'
  },
  reverse_factoring: {
    layer: 'decisioning',
    analyzer: 'b2bFinancingAnalyze',
    productType: 'reverse_factoring',
    required: ['requested_amount'],
    optional: ['term_months', 'counterparty_tax_id'],
    persistEntity: 'B2BFinancingRequest'
  },
  rbf: {
    layer: 'decisioning',
    analyzer: 'b2bFinancingAnalyze',
    productType: 'revenue_based_financing',
    required: ['requested_amount'],
    optional: ['target_mrr'],
    persistEntity: 'B2BFinancingRequest'
  },
  po_financing: {
    layer: 'decisioning',
    analyzer: 'b2bFinancingAnalyze',
    productType: 'purchase_order_financing',
    required: ['requested_amount'],
    optional: ['po_number', 'buyer_name'],
    persistEntity: 'B2BFinancingRequest'
  },
  mca: {
    layer: 'decisioning',
    analyzer: 'b2bFinancingAnalyze',
    productType: 'merchant_cash_advance',
    required: ['requested_amount'],
    optional: ['acquirer_name'],
    persistEntity: 'B2BFinancingRequest'
  }
};

// ─── Status normalization (each analyzer returns slightly different shapes) ──
function normalizeStatus(rawStatus) {
  const s = String(rawStatus || '').toLowerCase();
  if (['approved', 'success'].includes(s)) return 'approved';
  if (['rejected', 'declined', 'decline'].includes(s)) return 'rejected';
  if (['review', 'manual_review'].includes(s)) return 'review';
  if (['adjusted', 'conditional'].includes(s)) return 'adjusted';
  return 'review';
}

// ─── Validate the request envelope ────────────────────────────────────────────
function validateRequest({ product, context }) {
  const spec = PRODUCT_REGISTRY[product];
  if (!spec) {
    return { ok: false, error: `Unsupported product: ${product}. Supported: ${Object.keys(PRODUCT_REGISTRY).join(', ')}` };
  }
  const missing = spec.required.filter(k => context[k] === undefined || context[k] === null || context[k] === '');
  if (missing.length > 0) {
    return { ok: false, error: `Missing required fields for ${product}: ${missing.join(', ')}` };
  }
  return { ok: true, spec };
}

// ─── Build the analyzer payload (each analyzer expects a different shape) ────
function buildAnalyzerPayload(product, spec, context) {
  if (spec.analyzer === 'checkDiscountAnalyze') {
    return {
      amount: Number(context.amount),
      due_date: context.due_date,
      third_party_tax_id: context.third_party_tax_id || '',
      third_party_name: context.third_party_name || ''
    };
  }
  if (spec.analyzer === 'b2bFinancingAnalyze') {
    return {
      product_type: spec.productType,
      requested_amount: Number(context.requested_amount),
      term_months: Number(context.term_months || 12),
      context: {
        counterparty_tax_id: context.counterparty_tax_id,
        po_number: context.po_number,
        buyer_name: context.buyer_name,
        target_mrr: context.target_mrr,
        acquirer_name: context.acquirer_name
      }
    };
  }
  return context;
}

// ─── Normalize analyzer output into a unified decision envelope ──────────────
function normalizeDecision(product, analyzerResponse) {
  const d = analyzerResponse?.decision || {};
  return {
    product,
    status: normalizeStatus(d.status),
    reason: d.reason || '',
    rate: d.rate ?? d.discount_rate ?? null,
    max_amount: d.max_amount ?? null,
    metrics: d.metrics ?? analyzerResponse?.metrics ?? null,
    third_party_history: d.third_party_history ?? null,
    requesting_business: d.requesting_business ?? null,
    product_specific: d.product_specific ?? {}
  };
}

// ─── Persist the request record (idempotent — caller-driven, fire-and-forget) ─
async function persistRequest({ base44, user, product, spec, context, decision }) {
  try {
    if (spec.persistEntity === 'CheckDiscountRequest') {
      return await base44.entities.CheckDiscountRequest.create({
        requesting_business_id: user.id,
        amount: Number(context.amount),
        due_date: context.due_date,
        third_party_tax_id: context.third_party_tax_id || '',
        third_party_name: context.third_party_name || '',
        check_image_url: context.check_image_url || '',
        check_number: context.check_number || '',
        ocr_confidence: Number(context.ocr_confidence || 0),
        status: decision.status,
        decision_reason: decision.reason,
        discount_rate: Number(decision.rate || 0),
        third_party_history: decision.third_party_history || {}
      });
    }
    if (spec.persistEntity === 'B2BFinancingRequest') {
      return await base44.entities.B2BFinancingRequest.create({
        business_id: user.id,
        business_name: user.full_name || '',
        product_type: spec.productType,
        requested_amount: Number(context.requested_amount),
        term_months: Number(context.term_months || 12),
        context: context,
        status: decision.status,
        decision: decision
      });
    }
  } catch (err) {
    console.error('[orchestration] Persist failed (non-blocking):', err?.message);
  }
  return null;
}

// ─── Audit logging (non-blocking) ─────────────────────────────────────────────
async function audit({ base44, user, product, decision, fallbackUsed, durationMs, error }) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'ORCHESTRATION_DECISION',
      user_id: user?.email || user?.id || 'anonymous',
      details: {
        product,
        status: decision?.status || 'error',
        fallback_used: !!fallbackUsed,
        duration_ms: durationMs,
        error: error || null
      },
      status: error ? 'FAILURE' : 'SUCCESS'
    });
  } catch (_) { /* never block on audit */ }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const startedAt = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { product, context = {}, options = {} } = body;

    // ── 1. Product Matching + Validation ──
    const validation = validateRequest({ product, context });
    if (!validation.ok) {
      await audit({ base44, user, product, durationMs: Date.now() - startedAt, error: validation.error });
      return Response.json({ success: false, error: validation.error }, { status: 400 });
    }
    const spec = validation.spec;

    // ── 2. Routing — invoke the specialized analyzer ──
    const analyzerPayload = buildAnalyzerPayload(product, spec, context);
    let analyzerRes;
    try {
      const r = await base44.functions.invoke(spec.analyzer, analyzerPayload);
      analyzerRes = r?.data || r;
    } catch (err) {
      await audit({ base44, user, product, durationMs: Date.now() - startedAt, error: err.message });
      return Response.json({ success: false, error: `Analyzer ${spec.analyzer} failed: ${err.message}` }, { status: 502 });
    }

    if (analyzerRes?.success === false) {
      await audit({ base44, user, product, durationMs: Date.now() - startedAt, error: analyzerRes.error });
      return Response.json({ success: false, error: analyzerRes.error || 'Analyzer returned failure' }, { status: 500 });
    }

    // ── 3. Normalize decision envelope ──
    let decision = normalizeDecision(product, analyzerRes);
    let fallbackUsed = false;
    let fallbackDecision = null;

    // ── 4. Fallback Logic — if primary rejected AND fallback configured AND opt-in ──
    if (decision.status === 'rejected' && spec.fallback && options.enableFallback !== false) {
      const fbProduct = spec.fallback;
      const fbSpec = PRODUCT_REGISTRY[fbProduct];
      if (fbSpec) {
        try {
          const fbPayload = buildAnalyzerPayload(fbProduct, fbSpec, context);
          const fbRaw = await base44.functions.invoke(fbSpec.analyzer, fbPayload);
          const fbRes = fbRaw?.data || fbRaw;
          if (fbRes?.success !== false) {
            fallbackDecision = normalizeDecision(fbProduct, fbRes);
            fallbackUsed = true;
          }
        } catch (err) {
          console.warn('[orchestration] Fallback attempt failed:', err.message);
        }
      }
    }

    // ── 5. Persist (only when decision is conclusive) ──
    let persistedId = null;
    if (options.persist !== false && ['approved', 'review', 'adjusted', 'rejected'].includes(decision.status)) {
      const saved = await persistRequest({ base44, user, product, spec, context, decision });
      persistedId = saved?.id || null;
    }

    const durationMs = Date.now() - startedAt;
    await audit({ base44, user, product, decision, fallbackUsed, durationMs });

    return Response.json({
      success: true,
      decision,
      fallback: fallbackUsed ? { product: spec.fallback, decision: fallbackDecision } : null,
      persisted_id: persistedId,
      meta: {
        orchestrator_version: 'v1.0.0',
        product,
        analyzer: spec.analyzer,
        layer: spec.layer,
        duration_ms: durationMs
      }
    });

  } catch (error) {
    console.error('[orchestrationEngine] unhandled error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});