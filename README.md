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
