import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Landmark, ShieldAlert, Banknote, TrendingUp } from 'lucide-react';
import ModuleCard from './ModuleCard';

/**
 * Treasury tab — liquidity, exposure and covenant monitoring.
 * Reuses OpenFinanceAccount aggregates already synced by loanLogicV2 — no new pipeline.
 */
export default function TreasuryTab() {
    const { data: accounts = [], isLoading } = useQuery({
        queryKey: ['of-accounts-treasury'],
        queryFn: () => base44.entities.OpenFinanceAccount.list('-balance', 50),
        initialData: []
    });

    const totalLiquidity = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    const checking = accounts.filter(a => (a.type || '').toUpperCase().includes('CHECK'));
    const savings = accounts.filter(a => (a.type || '').toUpperCase().includes('SAV'));
    const credit = accounts.filter(a => (a.type || '').toUpperCase().includes('CREDIT'));
    const creditExposure = credit.reduce((s, a) => s + Math.abs(a.balance || 0), 0);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <ModuleCard icon={Landmark} label="סך נזילות" value={`₪${Math.round(totalLiquidity).toLocaleString('he-IL')}`} accent="cyan" delay={0} />
                <ModuleCard icon={Banknote} label="חשבונות עו״ש" value={checking.length} accent="emerald" delay={0.05} />
                <ModuleCard icon={TrendingUp} label="חשבונות חיסכון" value={savings.length} accent="violet" delay={0.1} />
                <ModuleCard icon={ShieldAlert} label="חשיפת אשראי" value={`₪${Math.round(creditExposure).toLocaleString('he-IL')}`} accent="rose" delay={0.15} />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm p-4">
                <h3 className="text-white text-sm font-semibold mb-3">חשבונות מחוברים</h3>
                {isLoading ? (
                    <div className="text-slate-500 text-xs py-6 text-center">טוען...</div>
                ) : accounts.length === 0 ? (
                    <div className="text-slate-500 text-xs py-8 text-center">
                        אין חשבונות מחוברים. השתמש בחיבור Open Finance מהדשבורד הראשי.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-slate-300">
                            <thead className="text-slate-500 text-[10px] uppercase tracking-wider">
                                <tr>
                                    <th className="text-right py-2 px-2">שם חשבון</th>
                                    <th className="text-right py-2 px-2">סוג</th>
                                    <th className="text-right py-2 px-2">יתרה</th>
                                    <th className="text-right py-2 px-2">מטבע</th>
                                </tr>
                            </thead>
                            <tbody>
                                {accounts.slice(0, 10).map(a => (
                                    <tr key={a.id} className="border-t border-slate-800/60">
                                        <td className="py-2 px-2">{a.name || '—'}</td>
                                        <td className="py-2 px-2">{a.type || '—'}</td>
                                        <td className="py-2 px-2">₪{Math.round(a.balance || 0).toLocaleString('he-IL')}</td>
                                        <td className="py-2 px-2">{a.currency || 'ILS'}</td>
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