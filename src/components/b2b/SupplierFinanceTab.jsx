import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Truck, Percent, CalendarClock, Wallet } from 'lucide-react';
import ModuleCard from './ModuleCard';

/**
 * Supplier Finance tab — payables management with early-payment discount optimization.
 * Reads from the SupplierPayment entity. Cash-flow context comes from
 * the existing cashFlowIntelligence backend function.
 */
export default function SupplierFinanceTab() {
    const { data: payments = [], isLoading } = useQuery({
        queryKey: ['supplier-payments'],
        queryFn: () => base44.entities.SupplierPayment.list('-due_date', 100),
        initialData: []
    });

    const pending = payments.filter(p => p.status === 'pending' || p.status === 'scheduled');
    const totalPending = pending.reduce((s, p) => s + (p.amount || 0), 0);
    const discountOpportunities = pending.filter(p => (p.early_payment_discount_pct || 0) > 0);
    const potentialSavings = discountOpportunities.reduce(
        (s, p) => s + (p.amount || 0) * ((p.early_payment_discount_pct || 0) / 100),
        0
    );

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <ModuleCard icon={Truck} label="התחייבויות פתוחות" value={pending.length} accent="blue" delay={0} />
                <ModuleCard icon={Wallet} label="סך תשלומים ממתינים" value={`₪${Math.round(totalPending).toLocaleString('he-IL')}`} accent="cyan" delay={0.05} />
                <ModuleCard icon={Percent} label="הזדמנויות להנחת תשלום מוקדם" value={discountOpportunities.length} accent="emerald" delay={0.1} />
                <ModuleCard icon={CalendarClock} label="חיסכון פוטנציאלי" value={`₪${Math.round(potentialSavings).toLocaleString('he-IL')}`} accent="violet" delay={0.15} />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm p-4">
                <h3 className="text-white text-sm font-semibold mb-3">תשלומים לספקים</h3>
                {isLoading ? (
                    <div className="text-slate-500 text-xs py-6 text-center">טוען...</div>
                ) : payments.length === 0 ? (
                    <div className="text-slate-500 text-xs py-8 text-center">
                        אין עדיין התחייבויות לספקים. הוסף תשלומים כדי לקבל המלצות אופטימיזציה.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-slate-300">
                            <thead className="text-slate-500 text-[10px] uppercase tracking-wider">
                                <tr>
                                    <th className="text-right py-2 px-2">ספק</th>
                                    <th className="text-right py-2 px-2">סכום</th>
                                    <th className="text-right py-2 px-2">פירעון</th>
                                    <th className="text-right py-2 px-2">הנחה</th>
                                    <th className="text-right py-2 px-2">סטטוס</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.slice(0, 10).map(p => (
                                    <tr key={p.id} className="border-t border-slate-800/60">
                                        <td className="py-2 px-2">{p.supplier_name}</td>
                                        <td className="py-2 px-2">₪{Math.round(p.amount || 0).toLocaleString('he-IL')}</td>
                                        <td className="py-2 px-2">{p.due_date}</td>
                                        <td className="py-2 px-2">{p.early_payment_discount_pct ? `${p.early_payment_discount_pct}%` : '—'}</td>
                                        <td className="py-2 px-2">
                                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px]">{p.status}</span>
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