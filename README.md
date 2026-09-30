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

```text
Open Banking
     ↓
Data Ingestion & Processing
     ↓
Financial + Behavioral Analysis
     ↓
Decision Engine
     ↓
Deal Rescuer
     ↓
Explainable Recommendation
Key Engineering
Transaction validation & normalization
Self-transfer detection
Income / expense classification
Financial aggregation & trend analysis
MAD-based outlier detection
Behavioral scoring
DSR-based decisioning
Risk & profitability evaluation
Constraint-based loan optimization
Liquidity and risk adjustments
AI-generated financial insights
Deal Rescuer

Instead of treating a financing request as simply:

APPROVE / REJECT

Deal Rescuer searches for alternative financing structures.

It evaluates combinations of:

Loan amount
Repayment term
Interest rate
Down payment

while considering:

DSR
Financial behavior
Liquidity
Risk signals
Expected loss
Expected value
Policy constraints

Supported strategies include:

Cash-Flow Alignment — reduce repayment pressure while maintaining a viable loan amount
Exposure Reduction — reduce lender exposure
Behavioral-Based Approval — use observed financial behavior to support a structure closer to the original request
Behavioral Engine

The behavioral layer analyzes financial behavior over time instead of relying only on a static snapshot.

Signals include:

Income stability
Income trends
Expense behavior
Cash-flow stability
Liquidity
Recurring activity
Volatility
Data confidence
Risk flags

The engine uses calibrated behavioral adjustments, confidence and volatility factors, liquidity constraints, and risk-aware decision logic to influence financing decisions.

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
