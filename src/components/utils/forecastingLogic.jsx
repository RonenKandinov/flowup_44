/**
 * FlowUp What-If Simulation Helpers (Client-Side)
 * -----------------------------------------------
 * NOTE: The full CSV-based forecasting engine was removed when the system
 * migrated to Open Finance as the single source of truth. Only the
 * lightweight What-If simulator (UI-only) and version metadata remain.
 */

export const calculateWhatIf = (baselineForecast, scenario) => {
    // Basic What-If implementation preserving baseline
    if (!baselineForecast || !baselineForecast.success) return baselineForecast;
    if (!scenario || scenario.type === 'reset') return { ...baselineForecast, whatIfApplied: false };

    const currentBalance = baselineForecast.currentBalance || 0;
    let simulatedIncome = 0;
    let simulatedExpense = 0;

    switch (scenario.type) {
        case 'expense': simulatedExpense = scenario.amount || 0; break;
        case 'income': simulatedIncome = scenario.amount || 0; break;
    }

    const adjustedBalance = currentBalance + simulatedIncome - simulatedExpense;
    const adjustedEOM = (baselineForecast.projectedEOM || 0) + simulatedIncome - simulatedExpense;

    const adjustedGraphPoints = (baselineForecast.graphPoints || []).map(p => ({
        ...p,
        balance: Math.round(p.balance + simulatedIncome - simulatedExpense)
    }));

    return {
        ...baselineForecast,
        currentBalance: Math.round(adjustedBalance),
        projectedEOM: Math.round(adjustedEOM),
        graphPoints: adjustedGraphPoints,
        whatIfApplied: true
    };
};

export const SystemInfo = {
    version: "3.0.0",
    type: "Open Finance Native",
    engine: "Server-side loanLogicV2",
    privacy: "Bank-grade encryption at rest"
};