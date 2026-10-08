# FlowUp — Behavioral Credit Decision Engine

> Open Banking decision-support platform that transforms transaction data into behavioral credit insights and alternative financing recommendations.

## What it does

FlowUp adds a behavioral decision layer on top of existing credit underwriting.

It:

- Processes and normalizes Open Banking transaction data
- Detects income, expenses, liquidity, cash-flow patterns and recurring activity
- Generates behavioral and financial risk signals
- Combines them in a centralized Decision Engine
- Uses **Deal Rescuer** to find alternative loan structures for borderline or declined applications
- Generates explainable AI insights for analysts

## Architecture
<img width="815" height="525" alt="image" src="https://github.com/user-attachments/assets/7a8fe61d-91eb-4984-928f-57fa5f44a450" />
 **External Systems** — External sources and partners that provide financial data or consume FlowUp decisions.

- **Open Banking APIs** — Provide transaction, account balance, income and expense data.

- **B2B Partners** — External lenders or financial platforms that integrate with FlowUp and consume its decision outputs.

- **Client Layer** — The analyst-facing application used to review financial data, risk indicators and recommendations.

- **Dashboard & Analyst Interface** — Displays customer financial insights, risk metrics and FlowUp recommendations.

- **Local Risk Calculations** — Performs client-side calculations such as DTI, DSR and cash-flow metrics.

- **FiscalAgent** — Transforms and obfuscates sensitive financial data before it is processed by other components.

- **Integration Layer** — Handles communication with external financial providers and B2B systems.

- **Open Finance Auth (OAuth)** — Manages authentication and consent for accessing financial data.

- **Financial Data Ingestion** — Retrieves, normalizes and prepares transaction data for the decision engine.

- **Data Layer** — Stores and organizes the financial data used throughout the decision process.

- **Transaction Data** — Raw transaction-level financial data received from Open Banking providers.

- **Financial Snapshots** — Aggregated financial metrics such as income, expenses, liquidity and cash-flow indicators.

- **Secure / Obfuscated Data** — Protected representations of sensitive financial information.

- **Decision Engine** — The core of FlowUp, responsible for coordinating financial analysis, behavioral intelligence and risk constraints.

- **Decision Orchestrator** — Coordinates the decision flow and combines outputs from the different decision components.

- **LoanLogic** — Performs the core underwriting calculations, including DTI, DSR and repayment-capacity analysis.

- **Behavioral Intelligence** — Analyzes financial behavior over time to identify patterns, trends, anomalies and potential false negatives.

- **Policy & Risk Engine** — Applies lender policies, risk boundaries and exposure constraints to the decision.

- **Deal Rescuer** — Searches and ranks alternative financing structures when the original request does not fit the relevant constraints.

- **B2B Integration Service** — Exposes decision outputs to external systems through APIs and webhooks.


Results

For a subset of evaluated cases, FlowUp found alternative financing structures that were better aligned with the customer's observed financial behavior than the original loan request.

The engine combines behavioral signals, DSR, risk, liquidity, profitability and constraint-based optimization to search and rank alternative loan structures rather than relying on a simple approve/reject rule.

From: static credit decision
To: behavior-based, constraint-aware financing recommendation

Tech Stack

Frontend

React
Vite
Tailwind CSS
Shadcn UI
Base44

Backend

Supabase

APIs & Integrations

REST APIs
OAuth
Open Banking
Open Finance

AI

LLM integration
Structured AI outputs
AI-based classification
AI-generated financial insights
Project

Built end-to-end from problem definition and system design through implementation, product iteration and validation.

The platform was evaluated on financial processing, behavioral analysis, decisioning and alternative financing scenarios.
