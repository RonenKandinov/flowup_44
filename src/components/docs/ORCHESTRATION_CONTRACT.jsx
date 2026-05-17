/**
 * FlowUp — Decision Orchestration Contract
 * =========================================
 *
 * THE source-of-truth for how the frontend talks to the B2B decisioning layer.
 *
 * After 2026-05-17, the frontend MUST call `orchestrationEngine` for any
 * credit decision. Direct calls to `checkDiscountAnalyze` / `b2bFinancingAnalyze`
 * are deprecated (they still work, but they bypass: product matching,
 * validation, normalization, fallback logic, persistence, and audit logging).
 *
 * ============================================================================
 * # 1. Why this layer exists (recap from B2B_MODULES.md §2)
 * ============================================================================
 *
 * BEFORE — every tab implemented its own glue:
 *   CheckDiscountTab → checkDiscountAnalyze → CheckDiscountRequest.create()
 *   B2BFinancingTab  → b2bFinancingAnalyze  → B2BFinancingRequest.create()
 *   (each tab also did its own error handling, response parsing, persistence)
 *
 * AFTER — one entry point:
 *   any tab → orchestrationEngine → (validation → routing → fallback → persist → audit)
 *
 * Benefits:
 *   ✓ Single contract — change once, applies to all tabs
 *   ✓ Centralized validation — bad input never reaches the analyzers
 *   ✓ Normalized envelope — UI doesn't need to know which analyzer returned what
 *   ✓ Built-in fallback logic — rejected WC can auto-try Factoring
 *   ✓ Centralized audit log — every decision is traceable
 *
 * ============================================================================
 * # 2. Request contract
 * ============================================================================
 *
 * POST orchestrationEngine
 * {
 *   "product": "<product_key>",       // see §4 for full list
 *   "context": { ...product-specific fields... },
 *   "options": {
 *     "persist": true,                // default true — write to DB
 *     "enableFallback": true          // default true — try fallback on reject
 *   }
 * }
 *
 * ============================================================================
 * # 3. Response contract (unified envelope)
 * ============================================================================
 *
 * {
 *   "success": true,
 *   "decision": {
 *     "product": "check_discount",
 *     "status": "approved" | "rejected" | "review" | "adjusted",
 *     "reason": "...",
 *     "rate": 2.5,                    // % — analyzer-specific
 *     "max_amount": 50000,            // ₪ — analyzer-specific
 *     "metrics": { dti, liquidity_months, ... },
 *     "third_party_history": { ... }, // only for check_discount
 *     "product_specific": { ... }     // analyzer-specific extras
 *   },
 *   "fallback": null | {              // populated only if fallback was triggered
 *     "product": "factoring",
 *     "decision": { ...same envelope as decision... }
 *   },
 *   "persisted_id": "abc123" | null,
 *   "meta": {
 *     "orchestrator_version": "v1.0.0",
 *     "product": "check_discount",
 *     "analyzer": "checkDiscountAnalyze",
 *     "layer": "decisioning",
 *     "duration_ms": 1234
 *   }
 * }
 *
 * Error response:
 * {
 *   "success": false,
 *   "error": "Missing required fields for check_discount: amount, due_date"
 * }
 * HTTP codes: 400 = validation, 401 = auth, 500 = analyzer error, 502 = analyzer unreachable
 *
 * ============================================================================
 * # 4. Product registry — what each product expects
 * ============================================================================
 *
 * | product             | layer       | required context                | optional context                      | fallback     |
 * |---------------------|-------------|----------------------------------|---------------------------------------|--------------|
 * | check_discount      | decisioning | amount, due_date                 | third_party_tax_id, third_party_name, | —            |
 * |                     |             |                                  | check_image_url, check_number,         |              |
 * |                     |             |                                  | ocr_confidence                         |              |
 * | working_capital     | decisioning | requested_amount                 | term_months                           | factoring    |
 * | factoring           | decisioning | requested_amount                 | term_months, counterparty_tax_id      | —            |
 * | reverse_factoring   | decisioning | requested_amount                 | term_months, counterparty_tax_id      | —            |
 * | rbf                 | decisioning | requested_amount                 | target_mrr                            | —            |
 * | po_financing        | decisioning | requested_amount                 | po_number, buyer_name                 | —            |
 * | mca                 | decisioning | requested_amount                 | acquirer_name                         | —            |
 *
 * Analytics-layer modules (Treasury / Collections / Underwriting Infra) do NOT
 * go through the orchestrator — they read directly via cashFlowIntelligence or
 * entity queries. Only Decisioning Layer products use orchestrationEngine.
 *
 * ============================================================================
 * # 5. Frontend usage example
 * ============================================================================
 *
 * import { base44 } from '@/api/base44Client';
 *
 * // Check Discount
 * const r1 = await base44.functions.invoke('orchestrationEngine', {
 *   product: 'check_discount',
 *   context: {
 *     amount: 25000,
 *     due_date: '2026-08-15',
 *     third_party_tax_id: '512345678',
 *     third_party_name: 'ספק דוגמה בע״מ'
 *   }
 * });
 * if (r1.data.success) {
 *   const { status, reason, rate } = r1.data.decision;
 *   // ... render decision
 * }
 *
 * // Working Capital with auto-fallback to Factoring
 * const r2 = await base44.functions.invoke('orchestrationEngine', {
 *   product: 'working_capital',
 *   context: { requested_amount: 100000, term_months: 18 },
 *   options: { enableFallback: true }
 * });
 * if (r2.data.success && r2.data.fallback) {
 *   // Primary rejected, but fallback (factoring) succeeded
 * }
 *
 * ============================================================================
 * # 6. Status semantics (uniform across all products)
 * ============================================================================
 *
 * | status    | meaning                                    | UI suggestion          |
 * |-----------|--------------------------------------------|------------------------|
 * | approved  | Auto-approved by policy                    | Green banner           |
 * | adjusted  | Approved with modified terms (rate/amount) | Yellow + show changes  |
 * | review    | Needs human credit-officer review          | Orange + "Pending"     |
 * | rejected  | Declined by policy                         | Red + reason + Rescuer |
 *
 * ============================================================================
 * # 7. Data Consistency rules (enforced by orchestrator)
 * ============================================================================
 *
 * 1. Every persisted record MUST carry the user's `business_id` /
 *    `requesting_business_id` (auto-set by orchestrator from `user.id`).
 * 2. Every record carries the normalized `status` — analyzer-specific terms
 *    like "decline" or "manual_review" are mapped before persisting.
 * 3. Every decision is mirrored to AuditLog with `action: ORCHESTRATION_DECISION`.
 * 4. Persistence failures are logged but NEVER block the response — the
 *    decision is always returned to the user.
 *
 * ============================================================================
 * # 8. Testing
 * ============================================================================
 *
 * End-to-end tests live in `functions/runIntegrationTests.js` (admin only).
 *
 * Coverage:
 *   ✓ Entity schemas reachable
 *   ✓ Validation rejects bad input
 *   ✓ check_discount full path
 *   ✓ working_capital full path
 *   ✓ fallback envelope shape
 *   ✓ audit log written
 *
 * Run via: test_backend_function('runIntegrationTests', {})
 *
 * ============================================================================
 * # 9. Versioning
 * ============================================================================
 *
 * The orchestrator stamps `meta.orchestrator_version` on every response.
 * Bump this when changing the response envelope. The contract is:
 *
 *   v1.x — additive changes only (new optional fields)
 *   v2.x — breaking changes (renamed/removed fields)
 *
 * Frontend can pin to a minimum version by checking `meta.orchestrator_version`.
 */

export default null;