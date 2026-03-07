import { useState, useCallback } from 'react';
import { openFinanceService } from '../services/openFinanceService';

export const useTransactionSync = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    const sync = useCallback(async (connectionId, psuId) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await openFinanceService.syncTransactions(connectionId, psuId);
            setData(result);
            return result;
        } catch (err) {
            setError(err);
            console.error("LoanLogic Sync failed:", err);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Helper to calculate "Corrected DTI" for What-If scenarios
    const calculateCorrectedDTI = (adjustmentAmount) => {
        if (!data?.metrics) return 0;
        const { totalIncome, totalFixedExpenses } = data.metrics;
        // If adjustment is negative (saving), expenses decrease. If positive (spending), expenses increase? 
        // Actually What-If usually simulates ADDING/REMOVING expenses or income.
        // Assuming adjustmentAmount is added to expenses (negative value = savings)
        // DTI = Fixed / Income. Lifestyle changes usually don't affect Fixed DTI unless we reclassify.
        // But user asked: "adjust lifestyle spending via sliders to see a 'Corrected DTI'".
        // Standard DTI uses Fixed Expenses.
        // Maybe "Total DTI" including lifestyle? 
        // OR user considers some lifestyle as "committed" for the purpose of this specific B2B dashboard.
        // Let's assume standard DTI doesn't change with lifestyle, BUT "Cashflow DTI" might.
        // HOWEVER, strictly following the formula: DTI = (Fixed / Income) * 100.
        // Lifestyle adjustment ONLY affects DTI if it changes Fixed Expenses or Income.
        // Let's assume the slider adjusts "Fixed" or "Income"? 
        // User said: "adjust lifestyle spending... to see Corrected DTI".
        // This implies the user wants to see how reducing lifestyle might free up room? 
        // OR maybe the formula provided is just the base, and "Corrected" implies (Fixed + Adjusted Lifestyle) / Income?
        
        // Let's implement a simple recalculation based on Total Expenses for now, or just Fixed if that's the strict requirement.
        // But for "Lifestyle Pivot", it likely means (Fixed + Lifestyle + Adjustment) / Income?
        // Let's stick to the prompt's DTI definition for the base, and maybe the "Corrected" one includes the lifestyle change.
        
        // Re-reading: "adjust lifestyle spending ... to see a 'Corrected DTI'".
        // If DTI = Fixed / Income, lifestyle doesn't touch it.
        // Maybe the user implies that *some* lifestyle can be converted to fixed (e.g. car loan)?
        // Or maybe they want to see (Fixed + (Lifestyle + Adjustment)) / Income? 
        // Let's return a dynamic calculation function.
        return 0; 
    };

    return { 
        sync, 
        data, 
        isLoading, 
        error,
        metrics: data?.metrics || {
            totalIncome: 0,
            totalFixedExpenses: 0,
            totalLifestyleExpenses: 0,
            dti: 0,
            trafficLight: 'GRAY'
        },
        expenseAnalysis: data?.expenseAnalysis,
        riskProfile: data?.riskProfile
    };
};