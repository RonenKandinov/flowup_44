import React from 'react';
import { CheckCircle2, AlertCircle, TrendingUp, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * XAIFactorsPanel
 * ----------------
 * Surfaces the factors that drove the underwriting decision in a compact,
 * scannable list. Bridges the gap between raw numerics (DSR, DTI) and the
 * human reasoning a credit officer needs to defend a borderline approval.
 *
 * Receives `xai_factors` from dealRescuerEngine response — { positive: [], negative: [] }
 */
export default function XAIFactorsPanel({ factors }) {
    if (!factors || (!factors.positive?.length && !factors.negative?.length)) return null;

    // Defensive: some upstream sources (e.g. raw cashFlowIntelligence anchors/flags)
    // pass items with only {key} and no {label}. Synthesize a readable label from the
    // key so the panel never renders empty rows.
    const humanize = (key) => String(key || '').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

    // Hide internal profitability/risk-vs-reward factors from the UI per CTO direction —
    // these remain in the engine output for pricing logic but are not surfaced to the analyst.
    const HIDDEN_LABELS = ['סיכון גבוה ביחס לרווח', 'תמחור מול סיכון', 'רווחיות נמוכה'];
    const HIDDEN_KEYS = ['low_profit_margin', 'risk_vs_reward', 'thin_margin', 'profitability_risk'];

    const normalize = (arr) => (arr || [])
        .map(f => ({ ...f, label: f.label || humanize(f.key) }))
        .filter(f => f.label)
        .filter(f => !HIDDEN_KEYS.includes(f.key) && !HIDDEN_LABELS.includes(f.label));

    const positives = normalize(factors.positive);
    const negatives = normalize(factors.negative);

    if (!positives.length && !negatives.length) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-lg border border-slate-700/50 bg-slate-900/50 p-3"
        >
            <div className="flex items-center gap-1.5 mb-2.5">
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[11px] font-semibold text-cyan-300 uppercase tracking-wide">
                    גורמים שהשפיעו על ההחלטה
                </span>
            </div>

            {positives.length > 0 && (
                <div className="mb-3">
                    <div className="text-[10px] font-medium text-emerald-400 mb-1.5 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        חוזקות ({positives.length})
                    </div>
                    <ul className="space-y-1">
                        {positives.map((f, i) => (
                            <li key={`pos-${i}`} className="flex items-start gap-2 text-[11px] leading-4">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                    <div className="text-emerald-200 font-medium">{f.label}</div>
                                    {f.detail && <div className="text-slate-400 text-[10px]">{f.detail}</div>}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {negatives.length > 0 && (
                <div>
                    <div className="text-[10px] font-medium text-amber-400 mb-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        סיכונים ({negatives.length})
                    </div>
                    <ul className="space-y-1">
                        {negatives.map((f, i) => (
                            <li key={`neg-${i}`} className="flex items-start gap-2 text-[11px] leading-4">
                                <AlertCircle className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                    <div className="text-amber-200 font-medium">{f.label}</div>
                                    {f.detail && <div className="text-slate-400 text-[10px]">{f.detail}</div>}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </motion.div>
    );
}