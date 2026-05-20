import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Repeat, Loader2, AlertTriangle, ShieldCheck, Eye } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const STATUS_STYLE = {
    active:    'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    suspended: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    cancelled: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
    expired:   'border-slate-500/40 bg-slate-500/10 text-slate-400'
};
const STATUS_LABEL = {
    active: 'פעילה', suspended: 'מושעית', cancelled: 'בוטלה', expired: 'פגה'
};

const fmt = (n) => Number(n || 0).toLocaleString('he-IL');

export default function DirectDebitsTab() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [data, setData] = useState({ authorizations: [], source: null });

    useEffect(() => {
        (async () => {
            try {
                const res = await base44.functions.invoke('listDirectDebits', {});
                if (!res?.data?.success) {
                    setError(res?.data?.error || 'לא ניתן לטעון הרשאות');
                } else {
                    setData({
                        authorizations: res.data.authorizations || [],
                        source: res.data.source
                    });
                }
            } catch (e) {
                setError(e.message);
            }
            setLoading(false);
        })();
    }, []);

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                    <Repeat className="w-5 h-5 text-cyan-300" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">הרשאות לחיוב חשבון</h2>
                    <p className="text-slate-500 text-xs">צפייה בלבד · נתונים מהבנק דרך Open Finance</p>
                </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                <Eye className="w-3.5 h-3.5 text-cyan-300" />
                <span>FlowUp מציגה את ההרשאות הקיימות בחשבון. אין יזום, ביטול או שינוי תשלומים מתוך המערכת.</span>
            </div>

            {loading && (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> טוען הרשאות מהבנק...
                </div>
            )}

            {error && (
                <div className="flex items-center gap-2 text-rose-300 text-sm bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
                    <AlertTriangle className="w-4 h-4" /> {error}
                </div>
            )}

            {!loading && !error && data.authorizations.length === 0 && (
                <div className="text-center py-12 bg-slate-900/60 border border-slate-800 rounded-xl">
                    <ShieldCheck className="w-10 h-10 mx-auto text-slate-600 mb-3" />
                    <p className="text-slate-400 text-sm">לא נמצאו הרשאות לחיוב חשבון בנתונים הזמינים.</p>
                    <p className="text-slate-600 text-xs mt-1">
                        ודא שהחשבון מחובר ל-Open Finance ויש לפחות 6 חודשים של תנועות.
                    </p>
                </div>
            )}

            {!loading && data.authorizations.length > 0 && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs">
                        <span className="text-slate-400">סה״כ {data.authorizations.length} הרשאות</span>
                        <span className="text-slate-600">
                            מקור: {data.source === 'open_finance_sync' ? 'סנכרון Open Finance' : 'זיהוי מתנועות'}
                        </span>
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-slate-500 text-xs">
                                <th className="text-right px-4 py-3 font-medium">מוטב</th>
                                <th className="text-right px-4 py-3 font-medium">סכום ממוצע</th>
                                <th className="text-right px-4 py-3 font-medium">תדירות</th>
                                <th className="text-right px-4 py-3 font-medium">סטטוס</th>
                                <th className="text-right px-4 py-3 font-medium">חיוב אחרון</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.authorizations.map((a, i) => (
                                <tr key={i} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                                    <td className="px-4 py-3 text-white">{a.beneficiary_name}</td>
                                    <td className="px-4 py-3 text-slate-300">
                                        ₪{fmt(a.amount_limit)}
                                    </td>
                                    <td className="px-4 py-3 text-slate-400 text-xs">
                                        {a.frequency || '—'}
                                        {a.charge_count_6m && (
                                            <span className="text-slate-600"> · {a.charge_count_6m} ב-6ח׳</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_STYLE[a.status] || STATUS_STYLE.active}`}>
                                            {STATUS_LABEL[a.status] || a.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 text-xs">
                                        {a.last_seen_at ? new Date(a.last_seen_at).toLocaleDateString('he-IL') : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </motion.div>
    );
}