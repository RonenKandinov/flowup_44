import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export const useLoanMetrics = () => {
    const [metrics, setMetrics] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchMetrics = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Calling loanLogicV2 with the specific userId as requested
            // Note: Switched to V2 for Monte Carlo & Shadow Vector support
            const response = await base44.functions.invoke('loanLogicV2', { 
                userId: 'ronenk2424@gmail.com' 
            });
            
            const data = response.data;
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Map V2 response to expected metrics format for UI
            if (data.success && data.riskProfile) {
                setMetrics({
                    // Map new risk data to UI props
                    trafficLight: data.riskProfile.riskStatus,
                    status: data.riskProfile.riskStatus,
                    dti: data.simulation.survivalProbability, // Using survival rate as proxy for score in UI
                    riskDay: data.riskProfile.riskDay,
                    confidence: data.riskProfile.confidence,
                    totalIncome: 0, // V2 calculates risk directly, income hidden for privacy
                    totalExpenses: 0
                });
            } else {
                setMetrics(data); 
            }
        } catch (err) {
            console.error("Failed to fetch loan metrics:", err);
            setError(err.message || "Unknown error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
    }, []);

    return {
        metrics,
        isLoading,
        error,
        refetch: fetchMetrics
    };
};