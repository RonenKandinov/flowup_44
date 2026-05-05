import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Scale, Info } from 'lucide-react';

/**
 * DealEVPanel — replaces the XAI factors panel in the DealRescuer card.
 *
 * Shows the credit officer the bottom-line answer to:
 *   "Is this deal worth it for US (the lender)?"
 *
 * Surfaces the engine's Expected Value math in plain language:
 *   Expected Value = (1 − PD) × TotalInterest − PD × Principal × LGD
 *
 * Three categorical states (per CTO direction — no raw ₪ figures):
 *   • profit_strong   → margin ≥ 5%
 *   • profit_normal   → 2% ≤ margin < 5%
 *   • profit_marginal → 0 ≤ margin < 2%
 *   • profit_negative → margin < 0  (expected loss)
 */
const formatILS = (n) => `₪${Math.abs(Math.round(Number(n || 0))).toLocaleString('he-IL')}`;

const classifyMargin = (margin) => {
    if (!Number.isFinite(margin)) return null;
    if (margin >= 0.05) return 'strong';
    if (margin >= 0.02) return 'normal';
    if (margin >= 0)    return 'marginal';
    return 'negative';
};

const META = {
    strong: {
        label: 'עסקה רווחית מאוד',
        sub: 'התמחור מכסה את הסיכון בנדיבות',
        accent: 'text-emerald-300',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        Icon: TrendingUp,
        iconBg: 'bg-emerald-500/20',
        verdict: 'רווח'
    },
    normal: {
        label: 'עסקה רווחית',
        sub: 'התמחור מאוזן מול הסיכון',
        accent: 'text-cyan-300',
        bg: 'bg-cyan-500/10',
        border: 'border-cyan-500/30',
        Icon: Scale,
        iconBg: 'bg-cyan-500/20',
        verdict: 'רווח'
    },
    marginal: {
        label: 'רווחיות גבולית',
        sub: 'מרווח הרווח מתחת לסף המדיניות',
        accent: 'text-amber-300',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        Icon: Scale,
        iconBg: 'bg-amber-500/20',
        verdict: 'גבולי'
    },
    negative: {
        label: 'הפסד צפוי',
        sub: 'התמחור לא מכסה את ההפסד הצפוי',
        accent: 'text-red-300',
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        Icon: TrendingDown,
        iconBg: 'bg-red-500/20',
        verdict: 'הפסד'
    }
};

export default function DealEVPanel({ expectedValue, profitMargin, totalRevenue, expectedLoss, pd }) {
    const category = classifyMargin(profitMargin);
    if (!category) return null;
    const meta = META[category];
    const Icon = meta.Icon;
    const isProfit = expectedValue >= 0;
    const marginPct = Number.isFinite(profitMargin) ? (profitMargin * 100).toFixed(1) : '—';
    const pdPct = Number.isFinite(pd) ? (pd * 100).toFixed(1) : null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-lg border ${meta.border} ${meta.bg} p-3`}
        >
            <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg ${meta.iconBg} flex items-center justify-center`}>
                        <Icon className={`w-3.5 h-3.5 ${meta.accent}`} />
                    </div>
                    <div>
                        <div className={`text-xs font-bold ${meta.accent}`}>{meta.label}</div>
                        <div className="text-[10px] text-slate-400">{meta.sub}</div>
                    </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${meta.border} ${meta.accent} font-semibold`}>
                    {meta.verdict}
                </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="bg-slate-900/40 rounded-md p-2">
                    <div className="text-slate-500 text-[10px] mb-0.5 flex items-center gap-1">
                        רווח/הפסד צפוי
                    </div>
                    <div className={`font-bold ${isProfit ? 'text-emerald-300' : 'text-red-300'}`}>
                        {isProfit ? '+' : '−'}{formatILS(expectedValue)}
                    </div>
                </div>
                <div className="bg-slate-900/40 rounded-md p-2">
                    <div className="text-slate-500 text-[10px] mb-0.5">מרווח רווח</div>
                    <div className={`font-bold ${meta.accent}`}>{marginPct}%</div>
                </div>
                <div className="bg-slate-900/40 rounded-md p-2">
                    <div className="text-slate-500 text-[10px] mb-0.5">הסתברות חדלות</div>
                    <div className="font-bold text-slate-200">{pdPct !== null ? `${pdPct}%` : '—'}</div>
                </div>
            </div>

            {(Number.isFinite(totalRevenue) || Number.isFinite(expectedLoss)) && (
                <div className="mt-2 pt-2 border-t border-slate-700/40 flex items-center gap-1.5 text-[10px] text-slate-400">
                    <Info className="w-3 h-3" />
                    <span>
                        הכנסה צפויה {formatILS(totalRevenue)} · הפסד צפוי {formatILS(expectedLoss)}
                    </span>
                </div>
            )}
        </motion.div>
    );
}