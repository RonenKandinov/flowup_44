import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Droplets, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import ModuleCard from './ModuleCard';

/**
 * Working Capital tab — combines receivables (Invoice), payables (SupplierPayment)
 * and the live cash-flow profile from the existing cashFlowIntelligence function.
 * Pure read view: no new business logic introduced here.
 */
export default function WorkingCapitalTab() {
    const { data: invoices = [] } = useQuery({
        queryKey: ['invoices-wc'],
        queryFn: () => base44.entities.Invoice.list('-issue_date', 200),
        initialData: []
    });
    const { data: payables = [] } = useQuery({
        queryKey: ['payables-wc'],
        queryFn: () => base44.entities.SupplierPayment.list('-due_date', 200),
        initialData: []
    });
    const { data: cashFlow } = useQuery({
        queryKey: ['cash-flow-profile-b2b'],
        queryFn: async () => {
            try {
                const res = await base44.functions.invoke('cashFlowIntelligence', {});
                return res.data?.cashFlowProfile || null;
            } catch {
                return null;
            }
        },
        staleTime: Infinity
    });

    const totalReceivables = invoices
        .filter(i => i.status !== 'paid' && i.status !== 'written_off')
        .reduce((s, i) => s + (i.amount || 0), 0);
    const totalPayables = payables
        .filter(p => p.status !== 'paid')
        .reduce((s, p) => s + (p.amount || 0), 0);
    const netWorkingCapital = totalReceivables - totalPayables;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <ModuleCard icon={ArrowUpRight} label="חייבים (Receivables)" value={`₪${Math.round(totalReceivables).toLocaleString('he-IL')}`} accent="emerald" delay={0} />
                <ModuleCard icon={ArrowDownRight} label="זכאים (Payables)" value={`₪${Math.round(totalPayables).toLocaleString('he-IL')}`} accent="rose" delay={0.05} />
                <ModuleCard
                    icon={Droplets}
                    label="הון חוזר נטו"
                    value={`₪${Math.round(netWorkingCapital).toLocaleString('he-IL')}`}
                    accent={netWorkingCapital >= 0 ? 'cyan' : 'amber'}
                    delay={0.1}
                />
                <ModuleCard
                    icon={Activity}
                    label="כושר החזר חודשי"
                    value={cashFlow?.realRepaymentCapacity != null ? `₪${Math.round(cashFlow.realRepaymentCapacity).toLocaleString('he-IL')}` : '—'}
                    hint="מבוסס Open Finance"
                    accent="violet"
                    delay={0.15}
                />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm p-4">
                <h3 className="text-white text-sm font-semibold mb-2">תובנת תזרים</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                    {cashFlow
                        ? `המערכת זיהתה דפוסי תזרים יציבים מתוך חיבור Open Finance הפעיל. כושר ההחזר החודשי מחושב על בסיס הכנסות חוזרות פחות הוצאות קבועות.`
                        : 'יש לחבר חשבון בנק (Open Finance) כדי להפעיל ניתוח תזרים גרנולרי.'}
                </p>
            </div>
        </div>
    );
}