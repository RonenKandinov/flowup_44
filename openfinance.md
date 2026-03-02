# Open Finance integration – skills & API summary

Summary for the mission: **Replace MOCK data with REAL Open-Finance live bank data** (consent journey → fetch data → analytics → UI).  
Source: [Open Finance Developer Hub](https://docs.open-finance.ai/).

---

## 1. Skills needed

| Skill | Purpose |
|-------|--------|
| **Server-side auth** | Create access tokens with `clientId` + `clientSecret`; never expose secret to frontend. |
| **OAuth2 / token handling** | Call `POST /oauth/token`; use returned `accessToken` (and `expiresIn`) for all Data API requests. |
| **Consent / connection flow** | Create connection → get `connectUrl` → redirect user → handle return (query params or redirect URL). |
| **Connection status handling** | Map statuses: INACTIVE, FETCHING, CONNECTED, COMPLETED, ACTIVE, ERROR, EXPIRED, REJECTED, etc., and drive UI (loading / success / error). |
| **REST API consumption** | Call Data API with `Authorization: Bearer <accessToken>`, pagination (`nextPage`, `limit`), and date filters for transactions. |
| **Webhooks (optional)** | Configure success/fail/abort URLs; receive POST with connection status; use ngrok for local dev. |
| **Data aggregation** | From accounts + transactions: income, expenses, cashflow, balances, volatility, recurring income; or use Decision/Financial Report APIs if available. |
| **Idempotency & storage** | Persist `userId`, `connectionId`, last status, timestamps; cache or store transactions/accounts for dashboard and retries. |

---

## 2. API endpoints (by flow)

### 2.1 Authentication (server-side only)

| Method | URL | Purpose |
|--------|-----|--------|
| **POST** | `https://api.open-finance.ai/oauth/token` | Create access token. |

**Request body:**

- `userId` (string) – your unique user/borrower id.
- `clientId` (string) – from [dashboard](https://dashboard.open-finance.ai/).
- `clientSecret` (string) – from dashboard; **never send to frontend**.

**Response:** `accessToken`, `tokenType`, `expiresIn` (expiration in **MS** per API reference). Use `accessToken` in `Authorization: Bearer <token>` for all Data API calls. Token is scoped to the given `userId`; all subsequent Data API calls return only that user’s data.

**Note:** Dashboard shows “api key” and “api secret”; the API expects these as `clientId` and `clientSecret`. Contact [Support@open-finance.ai](mailto:Support@open-finance.ai) or use the dashboard to get production access.

Ref: [Access Tokens](https://docs.open-finance.ai/docs/access-tokens), [API reference](https://docs.open-finance.ai/reference/post_token), [Getting Started](https://docs.open-finance.ai/docs/getting-started).

---

### 2.2 Connection / consent journey

| Method | URL | Purpose |
|--------|-----|--------|
| **POST** | `https://api.open-finance.ai/v2/connections` | Create connection; get journey link. |

**Headers:** `Authorization: Bearer <accessToken>` (token from 2.1).

**Request body (main fields):**

- `startDate` (date) – from when to collect transactions (e.g. 6 months ago).
- `redirectUrl` (string, optional) – where to send user after successful connection.
- `language` – `"he"` \| `"en"`.
- `iframe` (boolean, default false) – if true, connection journey can run in an iframe and send status via postMessage.
- `callbackInformation.webhooks` (optional) – `successUrl`, `failUrl`, `abortUrl` for webhooks.
- `providerIds` (array, optional) – limit to specific banks (e.g. `["leumi","mizrahi","hapoalim"]`).
- `includeFakeProviders` (boolean) – `false` for production (real banks).
- `refreshData` (boolean) – if true, recurring fetch of new transactions (connection becomes ACTIVE; otherwise one-time → COMPLETED).
- `customerId` (string, optional) – for extended journeys (e.g. loans); use if you have a customer record.
- `expiryDate` (date-time, optional) – when the connection should expire (PSD2 connections have expiry; when reached, connection is deleted).
- `restrictedTo` (array, optional) – limit to account types: `CACC`, `CARD`, `LOAN`, `SVGS`, `SCTS`.
- `redirectWithoutButtonClick` (boolean, optional) – if true, redirect to bank without user clicking a button.

**Response (201):**

- `id` – connection id (store for status and data fetch).
- `connectUrl` – redirect user here to complete consent (bank login).

**Errors:** 400 – e.g. “production access is not enabled for this organization, you must include fake providers or contact us”; 401/403/404/500.

Ref: [Creating your first connection](https://docs.open-finance.ai/docs/creating-your-first-connection), [Implement Connection/Payment Journey](https://docs.open-finance.ai/docs/implement-consent-journey-sdk), [POST connections](https://docs.open-finance.ai/reference/post_connections).

---

### 2.3 Connection status

- **Option A – Polling:** Use **Connection Status Change** webhook (recommended); or check status in [Dashboard → Connections](https://dashboard.open-finance.ai/). API reference lists `read:connections` scope; if a GET connection-by-id endpoint is available, use it with the token.
- **Option B – Webhooks (recommended):** Enable in [Dashboard → Settings → Alerts](https://dashboard.open-finance.ai/settings/alerts); set success/fail/abort URLs (use [ngrok](https://ngrok.com/) for local dev). You receive a **POST** with body:
  - `connectionId`, `connectionStatus`, `userId`, `orgId`, `expiryDate`, `bankName`
  - `connectionError`: `{ "message", "type" }` when status is ERROR
  - `accountNumbers`: array of account numbers when relevant  
  When `connectionStatus` is `COMPLETED` or `ACTIVE`, fetch data via Get accounts / Get transactions.  
  Ref: [Webhooks Overview](https://docs.open-finance.ai/docs/overview), [Event Types](https://docs.open-finance.ai/docs/webhooks-event-types).

**Status meanings (summary):**

| Status | Meaning |
|--------|--------|
| INACTIVE | Initialised, waiting for user action. |
| FETCHING | Systems connecting to the bank. |
| CONNECTED | Consent journey over; connected to bank. |
| COMPLETED | One-time connection: all accounts/transactions fetched. |
| ACTIVE | Recurring: fetching data daily. |
| ERROR / FETCHING_ERROR | Error; see `connectionError` or GET connection for details. |
| EXPIRED | Connection no longer valid; data will be deleted. |
| REJECTED | User rejected consent at provider. |
| PARTIALLY_AUTHORIZED | Additional account owners must sign (SMS link); after 5 days without response → EXPIRED. |
| REPLACED | New connection with same user/provider is ACTIVE. |
| REVOKED | User revoked consent at provider; data deleted. |
| SUSPENDED_BY_PROVIDER | Provider suspended the consent. |

Ref: [Connection Overview](https://docs.open-finance.ai/docs/overview-1).

---

### 2.4 Fetch accounts

| Method | URL | Purpose |
|--------|-----|--------|
| **GET** | `https://api.open-finance.ai/v2/data/accounts` | Get accounts for the user. |

**Headers:** `Authorization: Bearer <accessToken>`.

**Query params:**

- `userId` (optional) – filter by user.
- `connectionId` (optional) – filter by connection.
- `limit`, `nextPage` – pagination.
- `accountType` (optional) – e.g. CHECKING, CARD, LOAN, SAVINGS, SECURITIES.

**Response:** `items` (array of Account), `nextPage`.  
Account includes: `id`, `userId`, `connectionId`, `providerId`, `accountNumber`, `accountType`, `balances`, `currency`, `ownerInfo`, etc.  
Ref: [Get accounts by user](https://docs.open-finance.ai/reference/get_data-accounts).

---

### 2.5 Fetch transactions

| Method | URL | Purpose |
|--------|-----|--------|
| **GET** | `https://api.open-finance.ai/v2/data/transactions` | Get transactions (e.g. last 6 months). |

**Headers:** `Authorization: Bearer <accessToken>`.

**Query params:**

- `dateFrom`, `dateTo` (YYYY-MM-DD) – **use for “last 6 months”**; if you use these you **cannot use `limit`** in the same request (API constraint). Paginate with `nextPage` only.
- `userId`, `connectionId`, `accountId` (optional) – filter.
- `limit`, `nextPage` – pagination when not using date range; **max 500 items per request**.
- `sort` – 1 (asc) or -1 (desc).
- `type` (optional) – `BANK` \| `CARD`; `includeDuplicates` (0 \| 1) – whether to return duplicates (e.g. same card from bank + card provider).

**Response:** `items` (array of Transaction), `nextPage`.  
Transaction includes: `id`, `amount` (originalAmount, chargedAmount), `date` (valueDate, bookingDate, transactionDate), `description`, `category` (main, sub), `balancePerEndDay`, `classification` (e.g. REGULAR_EXPENSE), `merchantName`, etc.  
Ref: [Get transactions by user](https://docs.open-finance.ai/reference/get_data-transactions).

---

### 2.6 Decision API (optional – insights/report)

- **POST** Create Decision: [post_decision-customerid](https://docs.open-finance.ai/reference/post_decision-customerid) – returns a job id.
- **GET** Decision: [get_decision-jobid](https://docs.open-finance.ai/reference/get_decision-jobid) – poll until `status: "DONE"` (typically 5–20 seconds).

Requires at least one ACTIVE/COMPLETED connection. The job reflects data at creation time; new connections added after the job was created are not included.  
Ref: [Decision Overview](https://docs.open-finance.ai/docs/decision).

---

### 2.7 Financial report (optional – pre-aggregated dashboard data)

Use for pre-aggregated metrics and to speed up dashboard (income, expenses, net, regular income, balances, loans).

| Method | URL | Purpose |
|--------|-----|--------|
| **POST** | `https://api.open-finance.ai/financial-report/{customerId}` | Start report generation; returns `jobId`. |
| **GET** | `https://api.open-finance.ai/financial-report/{jobId}` | Poll until `status: "DONE"`; optional `?withPdf=1` for PDF URL. |

**GET response when DONE:** `financialReport` includes e.g. `totalIncomesOutcome` (sumIncomePerMonth, sumExpansesPerMonth, sumNetIncomePerMonth), `regularIncomeSources`, `yearMonthBalance`, `balancesPerDays`, `loans`, `loansTotal`, `savingsAndSecurities`, `checkingAccounts`, `creditCardOutcomes`, etc. Use `customerId` = your `userId` for MVP.  
Ref: [Get financial report](https://docs.open-finance.ai/docs/get-financial-report).

---

### 2.8 Delete connection (optional)

| Method | URL | Purpose |
|--------|-----|--------|
| **DELETE** | `https://api.open-finance.ai/v2/connections/{connectionId}` | Delete connection by ID (user scope). |

**Important:** Deleting a connection (or when user revokes consent / connection expires) **removes all financial data** for that connection permanently (regulatory).  
**Errors:** 423 – connection locked (e.g. if big-query enabled, can only delete connections created ≥ 90 minutes ago).  
Ref: [Deleting a connection](https://docs.open-finance.ai/docs/deleting-a-connection), [Delete connection by ID](https://docs.open-finance.ai/reference/delete_connections-connectionid).

---

## 3. ENV keys (backend only)

| Variable | Description |
|----------|-------------|
| `OPEN_FINANCE_CLIENT_ID` | From [dashboard](https://dashboard.open-finance.ai/) (Getting started). |
| `OPEN_FINANCE_CLIENT_SECRET` | From dashboard; **must stay server-side only**. |

Optional for webhooks / callbacks:

- Webhook URLs are configured in the [Dashboard → Settings → Alerts](https://dashboard.open-finance.ai/settings/alerts) (success/fail/abort).
- For local dev: expose endpoint via [ngrok](https://ngrok.com/) and set that URL in dashboard.

---

## 4. Data to persist (minimal for MVP)

- `userId` (your borrower id).
- `connectionId` (from POST connections response).
- Last `connectionStatus` + timestamp.
- Optionally: cached accounts and transactions (or re-fetch when dashboard loads).

**Important:** If the user revokes consent at the bank or the connection expires, Open Finance deletes all data for that connection. Your app should handle “no data” / re-connect when status is REVOKED or EXPIRED.

---

## 5. Flow checklist (aligned with prompt.txt)

1. **Connect Bank CTA** → Backend: create or reuse customer identity; create connection (POST `/v2/connections`) with `startDate` (e.g. 6 months ago), `redirectUrl` (return URL to your app).
2. **Redirect** user to `connectUrl` (or open in new tab; same UX as current “Connect Bank”).
3. **User returns** to your site (redirect or callback); backend identifies user (e.g. by session or query param).
4. **Status** – either poll connection status or rely on **Connection Status Change** webhook (ACTIVE/COMPLETED → proceed).
5. **Fetch data** – with valid token: GET `/v2/data/accounts`, GET `/v2/data/transactions` (e.g. `dateFrom` / `dateTo` for last 6 months); paginate with `nextPage` if needed.
6. **Aggregate** – compute income, expenses, cashflow, balance trends, volatility, recurring income from transactions/accounts; or use Decision/Financial Report if integrated.
7. **Dashboard** – replace mock source with this real data; keep existing UI; add loading/error/empty states for consent not completed, ERROR/EXPIRED, FETCHING.

---

## 6. Prerequisites (from docs)

Before implementing the consent journey:

1. **Dashboard:** Retrieve API key and API secret ([dashboard](https://dashboard.open-finance.ai/) → Getting started).
2. **Webhooks:** Enable webhooks and set success/fail/abort URLs in [Dashboard → Settings → Alerts](https://dashboard.open-finance.ai/settings/alerts); for local dev use [ngrok](https://ngrok.com/).
3. **Production access:** If POST connections returns 400 “production access is not enabled”, use fake providers for testing or contact Open Finance.

Ref: [Implement Connection/Payment Journey](https://docs.open-finance.ai/docs/implement-consent-journey-sdk).

---

## 7. Token scopes (reference)

The access token (obtained with clientId + clientSecret + userId) grants scopes such as: `read:transactions`, `read:accounts`, `read:connections`, `create:connections`, `update:connections`, `delete:connections`, `read:providers`. Data API calls are restricted to the token’s user.

---

## 8. Doc links (quick reference)

- [Getting Started](https://docs.open-finance.ai/docs/getting-started)
- [Creating your first connection](https://docs.open-finance.ai/docs/creating-your-first-connection)
- [Access Tokens](https://docs.open-finance.ai/docs/access-tokens)
- [Connection Overview](https://docs.open-finance.ai/docs/overview-1)
- [Implement Connection/Payment Journey](https://docs.open-finance.ai/docs/implement-consent-journey-sdk)
- [Webhooks Overview](https://docs.open-finance.ai/docs/overview) | [Event Types](https://docs.open-finance.ai/docs/webhooks-event-types)
- [Deleting a connection](https://docs.open-finance.ai/docs/deleting-a-connection)
- [Decision Overview](https://docs.open-finance.ai/docs/decision)
- [Get financial report](https://docs.open-finance.ai/docs/get-financial-report)
- API: [POST token](https://docs.open-finance.ai/reference/post_token) | [POST connections](https://docs.open-finance.ai/reference/post_connections) | [GET accounts](https://docs.open-finance.ai/reference/get_data-accounts) | [GET transactions](https://docs.open-finance.ai/reference/get_data-transactions) | [DELETE connection](https://docs.open-finance.ai/reference/delete_connections-connectionid)
