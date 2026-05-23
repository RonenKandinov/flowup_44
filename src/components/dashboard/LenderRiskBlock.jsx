import React from 'react';
import { Shield, TrendingDown, AlertOctagon, Briefcase } from 'lucide-react';

/**
 * LenderRiskBlock
 * Shows the deal from the LENDER'S perspective — not the borrower's.
 * Inspired by DealRescuer's risk-pricing methodology (PD × LGD = Expected Loss).
 *
 * Inputs come from llm_analysis.lender_risk_assessment, which is produced by
 * insightEngine's LLM and carries:
 *   - default_probability: probability borrower defaults (%)
 *   - loss_given_default:  % of principal lost if default occurs
 *   - expected_loss:       PD × LGD (%) — break-even pricing floor
 *   - portfolio_view:      one-sentence framing for portfolio managers
 *   - mitigations:         array of underwriting levers that move the deal to Approve
 */
export default function LenderRiskBlock({ assessment }) {
    if (!assessment) return null;

    const pd = assessment.default_probability ?? null;
    const lgd = assessment.loss_given_default ?? null;
    const el = assessment.expected_loss ?? null;
    const portfolioView = assessment.portfolio_view || '';
    const mitigations = Array.isArray(assessment.mitigations) ? assessment.mitigations : [];

    // Color logic: higher numbers = redder. Tuned for consumer-loan ranges.
    const pdColor = pd === null ? 'text-slate-300' : pd >= 15 ? 'text-red-400' : pd >= 7 ? 'text-amber-400' : 'text-emerald-400';
    const elColor = el === null ? 'text-slate-300' : el >= 8 ? 'text-red-400' : el >= 3 ? 'text-amber-400' : 'text-emerald-400';

    return (
        <div className="bg-gradient-to-br from-purple-950/30 to-slate-900/40 p-3 rounded-lg border border-purple-500/20">
            <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-purple-400" />
                <p className="text-[10px] text-purple-300 uppercase font-bold tracking-wider">סיכון למלווה (תיק)</p>
            </div>

            {/* PD / LGD / EL trio — the underwriter's break-even calculus */}
            <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-slate-900/60 p-2 rounded border border-slate-700/40">
                    <div className="flex items-center gap-1 mb-0.5">
                        <AlertOctagon className="w-3 h-3 text-slate-500" />
                        <span className="text-[9px] text-slate-500 uppercase">סיכוי לכשל</span>
                    </div>
                    <p className={`text-base font-bold font-mono ${pdColor}`}>{pd !== null ? `${pd}%` : '—'}</p>
                </div>
                <div className="bg-slate-900/60 p-2 rounded border border-slate-700/40">
                    <div className="flex items-center gap-1 mb-0.5">
                        <TrendingDown className="w-3 h-3 text-slate-500" />
                        <span className="text-[9px] text-slate-500 uppercase">הפסד אם יכשל</span>
                    </div>
                    <p className="text-base font-bold font-mono text-slate-200">{lgd !== null ? `${lgd}%` : '—'}</p>
                </div>
                <div className="bg-slate-900/60 p-2 rounded border border-slate-700/40">
                    <div className="flex items-center gap-1 mb-0.5">
                        <Briefcase className="w-3 h-3 text-slate-500" />
                        <span className="text-[9px] text-slate-500 uppercase">הפסד צפוי</span>
                    </div>
                    <p className={`text-base font-bold font-mono ${elColor}`}>{el !== null ? `${el}%` : '—'}</p>
                </div>
            </div>

            {/* Portfolio-level narrative */}
            {portfolioView && (
                <p className="text-xs text-slate-300 leading-relaxed mb-2">{portfolioView}</p>
            )}

            {/* Mitigations — what the lender can do to make this work */}
            {mitigations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-purple-500/10">
                    <p className="text-[10px] text-purple-300/70 uppercase font-bold mb-1">דרכים להפחית סיכון</p>
                    <ul className="space-y-0.5">
                        {mitigations.slice(0, 4).map((m, i) => (
                            <li key={i} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                                <span className="text-purple-400 mt-0.5">•</span>
                                <span>{m}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}