# FlowUp - System Architecture & File Tree

This document outlines the current architecture of the FlowUp platform, serving as a reference for both development and maintenance.

## High-Level Architecture Diagram

```mermaid
graph TD
    subgraph Frontend ["Frontend (Client Device)"]
        UI["React Dashboard & UI"]
        LocalLogic["Local Calculators (DTI, Cashflow)"]
        FiscalAgent["FiscalAgent (Shadow Realm Crypto)"]
    end

    subgraph EdgeBackend ["Base44 Edge Backend"]
        OFAuth["openFinanceAuth (OAuth)"]
        LoanLogic["loanLogicV2 & insightEngine"]
        WhatIf["whatIfEngine"]
        B2BService["b2bService"]
    end

    subgraph Database ["Base44 Database"]
        DB_Entities[("Entities (Transaction, FinancialSnapshot, ShadowRealmEntry)")]
    end

    subgraph External ["External Services"]
        Banks["Open Finance APIs (Banks)"]
        B2B_Partners["B2B Partner Webhooks"]
    end

    UI --> LocalLogic
    UI --> FiscalAgent
    UI --> OFAuth
    
    FiscalAgent --> LoanLogic
    LocalLogic --> WhatIf
    
    LoanLogic --> DB_Entities
    OFAuth --> Banks
    LoanLogic --> B2BService
    B2BService --> B2B_Partners
```

## Directory Structure

```text
FlowUp Platform
├── src/                                  [Frontend - React/Vite]
│   ├── api/                              
│   │   └── base44Client.js               (Base44 SDK Initialization)
│   ├── components/
│   │   ├── config/                       (Providers config)
│   │   ├── dashboard/                    (Dashboard widgets)
│   │   ├── docs/                         (Documentation & Architecture)
│   │   ├── protocol/                     (Core logic bridging Local and Edge)
│   │   │   └── core/
│   │   │       └── fiscalAgent.js        (Sanitizes data into Shadow Realm)
│   │   └── ui/                           (Shared UI components - Shadcn)
│   ├── hooks/                            (Custom React hooks)
│   ├── lib/                              (App context, query client)
│   ├── pages/                            (Main Application Views)
│   └── App.jsx                           (App Router)
│
├── functions/                            [Backend - Base44 Edge Functions]
│   ├── b2bService.ts                     (Partner logic, Webhooks)
│   ├── insightEngine.ts                  (AI insights)
│   ├── loanLogicV2.ts                    (Underwriting calculations)
│   ├── openFinanceAuth.ts                (Bank OAuth)
│   └── whatIfEngine.ts                   (Loan simulation)
│
└── entities/                             [Database - Base44 Entities]
    ├── Transaction.json                  (Raw transaction data)
    ├── FinancialSnapshot.json            (Aggregated metrics)
    ├── ShadowRealmEntry.json             (Obfuscated data)
    └── B2BPartner.json                   (Partner credentials)
``