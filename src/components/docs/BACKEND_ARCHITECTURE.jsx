# FlowUp — Backend Architecture & Data Model

> **CTO note:** This document is the source of truth for how our backend
> functions and entities are organized. Read it before adding a new function
> or entity — if a logical service already exists, **extend it via an `action`
> parameter** rather than creating a new top-level function. If a data concept
> can live inside an existing `details` / `metadata` JSON field, do that
> instead of creating a sibling entity.

---

## Part 1 — Backend Functions

### Why this matters

We were heading toward "one function per task" sprawl (20+ files). That hurts
discoverability, makes secret/permission management harder, and scatters
business logic across the codebase. The rule going forward:

- **One service per business domain.** A "service" is a single backend function
  that routes by `action` (or `service`/`action` pair) to multiple handlers.
- **One engine per math-heavy module.** Pure decisioning logic that's large
  enough to deserve its own file stays separate (`loanLogicV2`, `dealRescuerEngine`).
- **One adapter per external API.** Anything that talks to a 3rd-party (Open
  Finance, OCR, Google Sheets) is its own file, never mixed with business logic.

### The four buckets

#### 1. Services (multi-action, route by `action`)

| Function | Domain | Actions |
|---|---|---|
| `b2bService` | B2B partner lifecycle | `generate_magic_link`, `process_underwriting`, `send_webhook` |
| `systemUtils` | Cross-cutting utilities | `sanitizer`, `storage` (SecureVault), `audit` (AuditLog) |
| `openFinanceAuth` | Open Finance OAuth + sync | `init_connection`, `check_status`, `finalize_connection` |

**Rule:** new B2B partner actions → add to `b2bService`. New audit/sanitize/vault
actions → add to `systemUtils`. New Open Finance ops → add to `openFinanceAuth`.

#### 2. Decisioning engines (single-purpose, math-heavy — **do not merge**)

| Function | Purpose |
|---|---|
| `loanLogicV2` | Personal-loan underwriting metrics from bank data |
| `dealRescuerEngine` | DSR optimization, tier pricing, rescue strategies |
| `cashFlowIntelligence` | Recurring detection, stability anchors, liquidity runway |
| `insightEngine` | Narrative + XAI generation on top of metrics |
| `loanApplicationAnalyze` | Unified entry for LoanApplication (b2b / check / personal) |
| `orchestrationEngine` | Routes a product request to the right engine + persists |

These stay separate **by design**. Each is independently testable, has its own
guardrails, and a regression in one would block the others if merged.

#### 3. Onboarding (the customer-facing pilot flow)

| Function | Purpose |
|---|---|
| `onboardingLinkCreate` | Admin generates a signed, time-limited link for a customer |
| `onboardingLinkValidate` | Public endpoint the `/connect/:id` page hits before rendering |

**Rule:** these are intentionally split — `create` requires admin auth,
`validate` is public. Merging them would force auth branching inside one
handler, which is a security smell.

#### 4. Adapters & one-shots

| Function | Purpose |
|---|---|
| `checkOcrExtract` | OCR adapter for check images |
| `exportFinancialSnapshotsToGoogleSheets` | Google Sheets adapter |
| `listDirectDebits` | Read-only view of direct debits + hidden-income detection |
| `fup_live` | Lightweight Open Finance smoke-test (live data probe) |
| `persistAnalysis` | Writes an UnderwritingAnalysis record (with AES-GCM for narrative) |
| `generateCreditJustification` | LLM call to justify a rescue strategy |
| `runIntegrationTests` | Admin-only E2E test runner |

Each has a distinct trigger (OCR pipeline, Google OAuth, LLM call, test runner)
— merging them would couple unrelated failure modes.

### Frontend contract

All functions are invoked via the SDK:

```js
import { base44 } from '@/api/base44Client';
const res = await base44.functions.invoke('functionName', payload);
```

If you need new behavior, ask first: **"does an existing service already own
this domain?"** If yes, add an `action`. If no, write a new function and
update this document.

### How to add a new behavior

✅ **DO** — extend an existing service:
```js
// b2bService.js — add a new action
if (action === 'list_pending_sessions') {
  // ...new logic
  return Response.json({ ... });
}
```

❌ **DON'T** — create a parallel function `b2bListPendingSessions.js`
that duplicates the routing/auth boilerplate.

### Secrets in use

| Secret | Used by |
|---|---|
| `OPEN_FINANCE_API_KEY` / `OPEN_FINANCE_API_SECRET` | `openFinanceAuth`, `fup_live` |
| `ONBOARDING_LINK_SECRET` | `onboardingLinkCreate`, `onboardingLinkValidate` (HMAC) |
| `SECURE_VAULT_SECRET` | `systemUtils` (AES-GCM), `persistAnalysis` (narrative encryption) |

Never read secrets at module top-level — always inside the `Deno.serve`
handler, otherwise a missing secret crashes boot before our error handler runs.

---

## Part 2 — Data Model (Entities)

### The four data domains

#### 1. Open Finance (raw bank data — the source of truth)

| Entity | Why it exists |
|---|---|
| `OpenFinanceConnection` | One row per PSU↔provider link. Tracks consent lifecycle. |
| `OpenFinanceAccount` | Bank accounts behind a connection. Balances live here. |
| `OpenFinanceTransaction` | Normalized transactions. Primary input to every engine. |
| `OpenFinanceToken` | OAuth access token. Kept separately for security boundary. |
| `DirectDebitAuthorization` | Discovered standing orders — derived from transactions. |

These mirror the provider's data model 1:1. Don't merge — each is a different
API resource with its own refresh cadence.

#### 2. Decisioning (what FlowUp produces on top of raw data)

| Entity | Why it exists |
|---|---|
| `FinancialSnapshot` | Latest cash-flow summary per user. Powers the dashboard. |
| `UnderwritingAnalysis` | Persistent record of a single underwriting run. |
| `UnderwritingRule` | Per-partner configuration (DTI, tier pricing, PD coefficients). |
| `LoanApplication` | Unified application — personal, B2B, check-discount. Product data in `details`. |
| `CollectionsCase` | Overdue invoice tracked by Collections Intelligence. |

**Rule:** `LoanApplication.details` is intentionally free-form JSON. Use it
instead of new entities per product type.

#### 3. B2B partner flow (the pilot revenue stream)

| Entity | Why it exists |
|---|---|
| `B2BPartner` | The partner company (name, API key, webhook URL). |
| `CustomerOnboardingSession` | One-time signed link. Tracks `pending` → `completed` funnel. |
| `Invoice` | B2B invoice — Factoring/Collections modules. |
| `SupplierPayment` | Payables — Supplier Finance + Treasury. |

`CustomerOnboardingSession` carries denormalized `b2b_partner_name` on purpose
— the customer-facing page renders before authentication, so it can't safely
fetch the partner record.

#### 4. Cross-cutting (security + compliance)

| Entity | Why it exists |
|---|---|
| `AuditLog` | Append-only log of sensitive actions. Powers `/audit-logs`. |
| `SecureVault` | Per-user AES-GCM encrypted blob. Used by `systemUtils` (`storage`). |
| `Transaction` | Legacy CSV-upload fallback (pre Open-Finance). |

`Transaction` vs `OpenFinanceTransaction`: `Transaction` is the fallback when
a user uploads a CSV instead of connecting their bank. The dashboard reads
from whichever has more recent data.

### Entities we removed

- **`ShadowRealmEntry`** — experimental obfuscation prototype, never reached
  production. Removed in the 2026-05 cleanup. No references in current code.

### When to add a new entity

Ask these in order:

1. **Can it live inside an existing `details` / `metadata` field?**
   `LoanApplication.details`, `OpenFinanceConnection.metadata`, and
   `UnderwritingAnalysis.structured_metrics` are intentionally JSON. Use them.

2. **Is it a new business concept or a variation of an existing one?**
   `CheckDiscountRequest` and `B2BFinancingRequest` were merged into
   `LoanApplication` with `loan_type` precisely to avoid entity sprawl.

3. **Does it have its own lifecycle independent of any other entity?**
   If yes → new entity. If always created/updated alongside another → embed it.

4. **Does it need its own RLS rules?**
   If the access pattern differs, a separate entity is justified.

### Potential future consolidation (NOT being changed now)

Listed so we don't lose the thought:

- `OpenFinanceToken` could become an embedded field on `OpenFinanceConnection`
  if we drop multi-token support per connection.
- `Transaction` could be retired once 100% of users are on Open Finance —
  today it's still the CSV-upload fallback.

If/when we consolidate, the trigger is a code-review cycle, not a "let's clean
up entities" sprint — every change risks breaking RLS or a frontend filter.