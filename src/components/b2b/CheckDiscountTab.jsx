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
        // Route through orchestrationEngine — it handles unified persistence to LoanApplication.
        const res = await base44.functions.invoke('orchestrationEngine', {
            product: 'check_discount',
            context: {
                amount: Number(form.amount),
                due_date: form.due_date,
                third_party_tax_id: form.third_party_tax_id,
                third_party_name: form.third_party_name,
                check_image_url: form.check_image_url,
                check_number: form.check_number,
                ocr_confidence: confidence
            },
            options: { enableFallback: false, persist: true }
        });
        setSubmitting(false);

        if (!res?.data?.success) {
            setError(res?.data?.error || 'שגיאת ניתוח');
            return;
        }
        setDecision(res.data.decision);
    };

    // Mobile flow: hide the details form until a scan/upload happened (or user taps "מילוי ידני").
    const [manualMode, setManualMode] = useState(false);
    const hasScanData = !!(form.check_image_url || form.amount || form.third_party_tax_id);
    const showForm = hasScanData || manualMode;

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 md:space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
                    <ScanLine className="w-4 h-4 md:w-5 md:h-5 text-cyan-300" />
                </div>
                <div className="min-w-0">
                    <h2 className="text-lg md:text-xl font-bold text-white">ניכיון צ׳קים</h2>
                    <p className="text-slate-500 text-[11px] md:text-xs">סרוק → אמת פרטים → החלטה</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4 md:gap-5">
                <CheckScanner onExtracted={handleExtracted} />

                {/* On mobile: collapsed until scan completes. On desktop (lg+): always visible. */}
                <div className={`bg-slate-900/60 border border-slate-800 rounded-xl p-3 md:p-5 space-y-3 ${!showForm ? 'hidden lg:block' : ''}`}>
                    <div className="flex items-center justify-between">
                        <h3 className="text-white font-semibold text-sm md:text-base">שלב 2 · פרטי הצ׳ק</h3>
                        {!hasScanData && manualMode && (
                            <button onClick={() => setManualMode(false)} className="lg:hidden text-[11px] text-slate-500 hover:text-slate-300">חזור לסריקה</button>
                        )}
                    </div>
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

                {/* Mobile-only: "fill manually" link when no scan yet */}
                {!showForm && (
                    <button
                        onClick={() => setManualMode(true)}
                        className="lg:hidden text-xs text-slate-400 hover:text-cyan-300 underline underline-offset-4 self-center"
                    >
                        או מלא ידנית ללא צילום
                    </button>
                )}
            </div>

            {decision && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl border p-5 ${STATUS_STYLE[decision.status]}`}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-bold">{STATUS_LABEL[decision.status]}</span>
                        {decision.rate != null && (
                            <span className="text-xs opacity-70 mr-2">· עמלת ניכיון: {decision.rate}%</span>
                        )}
                    </div>
                    <p className="text-sm leading-relaxed mb-3">{decision.reason}</p>
                    {decision.product_specific && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <Stat label="הפקדות עבר" value={decision.product_specific.prior_deposits ?? 0} />
                            <Stat label="ממוצע" value={`₪${(decision.product_specific.avg_prior_amount || 0).toLocaleString()}`} />
                            <Stat label="חזרות צד ג׳" value={decision.product_specific.third_party_bounces ?? 0} />
                            <Stat label="חזרות בחשבון" value={decision.product_specific.total_account_bounces ?? 0} />
                        </div>
                    )}
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