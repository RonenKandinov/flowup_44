import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/**
 * Displays the AI-generated credit justification for a single rescue strategy.
 * Shows a loader until the LLM responds — no technical fallback text.
 */
export default function CreditJustificationBlock({ strategy, analysisInsights, originalStatus, policyThreshold }) {
    const [aiText, setAiText] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);
    const cancelledRef = useRef(false);

    useEffect(() => {
        cancelledRef.current = false;
        setAiText(null);
        setIsLoading(true);
        setError(false);

        (async () => {
            try {
                const res = await base44.functions.invoke('generateCreditJustification', {
                    strategy,
                    analysisInsights: analysisInsights || null,
                    originalStatus: originalStatus || null,
                    policyThreshold: policyThreshold || null
                });
                if (cancelledRef.current) return;
                if (res.data?.success && res.data.justification) {
                    setAiText(res.data.justification);
                } else {
                    setError(true);
                }
            } catch (e) {
                if (!cancelledRef.current) setError(true);
            } finally {
                if (!cancelledRef.current) setIsLoading(false);
            }
        })();

        return () => { cancelledRef.current = true; };
    }, [strategy, analysisInsights, originalStatus, policyThreshold]);

    return (
        <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-2 leading-4">
            <div className="flex items-center gap-1.5 mb-1">
                <span className="text-slate-300 font-medium">נימוק אשראי</span>
                {isLoading && <Loader2 className="w-2.5 h-2.5 text-cyan-400 animate-spin" />}
            </div>
            {isLoading ? (
                <div className="space-y-1.5 animate-pulse">
                    <div className="h-2 bg-slate-800 rounded w-full" />
                    <div className="h-2 bg-slate-800 rounded w-[90%]" />
                    <div className="h-2 bg-slate-800 rounded w-[70%]" />
                </div>
            ) : error ? (
                <div className="text-slate-500 italic">נימוק האשראי אינו זמין כרגע.</div>
            ) : (
                <div className="text-slate-300 leading-5 transition-opacity duration-300">{aiText}</div>
            )}
        </div>
    );
}