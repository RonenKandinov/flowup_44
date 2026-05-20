// Shared B2B Suite header — pulls ground-truth account metrics from loanLogicV2.
// Respects the currently selected bank account (URL ?accountId).
//
// Why this matters: every B2B product (check discount, working capital, factoring,
// MCA, personal/business loans through Deal Rescuer) shares the same underlying
// financial reality of the account. Showing it once at the top means each tab
// doesn't have to re-fetch or re-derive it.

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, TrendingUp, TrendingDown, Wallet, Activity, Gauge } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useSelectedAccount } from '@/components/hooks/useSelectedAccount';

const fmt = (n) => Math.round(Number(n || 0)).toLocaleString('he-IL');

const STATUS_COLORS = {
    GREEN:  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300' },
    ORANGE: { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-300' },
    RED:    { bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    text: 'text-rose-300' }
};

const STATUS_LABEL = { GREEN: 'ירוק — אישור', ORANGE: 'כתום — בדיקה', RED: 'אדום — סיכון' };

function Stat({ icon: Icon, label, value, accent = 'text-white' }) {
    return (
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 flex items-center gap-2">
            <Icon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <div className="min-w-0">
                <div className="text-[10px] text-slate-500 leading-tight">{label}</div>
                <div className={`text-sm font-bold leading-tight ${accent}`}>{value}</div>
            </div>
        </div>
    );
}

export default function LoanLogicSummary() {
    const { accountId } = useSelectedAccount();

    const { data, isLoading, error } = useQuery({
        queryKey: ['b2b-loanlogic', accountId || 'all'],
        queryFn: async () => {
            const res = await base44.functions.invoke('loanLogicV2', {
                targetAccountId: accountId || null
            });
            return res?.data || null;
        },
        staleTime: 60_000,
        refetchOnWindowFocus: false
    });

    if (isLoading) {
        return (
            <div className="mb-4 flex items-center gap-2 text-slate-400 text-xs">
                <Loader2 className="w-3 h-3 animate-spin" /> טוען מטריקות חשבון...
            </div>
        );
    }
    if (error || !data?.success || !data?.metrics) return null;

    const m = data.metrics;
    const status = m.status || 'ORANGE';
    const sc = STATUS_COLORS[status] || STATUS_COLORS.ORANGE;

    return (
        <div className={`mb-4 md:mb-6 rounded-xl border ${sc.border} ${sc.bg} p-3 md:p-4`}>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <Activity className={`w-4 h-4 ${sc.text}`} />
                    <span className="text-xs font-bold text-white">סטטוס חשבון — מנוע חיתום</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                    <span className={`px-2 py-0.5 rounded-full border ${sc.border} ${sc.text} font-semibold`}>
                        {STATUS_LABEL[status] || status}
                    </span>
                    <span className="text-slate-400">
                        ציון: <span className="text-white font-bold">{m.score ?? '—'}</span>/100
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <Stat icon={TrendingUp}   label="הכנסה ממוצעת" value={`₪${fmt(m.totalIncome)}`}     accent="text-emerald-300" />
                <Stat icon={TrendingDown} label="הוצאה ממוצעת" value={`₪${fmt(m.totalExpenses)}`}   accent="text-rose-300" />
                <Stat icon={Wallet}       label="נכסים נזילים" value={`₪${fmt(m.liquidAssets)}`}    accent="text-cyan-300" />
                <Stat icon={Gauge}        label="DTI"          value={`${m.dti ?? 0}%`} />
                <Stat icon={Activity}     label="חודשי הישרדות" value={`${m.runway ?? 0}`} />
            </div>
        </div>
    );
}