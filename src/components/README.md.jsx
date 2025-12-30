# FlowUp Pro - System Architecture

## Overview
FlowUp Pro is a cash flow forecasting platform that uses a hybrid statistical model to predict end-of-month balances and identify financial risk zones.

## Forecasting Engine

### Hybrid Model Architecture
The system combines two statistical approaches:

**1. Simple Exponential Smoothing (SES) - 30% Weight**
- Captures recent spending trends
- Smoothing factor (α) = 0.3
- Responsive to immediate changes in behavior

**2. Seasonal Average - 70% Weight**
- Identifies recurring monthly patterns
- Uses historical data to predict cyclical expenses
- Accounts for predictable income/expense cycles

### Formula
```
Forecast = (0.3 × SES) + (0.7 × Seasonal Average)
```

## Safety Buffer Mechanism

### 17% Risk Buffer
Every forecast is multiplied by **0.83** to ensure conservative predictions:

```
Safe Balance = Projected Balance × 0.83
```

**Rationale:**
- Protects against unexpected expenses
- Accounts for forecast uncertainty
- Provides psychological comfort margin

## Data Flow

### Input Processing
1. **CSV Upload**: Israeli bank statement format
2. **Column Detection**: Auto-identifies date, amount, balance columns
3. **Transaction Parsing**: Extracts daily spending patterns

### Core Calculations
1. **Current Balance**: Last row, Column 8 ('יתרה לאחר פעולה')
2. **Daily Average Spending**: Total expenses / number of days
3. **Projected EOM Balance**: Current balance - (avg daily spending × days remaining)
4. **Safe Balance**: Projected balance × 0.83

### Risk Assessment
- **Green**: Safe balance > ₪1,000
- **Yellow**: Safe balance between ₪0-₪1,000
- **Red**: Safe balance < ₪0

## Technology Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **UI Library**: Tailwind CSS + shadcn/ui
- **Animations**: Framer Motion
- **Charts**: Recharts
- **State Management**: React Query

### Backend-as-a-Service
- **Platform**: Base44
- **Database**: Entities (Transaction, FinancialSnapshot)
- **Authentication**: Built-in user management

### Client-Side Processing
All forecasting logic runs in the browser for privacy and speed.

---

**Version**: 1.0 | **Engine**: Hybrid SARIMAX/SES | **Safety Buffer**: 17%