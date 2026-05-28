import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export const useLoanMetrics = (userId, targetAccountId = null) => {
    const [metrics, setMetrics] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchMetrics = useCallback(async (force = false) => {
        setIsLoading(true);
        setError(null);

        // Always use fresh backend metrics. FlowUp's B2B underwriting layer must reflect
        // the latest loanLogicV2 behavior immediately after backend updates.
        try {
            Object.keys(sessionStorage)
                .filter(k => k.startsWith('loanMetricsCache'))
                .forEach(k => sessionStorage.removeItem(k));
        } catch (_) {}

        try {
            // Native Fetch Implementation (via SDK Wrapper for Environment Routing)
            // Note: Using SDK to ensure correct routing within the Base44 environment
            // effectively acting as a fetch wrapper to the Edge Function.
            const response = await base44.functions.invoke('loanLogicV2', {
                userId: userId || "ronenk2424@gmail.com",
                targetAccountId
            });
            
            const data = response.data;

            if (data.error) {
                throw new Error(data.error);
            }

            if (data.success) {
                // 3. Data Transformation Layer
                const report = data.report || {};
                const metrics = data.metrics || {};

                // Use new report structure if available, fallback to legacy
                const flowUpScore = report.score !== undefined ? report.score : (metrics.score !== undefined ? metrics.score : data.survivalRate);
                const status = report.status || data.status;
                
                const transformedMetrics = {
                    score: flowUpScore, 
                    trafficLight: status, 
                    status: status,
                    dti: report.metrics?.dti ?? metrics.dti ?? 0,
                    riskDay: null, // Deprecated in V3
                    totalIncome: report.metrics?.monthlyAverageIncome ?? metrics.totalIncome ?? 0,
                    totalExpenses: report.metrics?.monthlyAverageExpenses ?? metrics.totalExpenses ?? 0,
                    totalFixedExpenses: metrics.fixedExpenses ?? 0,
                    totalLifestyleExpenses: metrics.lifestyleExpenses ?? 0,
                    liquidAssets: report.metrics?.liquidAssets ?? metrics.liquidAssets ?? 0,
                    liquidAssetsBreakdown: report.metrics?.liquidAssetsBreakdown ?? metrics.liquidAssetsBreakdown ?? { cash: 0, etf: 0, trainingFund: 0 },
                    
                    // New Pilot Fields
                    confidence: report.decision?.confidence || "Standard",
                    recommendation: report.decision?.recommendation || "N/A",
                    stressTestPassed: report.stressTest?.passedCount ?? 0,
                    forceRedReason: report.decision?.forceRedReason || metrics.forceRedReason,
                    narrative: report.narrative || null,
                    
                    // Trends from Backend
                    trends: report.metrics?.trends || metrics.trends || { income: 0, expenses: 0, dti: 0 },
                    history: report.metrics?.history || [],
                    availableAccounts: data.availableAccounts || [],
                    activeTargetAccountId: data.activeTargetAccountId || null,
                    // Behavioral story-level profile (top merchants, salary timing,
                    // spend windows within the month, overdraft touches, savings discipline)
                    // — used by InsightEngine to write a human narrative.
                    behaviorProfile: data.behaviorProfile || null,
                    userId: userId || "ronenk2424@gmail.com"
                };

                setMetrics(transformedMetrics);
            } else {
                throw new Error("Analysis failed to return success status");
            }
        } catch (err) {
            const status = err.response?.status;
            if (status === 401 || status === 405 || status === 500 || status === 503) {
                setError(null);
            } else {
                console.error("Failed to fetch loan metrics:", err);
                setError(err.message || "Unknown error");
            }
        } finally {
            setIsLoading(false);
        }
    }, [userId, targetAccountId]);

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