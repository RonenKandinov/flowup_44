import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ScanLine, Loader2, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import CheckScanner from './CheckScanner';

const STATUS_STYLE = {
    approved: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    review:   'border-amber-500/40 bg-amber-500/10 text-amber-200',
    adjusted: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200',
    rejected: 'border-rose-500/40 bg-rose-500/10 text-rose-200'
};
const STATUS_LABEL = {
    approved: 'אושר',
    review:   'דורש בדיקה',
    adjusted: 'אושר בהתאמה',
    rejected: 'נדחה'
};

export default function CheckDiscountTab() {
    const [form, setForm] = useState({
        third_party_tax_id: '',
        third_party_name: '',
        amount: '',
        due_date: '',
        check_number: '',
        check_image_url: ''
    });
    const [confidence, setConfidence] = useState(null);
    const [decision, setDecision] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleExtracted = (data) => {
        setConfidence(data.confidence);
        setForm(f => ({
            ...f,
            third_party_tax_id: data.third_party_tax_id || f.third_party_tax_id,
            third_party_name: data.third_party_name || f.third_party_name,
            amount: data.amount || f.amount,
            due_date: data.due_date || f.due_date,
            check_number: data.check_number || f.check_number,
            check_image_url: data.check_image_url || f.check_image_url
        }));
    };

    const submit = async () => {
        setError('');
        if (!form.amount || !form.due_date) {
            setError('יש להזין סכום ותאריך פירעון.');
            return;
        }
        setSubmitting(true);
        const res = await base44.functions.invoke('checkDiscountAnalyze', {
            amount: Number(form.amount),
            third_party_tax_id: form.third_party_tax_id,
            third_party_name: form.third_party_name,
            due_date: form.due_date
        });
        setSubmitting(false);

        if (!res?.data?.success) {
            setError(res?.data?.error || 'שגיאת ניתוח');
            return;
        }
        setDecision(res.data.decision);

        // Persist the request
        await base44.entities.CheckDiscountRequest.create({
            requesting_business_id: 'self',
            check_image_url: form.check_image_url,
            third_party_tax_id: form.third_party_tax_id,
            third_party_name: form.third_party_name,
            amount: Number(form.amount),
            due_date: form.due_date,
            check_number: form.check_number,
            ocr_confidence: confidence,
            third_party_history: res.data.decision.third_party_history,
            status: res.data.decision.status,
            decision_reason: res.data.decision.reason,
            discount_rate: res.data.decision.discount_rate
        }).catch(() => {});
    };

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                    <ScanLine className="w-5 h-5 text-cyan-300" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">ניכיון צ׳קים</h2>
                    <p className="text-slate-500 text-xs">סרוק צ׳ק → ניתוח צד ג׳ + חוסן העסק → החלטה בזמן אמת</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-5">
                <CheckScanner onExtracted={handleExtracted} />

                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
                    <h3 className="text-white font-semibold mb-1">פרטי הצ׳ק</h3>
                    {confidence !== null && confidence < 0.85 && (
                        <div className="flex items-center gap-2 text-amber-300 text-xs bg-amber-500/10 border border-amber-500/30 rounded p-2">
                            <Info className="w-3.5 h-3.5" />
                            רמת ביטחון OCR: {Math.round(confidence * 100)}% — בדוק את הפרטים ידנית.
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            placeholder="ח.פ / ת.ז של צד ג׳"
                            value={form.third_party_tax_id}
                            onChange={(e) => setForm({ ...form, third_party_tax_id: e.target.value })}
                            className="bg-slate-950 border-slate-800 text-white"
                        />
                        <Input
                            placeholder="שם כותב הצ׳ק"
                            value={form.third_party_name}
                            onChange={(e) => setForm({ ...form, third_party_name: e.target.value })}
                            className="bg-slate-950 border-slate-800 text-white"
                        />
                        <Input
                            type="number"
                            placeholder="סכום ₪"
                            value={form.amount}
                            onChange={(e) => setForm({ ...form, amount: e.target.value })}
                            className="bg-slate-950 border-slate-800 text-white"
                        />
                        <Input
                            type="date"
                            value={form.due_date}
                            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                            className="bg-slate-950 border-slate-800 text-white"
                        />
                        <Input
                            placeholder="מספר צ׳ק"
                            value={form.check_number}
                            onChange={(e) => setForm({ ...form, check_number: e.target.value })}
                            className="bg-slate-950 border-slate-800 text-white col-span-2"
                        />
                    </div>

                    <Button
                        onClick={submit}
                        disabled={submitting}
                        className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold h-11"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'נתח בקשת ניכיון'}
                    </Button>

                    {error && (
                        <div className="flex items-center gap-2 text-rose-300 text-xs">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {error}
                        </div>
                    )}
                </div>
            </div>

            {decision && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl border p-5 ${STATUS_STYLE[decision.status]}`}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-bold">{STATUS_LABEL[decision.status]}</span>
                        <span className="text-xs opacity-70 mr-2">· עמלת ניכיון: {decision.discount_rate}%</span>
                    </div>
                    <p className="text-sm leading-relaxed mb-3">{decision.reason}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <Stat label="הפקדות עבר" value={decision.third_party_history.prior_deposits} />
                        <Stat label="ממוצע" value={`₪${decision.third_party_history.avg_prior_amount.toLocaleString()}`} />
                        <Stat label="חזרות צד ג׳" value={decision.third_party_history.third_party_bounces} />
                        <Stat label="חזרות בחשבון" value={decision.third_party_history.total_account_bounces} />
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
}

const Stat = ({ label, value }) => (
    <div className="bg-slate-950/50 border border-white/10 rounded p-2">
        <div className="opacity-60">{label}</div>
        <div className="text-white font-semibold mt-0.5">{value}</div>
    </div>
);