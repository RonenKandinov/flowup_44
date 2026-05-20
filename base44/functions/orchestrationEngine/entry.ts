// ============================================================================
// orchestrationEngine — Single Entry Point for ALL B2B Decisioning Flows
// ============================================================================
//
// This is the **Decision Orchestration Layer** described in B2B_MODULES.md §2.
// It is the ONLY function the frontend should call for credit decisions.
//
// ─── Core principle (CTO directive 2026-05-17) ─────────────────────────────────
// The orchestrator does NOT invent rules. It is a CONDUCTOR that runs the
// real engines in the right order and passes their outputs to each other:
//
//   1. loanLogicV2      → ground truth: financial metrics, score, risk tier
//                          (income/expenses/DTI/liquidity from Open Finance)
//   2. insightEngine    → behavioral analysis, false-negative detection,
//                          policy explanations, narrative
//   3. Product analyzer → product-specific underwriting
//                          (checkDiscountAnalyze | b2bFinancingAnalyze)
//      ↑ receives the loanLogic metrics so it doesn't recompute them
//   4. dealRescuerEngine → Approval Optimization — alternative structures
//                          when primary rejected, or for upsell on approved
//   5. persistAnalysis  → save UnderwritingAnalysis (hybrid encryption)
//   6. AuditLog         → trail
//
// Responsibilities (NOT inventing logic, just orchestrating):
//   • Product Matching   — validates the product_type + required context
//   • Routing            — dispatches to the right specialized analyzer
//   • Enrichment         — passes loanLogic output downstream
//   • Approval Optimization — invokes dealRescuer for non-approved cases
//   • Persistence        — writes UnderwritingAnalysis + product entity
//   • Audit              — every decision logged
//
// Contract: see components/docs/ORCHESTRATION_CONTRACT.md
//
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Supported products & their required context ──────────────────────────────
// All products now route to the SAME unified analyzer (loanApplicationAnalyze).
// loan_type drives the underwriting branch; product_type drives sub-product logic.
const PRODUCT_REGISTRY = {
  check_discount: {
    layer: 'decisioning',
    analyzer: 'loanApplicationAnalyze',
    loanType: 'check_discount',
    required: ['amount', 'due_date'],
    optional: ['third_party_tax_id', 'third_party_name', 'check_image_url', 'check_number'],
    requestedAmountField: 'amount'
  },
  working_capital: {
    layer: 'decisioning',
    analyzer: 'loanApplicationAnalyze',
    loanType: 'b2b_financing',
    productType: 'working_capital',
    required: ['requested_amount'],
    optional: ['term_months'],
    fallback: 'factoring',
    requestedAmountField: 'requested_amount'
  },
  factoring: {
    layer: 'decisioning',
    analyzer: 'loanApplicationAnalyze',
    loanType: 'b2b_financing',
    productType: 'reverse_factoring',
    required: ['requested_amount'],
    optional: ['term_months', 'counterparty_tax_id'],
    requestedAmountField: 'requested_amount'
  },
  reverse_factoring: {
    layer: 'decisioning',
    analyzer: 'loanApplicationAnalyze',
    loanType: 'b2b_financing',
    productType: 'reverse_factoring',
    required: ['requested_amount'],
    optional: ['term_months', 'counterparty_tax_id'],
    requestedAmountField: 'requested_amount'
  },
  rbf: {
    layer: 'decisioning',
    analyzer: 'loanApplicationAnalyze',
    loanType: 'b2b_financing',
    productType: 'revenue_based_financing',
    required: ['requested_amount'],
    optional: ['target_mrr'],
    requestedAmountField: 'requested_amount'
  },
  po_financing: {
    layer: 'decisioning',
    analyzer: 'loanApplicationAnalyze',
    loanType: 'b2b_financing',
    productType: 'purchase_order_financing',
    required: ['requested_amount'],
    optional: ['po_number', 'buyer_name'],
    requestedAmountField: 'requested_amount'
  },
  mca: {
    layer: 'decisioning',
    analyzer: 'loanApplicationAnalyze',
    loanType: 'b2b_financing',
    productType: 'merchant_cash_advance',
    required: ['requested_amount'],
    optional: ['acquirer_name'],
    requestedAmountField: 'requested_amount'
  },
  personal_loan: {
    layer: 'decisioning',
    analyzer: 'loanApplicationAnalyze',
    loanType: 'personal_loan',
    required: ['requested_amount'],
    optional: ['term_months', 'purpose'],
    requestedAmountField: 'requested_amount'
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
// IMPORTANT: we forward the loanLogic metrics so the analyzer does NOT recompute
// them. This is the central rule — one source of truth for financial metrics.
function buildAnalyzerPayload(product, spec, context, loanMetrics) {
  // Unified analyzer (loanApplicationAnalyze) — single payload shape for all products.
  if (spec.loanType === 'check_discount') {
    return {
      loan_type: 'check_discount',
      requested_amount: Number(context.amount),
      details: {
        due_date: context.due_date,
        third_party_tax_id: context.third_party_tax_id || '',
        third_party_name: context.third_party_name || '',
        check_image_url: context.check_image_url || '',
        check_number: context.check_number || '',
        ocr_confidence: Number(context.ocr_confidence || 0)
      },
      loan_metrics: loanMetrics || null
    };
  }
  if (spec.loanType === 'b2b_financing') {
    return {
      loan_type: 'b2b_financing',
      product_type: spec.productType,
      requested_amount: Number(context.requested_amount),
      term_months: Number(context.term_months || 12),
      details: {
        counterparty_tax_id: context.counterparty_tax_id,
        po_number: context.po_number,
        buyer_name: context.buyer_name,
        target_mrr: context.target_mrr,
        acquirer_name: context.acquirer_name
      },
      loan_metrics: loanMetrics || null
    };
  }
  if (spec.loanType === 'personal_loan') {
    return {
      loan_type: 'personal_loan',
      product_type: spec.productType || null,
      requested_amount: Number(context.requested_amount),
      term_months: Number(context.term_months || 36),
      details: {
        purpose: context.purpose || '',
        employment_status: context.employment_status || ''
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

// ─── Step 1: Get ground-truth financial metrics from loanLogicV2 ──────────────
async function runLoanLogic(base44, user) {
  try {
    const r = await base44.functions.invoke('loanLogicV2', { userId: user.id });
    const data = r?.data || r;
    if (data?.success === false) {
      console.warn('[orchestration] loanLogicV2 returned failure:', data?.error);
      return null;
    }
    return data || null;
  } catch (err) {
    console.error('[orchestration] loanLogicV2 invocation failed:', err.message);
    return null;
  }
}

// ─── Step 2: Get behavioral insights from insightEngine ───────────────────────
async function runInsightEngine(base44, loanLogicOutput) {
  if (!loanLogicOutput?.metrics) return null;
  try {
    const r = await base44.functions.invoke('insightEngine', { metrics: loanLogicOutput.metrics });
    const data = r?.data || r;
    if (data?.success === false) {
      console.warn('[orchestration] insightEngine returned failure:', data?.error);
      return null;
    }
    return data || null;
  } catch (err) {
    console.error('[orchestration] insightEngine invocation failed:', err.message);
    return null;
  }
}

// ─── Step 3 (Approval Optimization): Get rescue strategies from dealRescuer ──
// Run when:
//   • decision is rejected/review/adjusted (find alternative structure)
//   • OR caller explicitly requested rescue (e.g., upsell on approved)
async function runDealRescuer(base44, { spec, context, loanMetrics, insightsData, decisionStatus, options }) {
  const shouldRun = options.runRescue === true
    || (options.runRescue !== false && ['rejected', 'review', 'adjusted'].includes(decisionStatus));
  if (!shouldRun) return null;

  const requestedAmount = Number(context[spec.requestedAmountField] || 0);
  if (!requestedAmount || requestedAmount <= 0) return null;
  if (!loanMetrics) return null;

  const income = Number(loanMetrics.totalIncome || 0);
  if (income <= 0) return null;

  try {
    const r = await base44.functions.invoke('dealRescuerEngine', {
      income,
      existingDebtPayments: 0, // analyzer doesn't expose this; rescuer uses estimatedExpenses fallback
      requestedLoanAmount: requestedAmount,
      requestedTermMonths: Number(context.term_months || 48),
      baseInterestRate: 0.09,
      score: Number(loanMetrics.score || 0),
      currentStatus: decisionStatus,
      analysisInsights: insightsData?.analysisInsights || null
    });
    const data = r?.data || r;
    return data || null;
  } catch (err) {
    console.error('[orchestration] dealRescuerEngine invocation failed:', err.message);
    return null;
  }
}

// ─── Step 4: Persist to UnderwritingAnalysis (hybrid encryption) ─────────────
async function persistUnderwritingAnalysis(base44, { loanLogicOutput, insightsData, rescueResult }) {
  if (!loanLogicOutput || !insightsData) return null;
  try {
    const r = await base44.functions.invoke('persistAnalysis', {
      action: 'save',
      insights: insightsData?.insights || insightsData,
      loanMetrics: loanLogicOutput.metrics,
      rescueResult: rescueResult || null,
      creditJustifications: []
    });
    const data = r?.data || r;
    return data?.id || null;
  } catch (err) {
    console.error('[orchestration] persistAnalysis failed (non-blocking):', err.message);
    return null;
  }
}

// ─── Step 5: Persist the product request record ──────────────────────────────
// Unified persistence — single LoanApplication entity for all loan types.
async function persistProductRequest({ base44, user, spec, context, decision }) {
  try {
    const requestedAmount = Number(context[spec.requestedAmountField] || 0);
    const borrowerSegment = spec.loanType === 'personal_loan' ? 'consumer' : 'business';

    // Build product-specific details payload
    let details = {};
    if (spec.loanType === 'check_discount') {
      details = {
        due_date: context.due_date,
        third_party_tax_id: context.third_party_tax_id || '',
        third_party_name: context.third_party_name || '',
        check_image_url: context.check_image_url || '',
        check_number: context.check_number || '',
        ocr_confidence: Number(context.ocr_confidence || 0)
      };
    } else if (spec.loanType === 'b2b_financing') {
      details = {
        counterparty_tax_id: context.counterparty_tax_id,
        buyer_name: context.buyer_name,
        target_mrr: context.target_mrr,
        acquirer_name: context.acquirer_name,
        po_number: context.po_number
      };
    } else if (spec.loanType === 'personal_loan') {
      details = {
        purpose: context.purpose || '',
        employment_status: context.employment_status || ''
      };
    }

    return await base44.entities.LoanApplication.create({
      loan_type: spec.loanType,
      product_type: spec.productType || null,
      borrower_segment: borrowerSegment,
      borrower_id: user.id,
      borrower_name: user.full_name || '',
      requested_amount: requestedAmount,
      term_months: Number(context.term_months || 12),
      details,
      status: decision.status,
      decision
    });
  } catch (err) {
    console.error('[orchestration] LoanApplication persist failed (non-blocking):', err?.message);
  }
  return null;
}

// ─── Audit logging (non-blocking) ─────────────────────────────────────────────
async function audit({ base44, user, product, decision, fallbackUsed, rescueRan, durationMs, error }) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'ORCHESTRATION_DECISION',
      user_id: user?.email || user?.id || 'anonymous',
      details: {
        product,
        status: decision?.status || 'error',
        fallback_used: !!fallbackUsed,
        rescue_ran: !!rescueRan,
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

    // ── 2. GROUND TRUTH — loanLogicV2 (single source of financial metrics) ──
    // Skip when caller explicitly opts out (e.g., integration tests, deterministic runs).
    const loanLogicOutput = options.skipLoanLogic === true
      ? null
      : await runLoanLogic(base44, user);
    const loanMetrics = loanLogicOutput?.metrics || null;

    // ── 3. BEHAVIORAL — insightEngine (false-negative, narrative, policy) ──
    const insightsData = options.skipInsights === true
      ? null
      : await runInsightEngine(base44, loanLogicOutput);

    // ── 4. PRODUCT ROUTING — invoke the specialized analyzer ──
    //    Analyzer receives loanMetrics so it does NOT recompute them.
    const analyzerPayload = buildAnalyzerPayload(product, spec, context, loanMetrics);
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

    // ── 5. Normalize decision envelope ──
    let decision = normalizeDecision(product, analyzerRes);
    let fallbackUsed = false;
    let fallbackDecision = null;

    // ── 6. Fallback Logic — if primary rejected AND fallback configured AND opt-in ──
    if (decision.status === 'rejected' && spec.fallback && options.enableFallback !== false) {
      const fbProduct = spec.fallback;
      const fbSpec = PRODUCT_REGISTRY[fbProduct];
      if (fbSpec) {
        try {
          const fbPayload = buildAnalyzerPayload(fbProduct, fbSpec, context, loanMetrics);
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

    // ── 7. APPROVAL OPTIMIZATION — dealRescuerEngine for non-approved cases ──
    const rescueResult = await runDealRescuer(base44, {
      spec,
      context,
      loanMetrics,
      insightsData,
      decisionStatus: decision.status,
      options
    });

    // ── 8. PERSIST UnderwritingAnalysis (hybrid privacy: structured + encrypted) ──
    let analysisId = null;
    if (options.persist !== false && loanMetrics && insightsData) {
      analysisId = await persistUnderwritingAnalysis(base44, { loanLogicOutput, insightsData, rescueResult });
    }

    // ── 9. PERSIST product request record ──
    let persistedId = null;
    if (options.persist !== false && ['approved', 'review', 'adjusted', 'rejected'].includes(decision.status)) {
      const saved = await persistProductRequest({ base44, user, spec, context, decision });
      persistedId = saved?.id || null;
    }

    const durationMs = Date.now() - startedAt;
    await audit({ base44, user, product, decision, fallbackUsed, rescueRan: !!rescueResult, durationMs });

    // ── 10. Unified response envelope ──
    return Response.json({
      success: true,
      decision,
      fallback: fallbackUsed ? { product: spec.fallback, decision: fallbackDecision } : null,
      financial_context: loanMetrics ? {
        score: loanMetrics.score,
        status: loanMetrics.status,
        dti: loanMetrics.dti,
        total_income: loanMetrics.totalIncome,
        total_expenses: loanMetrics.totalExpenses,
        liquid_assets: loanMetrics.liquidAssets,
        runway_months: loanMetrics.runway,
        trends: loanMetrics.trends || null,
        is_clean_12_months: !!loanMetrics.isClean12Months
      } : null,
      behavioral_insights: insightsData?.analysisInsights || null,
      rescue: rescueResult ? {
        strategies: rescueResult.rescueStrategies || [],
        aggressive_product: rescueResult.aggressiveProduct || null,
        fallback: rescueResult.fallback || null,
        before: rescueResult.before || null,
        after: rescueResult.after || null,
        xai_factors: rescueResult.xai_factors || null,
        credit_tier: rescueResult.credit_tier || null,
        explanation: rescueResult.explanation || ''
      } : null,
      persisted_id: persistedId,
      analysis_id: analysisId,
      meta: {
        orchestrator_version: 'v1.1.0',
        product,
        analyzer: spec.analyzer,
        layer: spec.layer,
        duration_ms: durationMs,
        steps_executed: {
          loan_logic: !!loanLogicOutput,
          insights: !!insightsData,
          analyzer: true,
          fallback: fallbackUsed,
          rescue: !!rescueResult,
          persist_analysis: !!analysisId,
          persist_product: !!persistedId
        }
      }
    });

  } catch (error) {
    console.error('[orchestrationEngine] unhandled error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});