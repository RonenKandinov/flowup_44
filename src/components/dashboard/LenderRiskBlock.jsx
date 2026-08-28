import React from 'react';
import { Shield, TrendingDown, AlertOctagon, Briefcase, Gem, Sparkles } from 'lucide-react';

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
    const leverageOpportunities = Array.isArray(assessment.leverage_opportunities) ? assessment.leverage_opportunities : [];
    const collateralAssets = Array.isArray(assessment.collateral_assets) ? assessment.collateral_assets : [];

    // Color logic: higher numbers = redder. Tuned for consumer-loan ranges.
    const pdColor = pd === null ? 'text-slate-300' : pd >= 15 ? 'text-red-400' : pd >= 7 ? 'text-amber-400' : 'text-emerald-400';
    const elColor = el === null ? 'text-slate-300' : el >= 8 ? 'text-red-400' : el >= 3 ? 'text-amber-400' : 'text-emerald-400';

    return (
        <div className="bg-gradient-to-br from-purple-950/30 to-slate-900/40 p-4 rounded-lg border border-purple-500/20">
            <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-purple-400" />
                <p className="text-sm text-purple-300 uppercase font-bold tracking-wider">סיכון למלווה (תיק)</p>
            </div>

            {/* PD / LGD / EL trio — the underwriter's break-even calculus */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-slate-900/60 p-3 rounded border border-slate-700/40">
                    <div className="flex items-center gap-1 mb-1">
                        <AlertOctagon className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs text-slate-400 uppercase">סיכוי לכשל</span>
                    </div>
                    <p className={`text-2xl font-bold font-mono ${pdColor}`}>{pd !== null ? `${pd}%` : '—'}</p>
                </div>
                <div className="bg-slate-900/60 p-3 rounded border border-slate-700/40">
                    <div className="flex items-center gap-1 mb-1">
                        <TrendingDown className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs text-slate-400 uppercase">הפסד אם יכשל</span>
                    </div>
                    <p className="text-2xl font-bold font-mono text-slate-200">{lgd !== null ? `${lgd}%` : '—'}</p>
                </div>
                <div className="bg-slate-900/60 p-3 rounded border border-slate-700/40">
                    <div className="flex items-center gap-1 mb-1">
                        <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs text-slate-400 uppercase">הפסד צפוי</span>
                    </div>
                    <p className={`text-2xl font-bold font-mono ${elColor}`}>{el !== null ? `${el}%` : '—'}</p>
                </div>
            </div>

            {/* Portfolio-level narrative */}
            {portfolioView && (
                <p className="text-base text-slate-200 leading-relaxed mb-3">{portfolioView}</p>
            )}

            {/* Leverage opportunities — how to grow profitably, not just avoid loss */}
            {leverageOpportunities.length > 0 && (
                <div className="mt-3 pt-3 border-t border-emerald-500/10">
                    <p className="text-sm text-emerald-300/90 uppercase font-bold mb-2 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" /> איך למנף את הלקוח
                    </p>
                    <ul className="space-y-1.5">
                        {leverageOpportunities.slice(0, 4).map((item, i) => (
                            <li key={i} className="text-sm text-emerald-100/90 leading-relaxed flex items-start gap-2">
                                <span className="text-emerald-400 mt-0.5">•</span>
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Collateral assets — pledgeable sources found in 12m history */}
            {collateralAssets.length > 0 && (
                <div className="mt-3 pt-3 border-t border-cyan-500/10">
                    <p className="text-sm text-cyan-300/90 uppercase font-bold mb-2 flex items-center gap-1.5">
                        <Gem className="w-4 h-4" /> נכסים לבחינת שיעבוד
                    </p>
                    <ul className="space-y-1.5">
                        {collateralAssets.slice(0, 4).map((item, i) => (
                            <li key={i} className="text-sm text-cyan-100/90 leading-relaxed flex items-start gap-2">
                                <span className="text-cyan-400 mt-0.5">•</span>
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Mitigations — what the lender can do to make this work */}
            {mitigations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-purple-500/10">
                    <p className="text-sm text-purple-300/80 uppercase font-bold mb-2">דרכים להפחית סיכון</p>
                    <ul className="space-y-1.5">
                        {mitigations.slice(0, 4).map((m, i) => (
                            <li key={i} className="text-sm text-slate-200 leading-relaxed flex items-start gap-2">
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