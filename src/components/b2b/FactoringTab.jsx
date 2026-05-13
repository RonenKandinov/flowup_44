import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, TrendingUp, Clock, ShieldCheck } from 'lucide-react';
import ModuleCard from './ModuleCard';

/**
 * Factoring tab — invoice discounting.
 * Reads from the Invoice entity (status: factored / issued).
 * Risk scoring of debtors is delegated to insightEngine when available.
 */
export default function FactoringTab() {
    const { data: invoices = [], isLoading } = useQuery({
        queryKey: ['invoices-factoring'],
        queryFn: () => base44.entities.Invoice.list('-issue_date', 100),
        initialData: []
    });

    const factored = invoices.filter(i => i.status === 'factored');
    const eligible = invoices.filter(i => i.status === 'issued');
    const totalAdvanced = factored.reduce((s, i) => s + (i.amount || 0) * ((i.factoring_advance_rate || 80) / 100), 0);
    const avgFee = factored.length
        ? (factored.reduce((s, i) => s + (i.factoring_fee_rate || 0), 0) / factored.length).toFixed(2)
        : '—';

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <ModuleCard icon={FileText} label="חשבוניות זמינות לניכיון" value={eligible.length} accent="cyan" delay={0} />
                <ModuleCard icon={TrendingUp} label="סך מקדמות שולמו" value={`₪${Math.round(totalAdvanced).toLocaleString('he-IL')}`} accent="emerald" delay={0.05} />
                <ModuleCard icon={Clock} label="חשבוניות בניכיון פעיל" value={factored.length} accent="amber" delay={0.1} />
                <ModuleCard icon={ShieldCheck} label="עמלת ניכיון ממוצעת" value={avgFee === '—' ? '—' : `${avgFee}%`} accent="violet" delay={0.15} />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white text-sm font-semibold">חשבוניות אחרונות</h3>
                </div>
                {isLoading ? (
                    <div className="text-slate-500 text-xs py-6 text-center">טוען...</div>
                ) : invoices.length === 0 ? (
                    <div className="text-slate-500 text-xs py-8 text-center">
                        אין עדיין חשבוניות במערכת. הוסף חשבוניות כדי להפעיל ניכיון אוטומטי.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-slate-300">
                            <thead className="text-slate-500 text-[10px] uppercase tracking-wider">
                                <tr>
                                    <th className="text-right py-2 px-2">חשבונית</th>
                                    <th className="text-right py-2 px-2">חייב</th>
                                    <th className="text-right py-2 px-2">סכום</th>
                                    <th className="text-right py-2 px-2">פירעון</th>
                                    <th className="text-right py-2 px-2">סטטוס</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.slice(0, 10).map(inv => (
                                    <tr key={inv.id} className="border-t border-slate-800/60">
                                        <td className="py-2 px-2">{inv.invoice_number}</td>
                                        <td className="py-2 px-2">{inv.debtor_name}</td>
                                        <td className="py-2 px-2">₪{Math.round(inv.amount || 0).toLocaleString('he-IL')}</td>
                                        <td className="py-2 px-2">{inv.due_date}</td>
                                        <td className="py-2 px-2">
                                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px]">{inv.status}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}