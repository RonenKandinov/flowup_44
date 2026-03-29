# FlowUp - System Architecture

This document outlines the current architecture of the FlowUp platform, serving as a reference for both development and maintenance.

## Core Philosophy

1.  **Local-First Data Processing:** 
    FlowUp prioritizes user privacy and data security by processing sensitive financial data locally on the client's device whenever possible. Data is often sanitized and anonymized (e.g., using the "Shadow Realm" concept) before being sent to the edge/backend for complex analysis.
2.  **Hybrid Prediction Engine:** 
    Calculations (like DTI, cash flow, and risk forecasting) are performed using a hybrid approach. Basic metrics are calculated locally for immediate feedback and privacy, while heavier, AI-driven risk modeling and what-if simulations are offloaded to edge functions (Base44 backend).

## Tech Stack

*   **Frontend:** React (Vite), Tailwind CSS, Shadcn UI, Framer Motion (for animations), Recharts (for data visualization).
*   **Backend:** Base44 Serverless Functions (Deno edge runtime).
*   **State & Caching:** React Query, Local Storage (for local-first data caching).
*   **External Integrations:** Open Finance APIs (for bank connections).

## Project Structure

### 1. Frontend Pages (`/src/pages/`)
*   `Dashboard.jsx`: The central hub for end-users. Displays financial metrics, risk gauges, FutureCake chart, and what-if simulations. Handles Open Finance connections and CSV uploads.
*   `B2BConnect.jsx`: Interface for B2B partners to connect, test API keys, and run underwriting simulations.
*   `PartnersAdmin.jsx`: Administrative dashboard for managing partner configurations, underwriting rules, and webhooks.
*   `DevelopersPortal.jsx`: Documentation and tools for developers integrating with the FlowUp API.

### 2. Backend Services (`/functions/`)
We have recently consolidated various utility scripts into modular services:

*   **`b2bService.ts`**: Handles all B2B partner logic, including API key validation, underwriting process execution, and sending results via webhooks.
*   **`systemUtils.ts`**: Consolidates system-level utilities such as secure vault storage, data sanitization, and audit logging.
*   **`loanLogicV2.ts` / `insightEngine.ts`**: The core engines for analyzing user financial data, calculating eligibility, and generating AI-driven insights.
*   **`openFinanceAuth.ts`**: Manages the OAuth flow and secure connection tokens for Open Finance bank integrations.
*   **`whatIfEngine.ts`**: Provides backend support for the "What-If" loan simulator, validating user scenarios against internal risk models.
*   **Foundational/Legacy Scripts**: Files like `fup_live.js` (frozen) and `loanlogic.ts` serve as foundational testing and legacy logic blocks. They run in the backend but are being isolated structurally to prevent unintended side effects on newer production services.

### 3. Core Protocol Components (`/src/components/protocol/`)
*   **`FiscalAgent.js`**: The bridge between raw transactions and the "Shadow Realm". Responsible for anonymizing data (vector transformations, hashing) before it leaves the local device.

### 4. Data Entities (Base44 DB)
The platform relies on several structured data entities, including:
*   `Transaction`: Standardized financial transaction records.
*   `FinancialSnapshot`: Aggregated metrics (balances, DTI, risk levels).
*   `B2BPartner` & `UnderwritingRule`: Partner configurations and rule sets.
*   `ShadowRealmEntry`: Obfuscated financial data entries for secure processing.
*   `OpenFinanceConnection`, `OpenFinanceAccount`, `OpenFinanceToken`: Manage external banking data links.

## Data Flow Example: Underwriting Analysis
1.  **Ingestion:** User connects bank via `OpenFinanceConnect` or uploads CSV.
2.  **Local Processing:** `FiscalAgent` categorizes and optionally anonymizes the data. Local metrics (DTI, cash flow) are calculated immediately.
3.  **Edge Analysis:** Sanitized data is sent to `loanLogicV2.ts` / `insightEngine.ts` via the `useLoanMetrics` hook for deep analysis and AI insights.
4.  **B2B Webhook:** If initiated by a partner, `b2bService.ts` triggers a webhook containing the final underwriting decision.