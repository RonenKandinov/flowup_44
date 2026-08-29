import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

// Short-lived cache so switching back to a recently-viewed customer is instant.
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

const cacheKey = (userId, targetAccountId) => `loanMetricsCache_${userId}_${targetAccountId || 'all'}`;

const readCache = (key) => {
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.timestamp || Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
        return parsed.data || null;
    } catch (_) {
        return null;
    }
};

const writeCache = (key, data) => {
    try {
        sessionStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
    } catch (_) { /* no-op */ }
};

export const useLoanMetrics = (userId, targetAccountId = null) => {
    const [metrics, setMetrics] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    // True when Open Finance has NO accounts/transactions for this customer
    // (consent expired or was never completed) — a distinct, recoverable state.
    const [noData, setNoData] = useState(false);

    const fetchMetrics = useCallback(async (force = false) => {
        if (!userId) {
            setMetrics(null);
            setIsLoading(false);
            setError(null);
            return;
        }

        const key = cacheKey(userId, targetAccountId);

        if (force) {
            try { sessionStorage.removeItem(key); } catch (_) {}
        } else {
            // Fast path: recently-viewed customer within the TTL window — skip the network call entirely.
            const cached = readCache(key);
            if (cached) {
                setMetrics(cached);
                setIsLoading(false);
                setError(null);
                setNoData(false);
                return;
            }
        }

        setIsLoading(true);
        setError(null);
        setNoData(false);

        try {
            // Native Fetch Implementation (via SDK Wrapper for Environment Routing)
            // Note: Using SDK to ensure correct routing within the Base44 environment
            // effectively acting as a fetch wrapper to the Edge Function.
            const response = await base44.functions.invoke('loanLogicV2', {
                userId,
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
                    // Undeclared Income Discrepancy — surfaces "strong-on-paper-weak" customers
                    // whose real consistent inflow exceeds declared income (FlowUp differentiator).
                    undeclaredIncomeAnalysis: data.undeclaredIncomeAnalysis || metrics.undeclaredIncomeAnalysis || null,
                    // Forensic Intelligence — side-income, activity decline, early distress,
                    // declaration-vs-reality gaps. Signals BDI / credit reports can't see.
                    forensicIntelligence: data.forensicIntelligence || metrics.forensicIntelligence || null,
                    // Positive + advanced factual signals — power the PositiveSignalsPanel
                    positiveSignals: data.positiveSignals || metrics.positiveSignals || null,
                    advancedSignals: data.advancedSignals || metrics.advancedSignals || null,
                    userId
                };

                setMetrics(transformedMetrics);
                writeCache(key, transformedMetrics);
            } else {
                throw new Error("Analysis failed to return success status");
            }
        } catch (err) {
            const status = err.response?.status;
            const serverMsg = err.response?.data?.error || err.message || '';
            if (String(serverMsg).includes('No valid transactions')) {
                // Open Finance returned zero data for this PSU — consent likely expired.
                setNoData(true);
                setError(null);
            } else if (status === 401 || status === 405 || status === 500 || status === 503) {
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
        noData,
        refetch: () => fetchMetrics(true)
    };
};