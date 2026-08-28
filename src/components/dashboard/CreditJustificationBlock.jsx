import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Displays the AI-generated credit justification for a single rescue strategy.
 * Receives the text (or loading/error state) from the parent, which fetches all
 * justifications in a single parallel batch for minimal latency.
 */
export default function CreditJustificationBlock({ aiText, isLoading, error }) {
    return (
        <div className="text-sm text-slate-400 border-t border-slate-800 pt-3">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-slate-200 font-bold text-sm">נימוק אשראי</span>
                {isLoading && <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />}
            </div>
            {isLoading ? (
                <div className="space-y-2 animate-pulse">
                    <div className="h-3 bg-slate-800 rounded w-full" />
                    <div className="h-3 bg-slate-800 rounded w-[90%]" />
                    <div className="h-3 bg-slate-800 rounded w-[70%]" />
                </div>
            ) : error ? (
                <div className="text-slate-500 italic">נימוק האשראי אינו זמין כרגע.</div>
            ) : (
                <div className="text-slate-200 text-[13px] leading-relaxed transition-opacity duration-300">{aiText}</div>
            )}
        </div>
    );
}