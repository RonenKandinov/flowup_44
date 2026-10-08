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
<img width="1774" height="887" alt="תרשים ארכיטקטורת מערכת FlowUp" src="https://github.com/user-attachments/assets/6aa3e98c-5d79-4bfe-98bb-6eed9d1e710d" />

Financial Intelligence
FlowUp transforms raw Open Banking data into a structured financial state, combining transaction history, income, expenses, cash flow, liquidity, recurring activity, existing obligations, trends, and financial risk signals.
This financial state becomes the foundation for behavioral analysis and credit decisioning.
Behavioral Credit Intelligence
FlowUp evaluates how a customer's financial behavior evolves over time rather than relying only on point-in-time attributes.
The behavioral layer captures patterns such as income stability, expense behavior, liquidity resilience, volatility, and other signals that provide additional context for the credit decision.
Decision Engine
The Decision Engine combines financial and behavioral intelligence with underwriting, risk, policy, and economic constraints.
Rather than producing only an APPROVE / REJECT outcome, it evaluates whether the requested financing structure is viable and determines when an alternative structure may provide a better outcome.
Deal Rescuer
Deal Rescuer is FlowUp's financing optimization engine.
When the requested structure does not satisfy the relevant constraints, it searches across alternative combinations of amount, term, rate, down payment, and financing strategy, evaluates the resulting candidates, and ranks viable financing structures.
The engine supports different restructuring approaches, including cash-flow alignment, exposure reduction, and behavioral-based approval.
Decision Flow
Open Banking Data
        ↓
Financial Intelligence
        ↓
Behavioral Intelligence
        ↓
Decision Engine
        ↓
Policy & Risk Evaluation
        ↓
Scenario Search
        ↓
Financing Recommendation

Engineering
FlowUp combines deterministic financial logic, behavioral analysis, constraint-based decisioning, scenario generation, and AI-assisted financial interpretation.
Key engineering areas include:
- Open Banking data processing and normalization
- Financial and behavioral signal extraction
- Credit, risk, liquidity, and affordability analysis
- Constraint-based financing search and optimization
- Candidate evaluation and ranking
- Structured AI outputs and explainable insights
AI Layer
AI is used as an intelligence layer alongside the deterministic decision engine.
It supports financial classification, behavioral interpretation, and generation of structured financial insights, while core calculations, constraints, and scenario evaluation remain controlled by explicit system logic.
Continuous Decisioning
FlowUp is designed to extend beyond point-in-time underwriting by allowing financial behavior to become an ongoing source of decision intelligence.
Initial Decision
       ↓
Financial Monitoring
       ↓
Behavioral Change
       ↓
Risk / Opportunity Detection
       ↓
Updated Decision

This creates a path toward dynamic exposure management, restructuring, and additional financing decisions.
Technology
Frontend: React · Vite · Tailwind CSS · shadcn/ui · Recharts
Backend & Data: Supabase · REST APIs · OAuth
Integrations: Open Banking / Open Finance
Intelligence: Financial analytics · Behavioral scoring · Constraint-based decisioning · Scenario optimization · LLM-powered insights
System Design
FlowUp is built around five principles:
Behavior over snapshots — financial behavior over time provides context beyond static attributes.
Decision over scoring — the system focuses on actionable financing decisions, not only risk scores.
Structure over rejection — a financing request that fails in its original form may still be viable under a different structure.
Deterministic core, AI-assisted intelligence — critical financial logic remains system-controlled while AI supports interpretation and insight generation.
Modular decisioning — financial analysis, behavioral intelligence, risk, policy, and optimization remain separated components.
Core Concept
Traditional underwriting:
Customer Data
      ↓
Credit Score
      ↓
Approve / Reject

FlowUp:
Customer Data
      ↓
Financial State
      ↓
Behavioral State
      ↓
Risk & Policy Evaluation
      ↓
Decision
      ↓
Constraint Search
      ↓
Financing Optimization
      ↓
Best-Fit Structure

From Credit Decisioning to Financing Decision Intelligence
FlowUp shifts the question from:
Should we approve this deal?

to:
Given the customer's financial behavior and the relevant constraints, what is the best financing decision we can make?
