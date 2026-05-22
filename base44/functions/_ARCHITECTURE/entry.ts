# FlowUp — Backend Functions Architecture

> **CTO note:** This document is the source of truth for how our backend
> functions are organized. Read it before adding a new function — if a logical
> service already exists, **extend it via an `action` parameter** rather than
> creating a new top-level function.

---

## Why this matters

We were heading toward "one function per task" sprawl (20+ files). That hurts
discoverability, makes secret/permission management harder, and scatters
business logic across the codebase. The rule going forward:

- **One service per business domain.** A "service" is a single backend function
  that routes by `action` (or `service`/`action` pair) to multiple handlers.
- **One engine per math-heavy module.** Pure decisioning logic that's large
  enough to deserve its own file stays separate (`loanLogicV2`, `dealRescuerEngine`).
- **One adapter per external API.** Anything that talks to a 3rd-party (Open
  Finance, OCR, Google Sheets) is its own file, never mixed with business logic.

---

## The four buckets

### 1. Services (multi-action, route by `action`)

| Function | Domain | Actions |
|---|---|---|
| `b2bService` | B2B partner lifecycle | `generate_magic_link`, `process_underwriting`, `send_webhook` |
| `systemUtils` | Cross-cutting utilities | `sanitizer`, `storage` (SecureVault), `audit` (AuditLog) |
| `openFinanceAuth` | Open Finance OAuth + sync | `init_connection`, `check_status`, `finalize_connection` |

**Rule:** new B2B partner actions → add to `b2bService`. New audit/sanitize/vault
actions → add to `systemUtils`. New Open Finance ops → add to `openFinanceAuth`.

### 2. Decisioning engines (single-purpose, math-heavy)

| Function | Purpose |
|---|---|
| `loanLogicV2` | Personal-loan underwriting metrics from bank data |
| `dealRescuerEngine` | DSR optimization, tier pricing, rescue strategies |
| `cashFlowIntelligence` | Recurring detection, stability anchors, liquidity runway |
| `insightEngine` | Narrative + XAI generation on top of metrics |
| `loanApplicationAnalyze` | Unified entry for LoanApplication (b2b / check / personal) |
| `orchestrationEngine` | Routes a product request to the right engine + persists |

**Rule:** these stay separate. Each is independently testable and has its own
guardrails. Do **not** merge them into a "uberEngine" — the cost of a regression
in one would block the others.

### 3. Onboarding (the customer-facing pilot flow)

| Function | Purpose |
|---|---|
| `onboardingLinkCreate` | Admin generates a signed, time-limited link for a customer |
| `onboardingLinkValidate` | Public endpoint the `/connect/:id` page hits before rendering |

**Rule:** these are intentionally split — `create` requires admin auth, `validate`
is public. Merging them into one function would force us to do auth branching
inside a single handler, which is a security smell.

### 4. Adapters & one-shots

| Function | Purpose |
|---|---|
| `checkOcrExtract` | OCR adapter for check images |
| `exportFinancialSnapshotsToGoogleSheets` | Google Sheets adapter |
| `listDirectDebits` | Read-only view of direct debits + hidden-income detection |
| `fup_live` | Lightweight Open Finance smoke-test (live data probe) |
| `persistAnalysis` | Writes an UnderwritingAnalysis record (with AES-GCM for narrative) |
| `generateCreditJustification` | LLM call to justify a rescue strategy |
| `runIntegrationTests` | Admin-only E2E test runner |

**Rule:** these are intentionally **not** merged. Each has a distinct trigger
(OCR pipeline, Google OAuth, LLM call, test runner) and merging them would
couple unrelated failure modes.

---

## Frontend contract — what you can call

All functions are invoked via the SDK:

```js
import { base44 } from '@/api/base44Client';
const res = await base44.functions.invoke('functionName', payload);
```

**Stable endpoints (never rename):**
- `b2bService` — partner flows
- `openFinanceAuth` — bank connection
- `loanLogicV2`, `dealRescuerEngine`, `cashFlowIntelligence`, `insightEngine`,
  `loanApplicationAnalyze`, `orchestrationEngine` — decisioning
- `onboardingLinkCreate`, `onboardingLinkValidate` — pilot link flow
- `listDirectDebits`, `checkOcrExtract`, `persistAnalysis`,
  `generateCreditJustification`, `exportFinancialSnapshotsToGoogleSheets`,
  `runIntegrationTests`, `systemUtils`, `fup_live` — adapters & utilities

If you need new behavior, ask first: **"does an existing service already own
this domain?"** If yes, add an `action`. If no, write a new function and update
this document.

---

## How to add a new behavior

### ✅ DO — extend an existing service
```js
// b2bService.js — add a new action
if (action === 'list_pending_sessions') {
  // ...new logic
  return Response.json({ ... });
}
```

### ❌ DON'T — create a parallel function
```
functions/b2bListPendingSessions.js  ← duplicates the routing/auth boilerplate
```

### ✅ DO — new domain → new function
A genuinely new business domain (e.g. "factoring", "kyc verification") deserves
its own service file. Add it to the table above.

---

## Secrets in use

| Secret | Used by |
|---|---|
| `OPEN_FINANCE_API_KEY` / `OPEN_FINANCE_API_SECRET` | `openFinanceAuth`, `fup_live` |
| `ONBOARDING_LINK_SECRET` | `onboardingLinkCreate`, `onboardingLinkValidate` (HMAC) |
| `SECURE_VAULT_SECRET` | `systemUtils` (AES-GCM), `persistAnalysis` (narrative encryption) |

Never read secrets at module top-level — always inside the `Deno.serve` handler,
otherwise a missing secret crashes boot before our error handler runs.