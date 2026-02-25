
JavaScript
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

// מפתח לשמירה מקומית כדי למנוע טעינות מיותרות
const CACHE_KEY = 'fup_metrics_cache';

export const useLoanMetrics = () => {
    const [metrics, setMetrics] = useState(() => {
        // ניסיון לטעון מה-Cache בטעינה ראשונית (Optimistic UI)
        const cached = sessionStorage.getItem(CACHE_KEY);
        return cached ? JSON.parse(cached) : null;
    });
    const [isLoading, setIsLoading] = useState(!metrics);
    const [error, setError] = useState(null);

    const fetchMetrics = useCallback(async (force = false) => {
        // אם יש דאטה ב-Cache וזו לא רענון כפוי, אל תמשוך שוב
        if (metrics && !force) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // קריאה לשם הפונקציה המדויק בשרת
            const response = await base44.functions.invoke('loanLogicV2', { 
                userId: 'ronenk2424@gmail.com' 
            });
            
            const { data } = response;
            
            if (data.error) throw new Error(data.error);
            
            if (data.success) {
                const formattedMetrics = {
                    status: data.status,
                    score: data.survivalRate,
                    dti: data.metrics.dti,
                    riskDay: data.riskDay,
                    totalIncome: data.metrics.totalIncome,
                    totalFixedExpenses: data.metrics.fixedExpenses,
                    totalLifestyleExpenses: data.metrics.lifestyleExpenses,
                    totalExpenses: data.metrics.fixedExpenses + data.metrics.lifestyleExpenses,
                    resilienceScore: data.analysis.resilienceScore
                };

                setMetrics(formattedMetrics);
                // שמירה ב-Cache ל-5 דקות הקרובות
                sessionStorage.setItem(CACHE_KEY, JSON.stringify(formattedMetrics));
            }
        } catch (err) {
            console.error("Architect Error - Fetching failed:", err);
            setError(err.message || "Unknown error");
        } finally {
            setIsLoading(false);
        }
    }, [metrics]);

    useEffect(() => {
        fetchMetrics();
    }, []); // הרצה פעם אחת בטעינה

    return {
        metrics,
        isLoading,
        error,
        refetch: () => fetchMetrics(true) // פונקציית רענון כפויה
    };
};