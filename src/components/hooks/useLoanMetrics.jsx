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
            // Calling underwriting engine
            const response = await base44.functions.invoke('underwriting', { 
                userId: 'ronenk2424@gmail.com' 
            });
            
            const data = response.data;
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            if (data.success) {
                setMetrics({
                    trafficLight: data.status,
                    status: data.status,
                    score: data.survivalRate, // 0-100 Score
                    dti: data.metrics.dti, // Actual DTI
                    riskDay: data.riskDay,
                    totalIncome: data.metrics.totalIncome,
                    totalExpenses: data.metrics.fixedExpenses + data.metrics.lifestyleExpenses,
                    totalFixedExpenses: data.metrics.fixedExpenses,
                    totalLifestyleExpenses: data.metrics.lifestyleExpenses
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