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


Components
- External Systems — Open Banking providers and external financial systems supplying financial data.
- Client Layer — Analyst-facing interface for reviewing financial state, decisions, risk signals, and recommendations.
- Integration Layer — Handles authentication, data ingestion, normalization, and communication with external services.
- Data Layer — Stores financial data, derived metrics, decision state, and system outputs.
- Decision Engine — Central decisioning layer coordinating financial, behavioral, risk, and policy signals.
- Decision Orchestrator — Controls the decision flow and coordinates the underlying decision components.
- LoanLogic — Core financial and credit analysis layer responsible for transforming raw financial activity into decision-ready metrics.
- Behavioral Intelligence — Extracts behavioral patterns, stability indicators, risk signals, and financial context from transaction history.
- Policy & Risk Engine — Applies lending policies, risk constraints, affordability limits, and decision boundaries.
- Deal Rescuer — Searches the financing space for alternative structures when the requested deal does not fit.
- B2B Integration Service — Provides structured decision outputs for integration with external lending and financial systems.
Financial Intelligence
FlowUp transforms raw Open Banking transactions into a structured representation of the customer's financial state.
The analysis covers:
- Income and expense behavior
- Cash-flow dynamics
- Liquidity
- Recurring financial activity
- Existing obligations
- Financial stability
- Volatility
- Trends and behavioral changes
- Data quality and confidence
- Risk indicators
The resulting financial state becomes the foundation for downstream credit decisioning.
Behavioral Credit Intelligence
Traditional underwriting often relies heavily on static attributes and point-in-time information.
FlowUp introduces a behavioral layer that evaluates how the customer's finances behave over time.
The system combines multiple behavioral signals to assess:
- Income stability
- Expense patterns
- Cash-flow consistency
- Liquidity resilience
- Financial volatility
- Behavioral risk
- Data confidence
- Positive and negative financial signals
This creates a richer representation of the borrower than a static credit score alone.
Decision Engine
The Decision Engine combines the financial and behavioral state with lending constraints to evaluate a financing request.
It considers factors such as:
- Affordability
- Existing exposure
- DSR
- Liquidity
- Behavioral risk
- Risk signals
- Policy constraints
- Expected loss
- Expected value
- Financing economics
The output is not limited to a binary decision.
It can determine whether the requested structure is viable and whether another structure can produce a better outcome.
Deal Rescuer
Deal Rescuer is the financing optimization layer of FlowUp.
When the requested financing structure does not fit the decision constraints, Deal Rescuer searches alternative structures across the financing space.
The search can vary:
- Loan amount
- Repayment term
- Interest rate
- Down payment
- Financing strategy
Candidate structures are evaluated against financial, behavioral, risk, liquidity, policy, and economic constraints.
Strategy Lanes
Deal Rescuer can evaluate different restructuring strategies, including:
Cash-Flow Alignment
Reduce repayment pressure by adapting the financing structure to the customer's cash-flow capacity.
Exposure Reduction
Reduce lender exposure through changes to principal and upfront contribution.
Behavioral-Based Approval
Use the customer's observed financial behavior to identify structures that remain viable despite the original request failing standard constraints.
The result is a ranked set of financing candidates rather than a single binary outcome.
Decision Flow
┌──────────────────────┐
│   Open Banking Data  │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Financial Intelligence│
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Behavioral Intelligence│
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│    Decision Engine   │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│  Policy & Risk Layer │
└──────────┬───────────┘
           ↓
     ┌─────┴─────┐
     ↓           ↓
  Accept      Restructure
                  ↓
          ┌───────────────┐
          │ Deal Rescuer  │
          └───────┬───────┘
                  ↓
        Alternative Structures
                  ↓
           Recommendation

Engineering
- Open Banking data ingestion and normalization
- Transaction validation and enrichment
- Income and expense classification
- Recurring activity detection
- Self-transfer detection
- Financial aggregation and trend analysis
- Behavioral signal extraction
- Financial stability and volatility analysis
- Liquidity analysis
- Data confidence assessment
- DSR-based credit analysis
- Risk and expected-value evaluation
- Policy-aware decisioning
- Financing scenario generation
- Constraint-based search
- Candidate scoring and ranking
- Alternative financing optimization
- Structured AI outputs
- Explainable financial insights
AI Layer
AI is used as a supporting intelligence layer rather than as the sole decision maker.
FlowUp uses structured AI capabilities for tasks such as:
- Financial classification
- Behavioral interpretation
- Financial insight generation
- Decision explanations
Core financial calculations, constraints, scenario evaluation, and decision logic remain deterministic and system-controlled.
Continuous Decisioning
FlowUp can extend the decision process beyond the initial financing application.
Application
     ↓
Initial Decision
     ↓
Financial Monitoring
     ↓
Behavioral Change
     ↓
Risk / Opportunity Detection
     ↓
Updated Decision

This enables a transition from point-in-time underwriting toward continuous financial decisioning.
Potential applications include:
- Dynamic credit exposure
- Early risk detection
- Financing restructuring
- Additional financing opportunities
- Portfolio-level behavioral monitoring
Technology
Frontend
- React
- Vite
- Tailwind CSS
- shadcn/ui
- Recharts
Backend & Data
- Supabase
- REST APIs
- OAuth
- Open Banking / Open Finance integrations
Intelligence
- Financial analytics
- Behavioral scoring
- Constraint-based decisioning
- Scenario optimization
- LLM-powered structured insights
System Characteristics
Behavior over Snapshots
Financial behavior over time provides context that static attributes cannot capture alone.
Decision over Scoring
The objective is not only to produce a risk score, but to determine what decision can be made under the relevant constraints.
Structure over Rejection
A failed financing request does not necessarily mean the customer is unfinanceable.
Deterministic Core, AI-Assisted Intelligence
Critical financial calculations and decision constraints remain controlled by explicit system logic, while AI augments classification and interpretation.
Modular Decisioning
Financial analysis, behavioral intelligence, policy evaluation, and financing optimization are separated into distinct components that can evolve independently.
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
"Should we approve this deal?"

to:
"Given this customer's financial behavior and our constraints, what is the best financing decision we can make?"
