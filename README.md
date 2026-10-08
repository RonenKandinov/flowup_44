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

FlowUp is organized around a centralized Decision Engine that connects financial data, behavioral intelligence, risk and policy evaluation, and financing optimization.
Components
Component	Role
External Systems	Open Banking providers and external financial systems
Client Layer	Analyst interface for financial analysis, risk indicators, and recommendations
Integration Layer	Authentication, data ingestion, normalization, and external communication
Data Layer	Transaction data, financial snapshots, and derived financial state
Decision Engine	Central coordination of financial, behavioral, risk, and policy signals
LoanLogic	Core underwriting and financial calculations
Behavioral Intelligence	Behavioral patterns, stability indicators, and risk signals
Policy & Risk Engine	Lending policies, risk constraints, affordability, and exposure limits
Deal Rescuer	Alternative financing structure search and optimization
B2B Integration Service	Decision APIs and partner integrations


Decisioning
FlowUp builds a structured financial representation from Open Banking data, including cash flow, income, expenses, liquidity, recurring activity, obligations, trends, and behavioral signals.
The Behavioral Intelligence layer evaluates how these characteristics evolve over time, providing additional context around stability, volatility, liquidity, and financial risk.
The Decision Engine then combines this state with underwriting, policy, risk, and economic constraints.
Financial State
       +
Behavioral State
       +
Risk & Policy Constraints
       ↓
Credit Decision

Deal Rescuer
Deal Rescuer extends the decision beyond a binary approval outcome.
When the requested financing structure does not satisfy the relevant constraints, it searches the financing space for alternative structures across:
- Amount
- Term
- Rate
- Down payment
- Financing strategy
Candidate structures are evaluated and ranked according to financial, behavioral, risk, liquidity, policy, and economic considerations.
The system supports multiple restructuring strategies, including Cash-Flow Alignment, Exposure Reduction, and Behavioral-Based Approval.
Requested Structure
        ↓
Constraint Evaluation
        ↓
 ┌──────┴──────┐
 ↓             ↓
Fits       Does Not Fit
              ↓
        Deal Rescuer
              ↓
     Alternative Structures
              ↓
       Ranked Candidates

Engineering
FlowUp combines deterministic financial logic, behavioral analysis, constraint-based decisioning, scenario optimization, and AI-assisted interpretation.
Key engineering areas include:
- Open Banking data processing and normalization
- Financial and behavioral signal extraction
- Credit, risk, liquidity, and affordability analysis
- Constraint-based scenario search
- Candidate evaluation and ranking
- Structured AI outputs and explainable insights
AI
AI acts as an intelligence layer alongside the deterministic decision engine.
It supports financial classification, behavioral interpretation, and structured financial insights.
Core financial calculations, constraints, scenario evaluation, and decision logic remain explicitly controlled by the system.
Continuous Decisioning
The same decision framework can extend beyond the initial financing event.
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
Frontend
React · Vite · Tailwind CSS · shadcn/ui · Recharts
Backend & Data
Supabase · REST APIs · OAuth
Integrations
Open Banking / Open Finance
Intelligence
Financial Analytics · Behavioral Scoring · Constraint-Based Decisioning · Scenario Optimization · LLM-Powered Insights
Design Principles
Behavior over snapshots
Financial behavior over time provides context beyond static attributes.
Decision over scoring
The goal is an actionable financing decision, not simply a risk score.
Structure over rejection
A financing request that fails in its original form may still be viable under a different structure.
Deterministic core, AI-assisted intelligence
Critical financial logic remains system-controlled while AI supports interpretation and insight generation.
Modular decisioning
Financial analysis, behavioral intelligence, risk, policy, and optimization remain separated components.
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

From "Should we approve this deal?" to "What is the best financing decision we can make given the customer's financial behavior and the relevant constraints?"
