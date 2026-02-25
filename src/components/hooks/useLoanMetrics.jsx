import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export const useLoanMetrics = () => {
    const [metrics, setMetrics] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchMetrics = useCallback(async (force = false) => {
        setIsLoading(true);
        setError(null);

        try {
            // 1. Session Caching Strategy (V3 Key for pilot schema)
            const cachedData = sessionStorage.getItem('loanMetricsCacheV3');
            if (!force && cachedData) {
                setMetrics(JSON.parse(cachedData));
                setIsLoading(false);
                return;
            }

            // 2. Native Fetch Implementation (via SDK Wrapper for Environment Routing)
            // Note: Using SDK to ensure correct routing within the Base44 environment
            // effectively acting as a fetch wrapper to the Edge Function.
            const response = await base44.functions.invoke('loanLogicV2', { 
                userId: 'ronenk2424@gmail.com' 
            });
            
            const data = response.data;

            if (data.error) {
                throw new Error(data.error);
            }

            if (data.success) {
                // 3. Data Transformation Layer
                const calculatedDti = data.metrics.dti || (data.metrics.totalIncome > 0 
                    ? Math.round((data.metrics.fixedExpenses / data.metrics.totalIncome) * 100) 
                    : 0);
                
                // Use backend calculated score if available, otherwise fallback to survival rate
                const flowUpScore = data.metrics.score !== undefined ? data.metrics.score : data.survivalRate;

                const transformedMetrics = {
                    score: flowUpScore, 
                    trafficLight: data.status, // GREEN, ORANGE, RED
                    status: data.status,
                    dti: calculatedDti,
                    riskDay: data.riskDay,
                    totalIncome: data.metrics.totalIncome,
                    totalExpenses: data.metrics.totalExpenses || (data.metrics.fixedExpenses + data.metrics.lifestyleExpenses),
                    totalFixedExpenses: data.metrics.fixedExpenses,
                    totalLifestyleExpenses: data.metrics.lifestyleExpenses,
                    liquidAssets: data.metrics.liquidAssets || 0
                };

                setMetrics(transformedMetrics);
                sessionStorage.setItem('loanMetricsCacheV2', JSON.stringify(transformedMetrics));
            } else {
                throw new Error("Analysis failed to return success status");
            }
        } catch (err) {
            console.error("Failed to fetch loan metrics:", err);
            setError(err.message || "Unknown error");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMetrics();
    }, [fetchMetrics]);

    return {
        metrics,
        isLoading,
        error,
        refetch: () => fetchMetrics(true)
    };
};