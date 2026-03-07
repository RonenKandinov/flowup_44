import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export const useLoanMetrics = (userId, targetAccountId = null) => {
    const [metrics, setMetrics] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchMetrics = useCallback(async () => {
        // אנחנו לא מאפסים את ה-metrics ל-null כדי למנוע "קפיצה" ל-0 במסך
        setIsLoading(true); 
        setError(null);

        try {
            const response = await base44.functions.invoke('loanLogicV2', {
                userId: userId || "ronenk2424@gmail.com",
                targetAccountId
            });
            
            const data = response.data;
            if (data?.success) {
                const report = data.report || {};
                const rawMetrics = data.metrics || {};

                // בניית האובייקט הסופי - תואם ב-100% ללוגיקת השרת (ציון 54)
                const transformed = {
                    score: report.score ?? rawMetrics.score ?? 0,
                    status: report.status || rawMetrics.trafficLight || "GRAY",
                    trafficLight: report.status || rawMetrics.trafficLight || "GRAY",
                    dti: report.metrics?.dti ?? rawMetrics.dti ?? 0,
                    totalIncome: report.metrics?.monthlyAverageIncome ?? rawMetrics.totalIncome ?? 0,
                    totalExpenses: report.metrics?.monthlyAverageExpenses ?? rawMetrics.totalExpenses ?? 0,
                    totalFixedExpenses: rawMetrics.fixedExpenses ?? 0,
                    totalLifestyleExpenses: rawMetrics.lifestyleExpenses ?? 0,
                    liquidAssets: report.metrics?.liquidAssets ?? rawMetrics.liquidAssets ?? 0,
                    liquidAssetsBreakdown: report.metrics?.liquidAssetsBreakdown ?? rawMetrics.liquidAssetsBreakdown ?? { cash: 0, etf: 0, trainingFund: 0 },
                    confidence: report.decision?.confidence || "Standard",
                    recommendation: report.decision?.recommendation || "N/A",
                    stressTestPassed: report.stressTest?.passedCount ?? 0,
                    forceRedReason: report.decision?.forceRedReason,
                    history: report.metrics?.history || [],
                    trends: report.metrics?.trends || rawMetrics.trends,
                    availableAccounts: data.availableAccounts || [],
                    activeTargetAccountId: data.activeTargetAccountId
                };

                setMetrics(transformed);
            } else {
                throw new Error(data?.error || "Analysis failed to return success status");
            }
        } catch (err) {
            console.error("Failed to fetch metrics:", err);
            const status = err.response?.status;
            if (status === 401 || status === 405 || status === 500 || status === 503) {
                setError(null);
            } else {
                setError(err.message || "Unknown error");
            }
        } finally {
            setIsLoading(false);
        }
    }, [userId, targetAccountId]);

    useEffect(() => {
        fetchMetrics();
    }, [fetchMetrics]);

    return { metrics, isLoading, error, refetch: fetchMetrics };
};