import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Displays the AI-generated credit justification for a single rescue strategy.
 * Receives the text (or loading/error state) from the parent, which fetches all
 * justifications in a single parallel batch for minimal latency.
 */
export default function CreditJustificationBlock({ aiText, isLoading, error }) {
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