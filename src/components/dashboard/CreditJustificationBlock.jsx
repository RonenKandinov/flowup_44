import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { buildCreditJustification } from './creditJustification';

/**
 * Displays the credit justification for a single rescue strategy.
 * - Shows the technical justification IMMEDIATELY (no waiting).
 * - In parallel, calls the LLM to generate a human-friendly version.
 * - When the LLM responds, smoothly swaps the text.
 */
export default function CreditJustificationBlock({ strategy, analysisInsights, originalStatus }) {
    const fallback = React.useMemo(
        () => buildCreditJustification(strategy, analysisInsights),
        [strategy, analysisInsights]
    );

    const [aiText, setAiText] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const cancelledRef = useRef(false);

    useEffect(() => {
        cancelledRef.current = false;
        setAiText(null);
        setIsLoading(true);

        (async () => {
            try {
                const res = await base44.functions.invoke('generateCreditJustification', {
                    strategy,
                    analysisInsights: analysisInsights || null,
                    originalStatus: originalStatus || null
                });
                if (cancelledRef.current) return;
                if (res.data?.success && res.data.justification) {
                    setAiText(res.data.justification);
                }
            } catch (e) {
                // Silent fail — fallback text stays visible
                console.warn('AI justification unavailable, using technical fallback');
            } finally {
                if (!cancelledRef.current) setIsLoading(false);
            }
        })();

        return () => { cancelledRef.current = true; };
    }, [strategy, analysisInsights, originalStatus]);

    const text = aiText || fallback.paragraph;

    return (
        <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-2 leading-4">
            <div className="flex items-center gap-1.5 mb-1">
                <span className="text-slate-300 font-medium">נימוק אשראי</span>
                {isLoading && !aiText && (
                    <Loader2 className="w-2.5 h-2.5 text-cyan-400 animate-spin" />
                )}
            </div>
            <div className="text-slate-300 leading-5 transition-opacity duration-300">{text}</div>
        </div>
    );
}