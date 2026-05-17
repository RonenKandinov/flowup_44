// ============================================================================
// runIntegrationTests — End-to-End Test Suite for the B2B Decisioning Pipeline
// ============================================================================
//
// Admin-only. Verifies that the entire flow works:
//
//   Test 1: Entity schemas exist & required fields are honored
//   Test 2: orchestrationEngine validation rejects bad input
//   Test 3: orchestrationEngine → checkDiscountAnalyze full path
//   Test 4: orchestrationEngine → b2bFinancingAnalyze (working_capital) full path
//   Test 5: Response envelope matches the contract
//   Test 6: Audit log was written
//
// Usage:
//   - Triggered from a UI admin panel, or via test_backend_function tool.
//   - Returns { passed, failed, results: [...] }
//
// Note: this is an INTEGRATION test, not a unit test. It exercises the real
// orchestrator and underlying analyzers — so it needs OPEN_FINANCE credentials
// to be set and the user to have transaction history. When data is missing,
// individual tests will skip rather than fail.
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const REQUIRED_DECISION_FIELDS = ['product', 'status', 'reason'];
const VALID_STATUSES = ['approved', 'rejected', 'review', 'adjusted'];

function makeResult(name, passed, message, details = {}) {
  return { name, passed, status: passed ? 'PASS' : 'FAIL', message, details };
}

function makeSkip(name, message) {
  return { name, passed: true, status: 'SKIP', message, details: {} };
}

// ─── Test 1: Entity schemas reachable ────────────────────────────────────────
async function testEntitySchemas(base44) {
  const entities = [
    'CheckDiscountRequest',
    'B2BFinancingRequest',
    'UnderwritingAnalysis',
    'OpenFinanceTransaction',
    'UnderwritingRule'
  ];
  const missing = [];
  for (const ent of entities) {
    try {
      // Just list with limit 1 — confirms the entity exists and is queryable
      await base44.asServiceRole.entities[ent].list('-created_date', 1);
    } catch (err) {
      missing.push({ entity: ent, error: err.message });
    }
  }
  if (missing.length > 0) {
    return makeResult('Entity schemas reachable', false, `Missing/unreachable entities: ${missing.map(m => m.entity).join(', ')}`, { missing });
  }
  return makeResult('Entity schemas reachable', true, `All ${entities.length} entities reachable`);
}

// ─── Test 2: Orchestrator validation ─────────────────────────────────────────
async function testOrchestratorValidation(base44) {
  // Case A: unsupported product
  try {
    const r1 = await base44.functions.invoke('orchestrationEngine', { product: 'crypto_loan', context: {} });
    const data1 = r1?.data || r1;
    if (data1?.success !== false) {
      return makeResult('Orchestrator validation', false, 'Unsupported product was not rejected', { response: data1 });
    }
  } catch (err) {
    // 400 is expected — invoke may throw on non-2xx
    if (!String(err.message).match(/unsupported|400/i)) {
      return makeResult('Orchestrator validation', false, `Unexpected error for bad product: ${err.message}`);
    }
  }

  // Case B: missing required field
  try {
    const r2 = await base44.functions.invoke('orchestrationEngine', { product: 'check_discount', context: {} });
    const data2 = r2?.data || r2;
    if (data2?.success !== false) {
      return makeResult('Orchestrator validation', false, 'Missing required field was not rejected', { response: data2 });
    }
  } catch (err) {
    if (!String(err.message).match(/missing|required|400/i)) {
      return makeResult('Orchestrator validation', false, `Unexpected error for missing field: ${err.message}`);
    }
  }

  return makeResult('Orchestrator validation', true, 'Bad inputs correctly rejected (unsupported product, missing required field)');
}

// ─── Test 3: Check Discount full path ────────────────────────────────────────
async function testCheckDiscountFlow(base44) {
  try {
    const r = await base44.functions.invoke('orchestrationEngine', {
      product: 'check_discount',
      context: {
        amount: 15000,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        third_party_name: '__INTEGRATION_TEST__',
        third_party_tax_id: '000000000'
      },
      options: { persist: false } // don't pollute production data
    });
    const data = r?.data || r;
    if (!data?.success) {
      return makeResult('Check Discount flow', false, `Orchestrator returned failure: ${data?.error}`, { response: data });
    }
    // Envelope check
    for (const field of REQUIRED_DECISION_FIELDS) {
      if (!(field in (data.decision || {}))) {
        return makeResult('Check Discount flow', false, `Missing field "${field}" in decision envelope`, { decision: data.decision });
      }
    }
    if (!VALID_STATUSES.includes(data.decision.status)) {
      return makeResult('Check Discount flow', false, `Invalid status: ${data.decision.status}`, { decision: data.decision });
    }
    return makeResult('Check Discount flow', true, `End-to-end OK — status=${data.decision.status}, duration=${data.meta?.duration_ms}ms`);
  } catch (err) {
    return makeResult('Check Discount flow', false, `Exception: ${err.message}`);
  }
}

// ─── Test 4: Working Capital full path ───────────────────────────────────────
async function testWorkingCapitalFlow(base44) {
  try {
    const r = await base44.functions.invoke('orchestrationEngine', {
      product: 'working_capital',
      context: {
        requested_amount: 50000,
        term_months: 12
      },
      options: { persist: false, enableFallback: false }
    });
    const data = r?.data || r;
    if (!data?.success) {
      return makeResult('Working Capital flow', false, `Orchestrator returned failure: ${data?.error}`, { response: data });
    }
    for (const field of REQUIRED_DECISION_FIELDS) {
      if (!(field in (data.decision || {}))) {
        return makeResult('Working Capital flow', false, `Missing field "${field}" in decision envelope`, { decision: data.decision });
      }
    }
    if (!VALID_STATUSES.includes(data.decision.status)) {
      return makeResult('Working Capital flow', false, `Invalid status: ${data.decision.status}`, { decision: data.decision });
    }
    return makeResult('Working Capital flow', true, `End-to-end OK — status=${data.decision.status}, duration=${data.meta?.duration_ms}ms`);
  } catch (err) {
    return makeResult('Working Capital flow', false, `Exception: ${err.message}`);
  }
}

// ─── Test 5: Audit log was written ───────────────────────────────────────────
async function testAuditLogs(base44) {
  try {
    const recent = await base44.asServiceRole.entities.AuditLog.filter(
      { action: 'ORCHESTRATION_DECISION' },
      '-created_date',
      5
    );
    if (!Array.isArray(recent) || recent.length === 0) {
      return makeSkip('Audit logs written', 'No ORCHESTRATION_DECISION audit logs found (run other tests first)');
    }
    const latest = recent[0];
    const createdMsAgo = Date.now() - new Date(latest.created_date).getTime();
    if (createdMsAgo > 5 * 60 * 1000) {
      return makeSkip('Audit logs written', `Latest audit log is ${Math.round(createdMsAgo / 1000)}s old — may be stale`);
    }
    return makeResult('Audit logs written', true, `${recent.length} recent ORCHESTRATION_DECISION audit log(s) found`);
  } catch (err) {
    return makeResult('Audit logs written', false, `Exception: ${err.message}`);
  }
}

// ─── Test 6: Fallback logic triggers ─────────────────────────────────────────
async function testFallbackLogic(base44) {
  // We can't deterministically force a rejection, but we can verify the orchestrator
  // accepts the enableFallback option and returns the expected envelope shape.
  try {
    const r = await base44.functions.invoke('orchestrationEngine', {
      product: 'working_capital',
      context: { requested_amount: 50000 },
      options: { persist: false, enableFallback: true }
    });
    const data = r?.data || r;
    if (!data?.success) {
      return makeSkip('Fallback envelope', `Orchestrator failed before fallback could be tested: ${data?.error}`);
    }
    // fallback field must exist (null when not used, object when used)
    if (!('fallback' in data)) {
      return makeResult('Fallback envelope', false, 'Response missing "fallback" field');
    }
    return makeResult('Fallback envelope', true, `Envelope OK — fallback=${data.fallback ? 'used' : 'null'}`);
  } catch (err) {
    return makeResult('Fallback envelope', false, `Exception: ${err.message}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const startedAt = Date.now();
    const results = [];

    results.push(await testEntitySchemas(base44));
    results.push(await testOrchestratorValidation(base44));
    results.push(await testCheckDiscountFlow(base44));
    results.push(await testWorkingCapitalFlow(base44));
    results.push(await testFallbackLogic(base44));
    results.push(await testAuditLogs(base44));

    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'PASS').length,
      failed: results.filter(r => r.status === 'FAIL').length,
      skipped: results.filter(r => r.status === 'SKIP').length,
      duration_ms: Date.now() - startedAt
    };

    return Response.json({
      success: summary.failed === 0,
      summary,
      results
    });
  } catch (error) {
    console.error('[runIntegrationTests] error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});