import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Banknote, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';

const PRODUCTS = [
    { id: 'reverse_factoring',       label: 'מימון ספקים / פקטורינג הפוך' },
    { id: 'revenue_based_financing', label: 'הלוואת תזרים מבוססת הכנסות (RBF)' },
    { id: 'purchase_order_financing',label: 'מימון רכש / יבוא (PO)' },
    { id: 'working_capital',         label: 'הון חוזר / הלוואת גישור' },
    { id: 'merchant_cash_advance',   label: 'מימון סליקה (MCA)' }
];

const PRODUCT_HINT = {
    reverse_factoring: 'נתח את הקונה הגדול (יציבות תאגידית + יכולת לעמוד בהחזר מרוכז לספקים).',
    revenue_based_financing: 'נתח MRR, צמיחה חודשית ו-Burn Rate. ההחזר כאחוז מהכנסות עתידיות.',
    purchase_order_financing: 'נתח היסטוריית תשלומים מהקונה (PO) ויכולת תפעולית מול ספקי חו"ל.',
    working_capital: 'נתח DSR, חריגות ממסגרת ונורות אדומות. הלוואה לטווח קצר.',
    merchant_cash_advance: 'נתח זיכויי סליקה חודשיים מישראכרט/כאל/מקס. החזר ממכירות.'
};

const STATUS_STYLE = {
    approved: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    review:   'border-amber-500/40 bg-amber-500/10 text-amber-200',
    adjusted: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200',
    rejected: 'border-rose-500/40 bg-rose-500/10 text-rose-200'
};
const STATUS_LABEL = { approved: 'אושר', review: 'דורש בדיקה', adjusted: 'אושר בהתאמה', rejected: 'נדחה' };

export default function B2BFinancingTab() {
    const [product, setProduct] = useState('working_capital');
    const [amount, setAmount] = useState('');
    const [contextField, setContextField] = useState('');
    const [decision, setDecision] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const contextLabel = {
        reverse_factoring: 'ח.פ של הקונה הגדול',
        revenue_based_financing: 'MRR יעד (אופציונלי)',
        purchase_order_financing: 'שם הקונה (לפי PO)',
        working_capital: '',
        merchant_cash_advance: 'שם חברת הסליקה (אופציונלי)'
    }[product];

    const contextKey = {
        reverse_factoring: 'buyer_tax_id',
        revenue_based_financing: 'mrr_target',
        purchase_order_financing: 'buyer_name',
        working_capital: '',
        merchant_cash_advance: 'acquirer'
    }[product];

    const submit = async () => {
        setError(''); setDecision(null);
        if (!amount) { setError('יש להזין סכום מבוקש.'); return; }
        setLoading(true);
        const ctx = contextKey ? { [contextKey]: contextField } : {};
        const res = await base44.functions.invoke('b2bFinancingAnalyze', {
            product_type: product,
            requested_amount: Number(amount),
            context: ctx
        });
        setLoading(false);

        if (!res?.data?.success) {
            setError(res?.data?.error || 'שגיאת ניתוח');
            return;
        }
        setDecision(res.data.decision);

        await base44.entities.B2BFinancingRequest.create({
            business_id: 'self',
            product_type: product,
            requested_amount: Number(amount),
            context: ctx,
            status: res.data.decision.status,
            decision: res.data.decision
        }).catch(() => {});
    };

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                    <Banknote className="w-5 h-5 text-cyan-300" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">מימון עסקי חכם</h2>
                    <p className="text-slate-500 text-xs">חיתום אוטומטי ל-5 מוצרי מימון, מבוסס 12 חודשי Open Finance</p>
                </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="grid md:grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">סוג מוצר</label>
                        <Select value={product} onValueChange={(v) => { setProduct(v); setContextField(''); setDecision(null); }}>
                            <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PRODUCTS.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">סכום מבוקש ₪</label>
                        <Input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="bg-slate-950 border-slate-800 text-white"
                        />
                    </div>
                    {contextLabel && (
                        <div className="md:col-span-2">
                            <label className="text-xs text-slate-400 mb-1 block">{contextLabel}</label>
                            <Input
                                value={contextField}
                                onChange={(e) => setContextField(e.target.value)}
                                className="bg-slate-950 border-slate-800 text-white"
                            />
                        </div>
                    )}
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">{PRODUCT_HINT[product]}</p>

                <Button
                    onClick={submit}
                    disabled={loading}
                    className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold h-11"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'הרץ חיתום'}
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
                        <span className="text-xs opacity-70 mr-2">· ריבית: {decision.rate}%</span>
                        <span className="text-xs opacity-70">· סכום מאושר: ₪{decision.max_amount.toLocaleString()}</span>
                    </div>
                    <p className="text-sm leading-relaxed mb-4">{decision.reason}</p>

                    {decision.product_specific && Object.keys(decision.product_specific).length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            {Object.entries(decision.product_specific).map(([k, v]) => (
                                <div key={k} className="bg-slate-950/50 border border-white/10 rounded p-2">
                                    <div className="opacity-60">{k.replace(/_/g, ' ')}</div>
                                    <div className="text-white font-semibold mt-0.5">
                                        {typeof v === 'number' ? v.toLocaleString() : String(v)}
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