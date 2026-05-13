import React from 'react';
import { motion } from 'framer-motion';

/**
 * Generic stat/KPI card used inside every B2B Suite tab.
 * Kept intentionally small — visual primitive only, no business logic.
 */
export default function ModuleCard({ icon: Icon, label, value, hint, accent = 'cyan', delay = 0 }) {
    const accentMap = {
        cyan: 'border-cyan-500/30 text-cyan-300',
        emerald: 'border-emerald-500/30 text-emerald-300',
        amber: 'border-amber-500/30 text-amber-300',
        rose: 'border-rose-500/30 text-rose-300',
        violet: 'border-violet-500/30 text-violet-300',
        blue: 'border-blue-500/30 text-blue-300'
    };
    const ring = accentMap[accent] || accentMap.cyan;

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className={`rounded-xl border ${ring} bg-slate-900/50 backdrop-blur-sm p-4`}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-400">{label}</span>
                {Icon && <Icon className="w-4 h-4 opacity-60" />}
            </div>
            <div className="text-xl font-bold text-white">{value}</div>
            {hint && <div className="text-[11px] text-slate-500 mt-1">{hint}</div>}
        </motion.div>
    );
}