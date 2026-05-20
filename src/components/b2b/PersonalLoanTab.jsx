import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';

const STATUS_STYLE = {
    approved: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    review:   'border-amber-500/40 bg-amber-500/10 text-amber-200',
    adjusted: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200',
    rejected: 'border-rose-500/40 bg-rose-500/10 text-rose-200'
};
const STATUS_LABEL = { approved: 'אושר', review: 'דורש בדיקה', adjusted: 'אושר בהתאמה', rejected: 'נדחה' };

const PURPOSES = [
    { id: 'consumer',           label: 'הלוואה צרכנית כללית' },
    { id: 'debt_consolidation', label: 'איחוד הלוואות' },
    { id: 'auto',               label: 'רכישת רכב' },
    { id: 'mortgage',           label: 'משכנתה / שיפוץ' }
];

const fmt = (n) => Number(n || 0).toLocaleString('he-IL');

export default function PersonalLoanTab() {
    const [amount, setAmount] = useState('');
    const [term, setTerm] = useState('36');
    const [purpose, setPurpose] = useState('consumer');
    const [decision, setDecision] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const submit = async () => {
        setError(''); setDecision(null);
        if (!amount) { setError('יש להזין סכום מבוקש.'); return; }
        setLoading(true);

        const res = await base44.functions.invoke('orchestrationEngine', {
            product: 'personal_loan',
            context: {
                requested_amount: Number(amount),
                term_months: Number(term),
                purpose
            },
            options: { enableFallback: false, persist: true }
        });
        setLoading(false);

        if (!res?.data?.success) {
            setError(res?.data?.error || 'שגיאת ניתוח');
            return;
        }
        setDecision(res.data.decision);
    };

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                    <User className="w-5 h-5 text-cyan-300" />
                </div>
                <h2 className="text-xl font-bold text-white">הלוואה פרטית</h2>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="grid md:grid-cols-3 gap-3">
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">סכום מבוקש ₪</label>
                        <Input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="bg-slate-950 border-slate-800 text-white"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">תקופה (חודשים)</label>
                        <Input
                            type="number"
                            value={term}
                            onChange={(e) => setTerm(e.target.value)}
                            className="bg-slate-950 border-slate-800 text-white"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">מטרה</label>
                        <Select value={purpose} onValueChange={setPurpose}>
                            <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PURPOSES.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <Button
                    onClick={submit}
                    disabled={loading}
                    className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold h-11"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'הרץ חיתום צרכני'}
                </Button>

                {error && (
                    <div className="flex items-center gap-2 text-rose-300 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5" /> {error}
                    </div>
                )}
            </div>

            {decision && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl border p-5 ${STATUS_STYLE[decision.status]}`}
                >
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-bold text-lg">{STATUS_LABEL[decision.status]}</span>
                        {decision.rate != null && decision.rate > 0 && (
                            <span className="text-xs opacity-70 mr-2">· ריבית: {decision.rate}%</span>
                        )}
                        {decision.max_amount != null && (
                            <span className="text-xs opacity-70">· סכום מאושר: ₪{fmt(decision.max_amount)}</span>
                        )}
                    </div>
                    <p className="text-sm leading-relaxed mb-3">{decision.reason}</p>
                    {decision.product_specific && Object.keys(decision.product_specific).length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            {Object.entries(decision.product_specific)
                                .filter(([, v]) => v != null && v !== '')
                                .map(([k, v]) => (
                                    <div key={k} className="bg-slate-950/50 border border-white/10 rounded p-2">
                                        <div className="opacity-60">{k.replace(/_/g, ' ')}</div>
                                        <div className="text-white font-semibold mt-0.5">
                                            {typeof v === 'number' ? v.toLocaleString('he-IL') : String(v)}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </motion.div>
            )}
        </motion.div>
    );
}