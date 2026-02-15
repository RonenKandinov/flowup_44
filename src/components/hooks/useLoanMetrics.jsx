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
            // Calling loanlogic with the specific userId as requested
            const response = await base44.functions.invoke('loanlogic', { 
                userId: 'ronenk2424@gmail.com' 
            });
            
            const data = response.data;
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            if (data.success && data.metrics) {
                setMetrics(data.metrics);
            } else {
                // Handle case where metrics might be missing or structure is different
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