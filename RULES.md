# FlowUp Development Rules

## Quick Navigation
- [Rule 1 — No Duplicates](#rule-1--no-duplicates)
- [Rule 2 — Minimal Changes](#rule-2--minimal-changes)
- [Rule 3 — Base44 Compatibility](#rule-3--base44-compatibility)
- [Project Structure](#project-structure)
- [Base44 Key Files](#base44-key-files)

---

## Rule 1 — No Duplicates

Before adding anything new, check if it already exists:

```bash
# Search for a component
grep -r "ComponentName" src/

# Find files by name
find src/ -name "*.jsx" | grep keyword
```

**What to check:**
- UI components → `src/components/ui/`
- Dashboard components → `src/components/dashboard/`
- Hooks → `src/components/hooks/`
- Utility functions → `src/components/utils/`
- Pages → `src/pages/`

---

## Rule 2 — Minimal Changes

- Only change the lines that are broken or missing — do NOT refactor surrounding code
- Do NOT add comments, docstrings, or type annotations to code you didn't touch
- Do NOT add error handling for scenarios that can't happen
- Do NOT create helpers or abstractions for one-off operations
- Three similar lines is better than a premature abstraction

**Example:** If a bug is in one `if` block, fix only that block. Leave the rest exactly as is.

---

## Rule 3 — Base44 Compatibility

The friend runs this project via [base44](https://base44.com). Never break the base44 connection.

### What base44 requires:
- `src/api/base44Client.js` — must remain unchanged (the SDK client)
- `src/lib/app-params.js` — reads `VITE_BASE44_APP_ID` and token from URL/localStorage
- `.env` — must contain valid `VITE_BASE44_APP_ID` and `VITE_BASE44_APP_BASE_URL`
- `vite.config.js` — must keep the `base44()` vite plugin

### What the friend needs to run locally:
1. Copy `.env.example` → `.env`
2. Fill in `VITE_BASE44_APP_ID` (from base44 dashboard)
3. Run `npm install && npm run dev`
4. Open the base44 app URL (token is injected via URL param)

### Never do:
- Remove or rename `base44` from `src/api/base44Client.js`
- Change the `createClient` call signature in a way that breaks the SDK
- Remove the `@base44/vite-plugin` from `vite.config.js`
- Remove `requiresAuth: false` (needed for local dev without a token)
- Break entity calls like `base44.entities.FinancialSnapshot.list()`
- Break function calls like `base44.functions.invoke('functionName', {...})`

### Safe to change:
- React components, pages, hooks, utilities
- UI styling and layout
- Dashboard logic and calculations
- Adding new entities or functions (don't remove existing ones)

---

## Project Structure

```
src/
├── api/
│   └── base44Client.js        # SDK client — handle with care
├── lib/
│   ├── app-params.js           # Reads base44 token & app ID
│   ├── AuthContext.jsx         # Auth state provider
│   └── utils.js
├── pages/
│   └── Dashboard.jsx           # Main dashboard page
├── components/
│   ├── connect/
│   │   └── OpenFinanceConnect.jsx  # Bank connect flow
│   ├── dashboard/              # Dashboard sub-components
│   ├── hooks/
│   │   ├── useLoanMetrics.jsx  # Fetches loanLogicV2 function
│   │   └── useTransactionSync.jsx
│   ├── upload/
│   │   └── CSVUploader.jsx     # CSV/Excel upload (uses @e965/xlsx)
│   ├── utils/
│   │   ├── forecastingLogic.jsx
│   │   ├── bankParsers.jsx
│   │   └── riskEngine.jsx
│   └── ui/                     # shadcn/ui components
└── App.jsx                     # Root — AuthProvider + Router
```

---

## Base44 Key Files

| File | Purpose | Fragility |
|------|---------|-----------|
| `src/api/base44Client.js` | Creates the SDK client | HIGH — don't change |
| `src/lib/app-params.js` | Reads token + app config | HIGH — don't change |
| `vite.config.js` | Vite + base44 plugin config | MEDIUM |
| `src/lib/AuthContext.jsx` | Auth flow | MEDIUM |
| `.env` | App ID + base URL | REQUIRED |
