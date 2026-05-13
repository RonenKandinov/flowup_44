import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { PhoneCall, AlertOctagon, HandCoins, Clock } from 'lucide-react';
import ModuleCard from './ModuleCard';

const SEGMENT_COLOR = {
    low: 'bg-emerald-500/20 text-emerald-300',
    medium: 'bg-amber-500/20 text-amber-300',
    high: 'bg-orange-500/20 text-orange-300',
    critical: 'bg-rose-500/20 text-rose-300'
};

/**
 * Collections Intelligence tab — overdue invoice management.
 * Reads from CollectionsCase entity. AI-driven recommendations and risk
 * segmentation are computed elsewhere (insightEngine) and stored on the case.
 */
export default function CollectionsTab() {
    const { data: cases = [], isLoading } = useQuery({
        queryKey: ['collections-cases'],
        queryFn: () => base44.entities.CollectionsCase.list('-days_overdue', 100),
        initialData: []
    });

    const open = cases.filter(c => c.status !== 'resolved' && c.status !== 'closed');
    const totalOverdue = open.reduce((s, c) => s + (c.amount_due || 0), 0);
    const critical = open.filter(c => c.risk_segment === 'critical' || c.risk_segment === 'high').length;
    const promised = cases.filter(c => c.status === 'promised_to_pay').length;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <ModuleCard icon={AlertOctagon} label="תיקים פתוחים" value={open.length} accent="rose" delay={0} />
                <ModuleCard icon={HandCoins} label="סך חוב פתוח" value={`₪${Math.round(totalOverdue).toLocaleString('he-IL')}`} accent="amber" delay={0.05} />
                <ModuleCard icon={PhoneCall} label="הבטחות לתשלום" value={promised} accent="emerald" delay={0.1} />
                <ModuleCard icon={Clock} label="תיקים בסיכון גבוה" value={critical} accent="violet" delay={0.15} />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm p-4">
                <h3 className="text-white text-sm font-semibold mb-3">תיקי גבייה</h3>
                {isLoading ? (
                    <div className="text-slate-500 text-xs py-6 text-center">טוען...</div>
                ) : cases.length === 0 ? (
                    <div className="text-slate-500 text-xs py-8 text-center">
                        אין תיקי גבייה פתוחים. תיקים נפתחים אוטומטית מחשבוניות באיחור.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-slate-300">
                            <thead className="text-slate-500 text-[10px] uppercase tracking-wider">
                                <tr>
                                    <th className="text-right py-2 px-2">חייב</th>
                                    <th className="text-right py-2 px-2">סכום</th>
                                    <th className="text-right py-2 px-2">ימי איחור</th>
                                    <th className="text-right py-2 px-2">סיכון</th>
                                    <th className="text-right py-2 px-2">פעולה מומלצת</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cases.slice(0, 10).map(c => (
                                    <tr key={c.id} className="border-t border-slate-800/60">
                                        <td className="py-2 px-2">{c.debtor_name}</td>
                                        <td className="py-2 px-2">₪{Math.round(c.amount_due || 0).toLocaleString('he-IL')}</td>
                                        <td className="py-2 px-2">{c.days_overdue ?? '—'}</td>
                                        <td className="py-2 px-2">
                                            {c.risk_segment ? (
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] ${SEGMENT_COLOR[c.risk_segment] || 'bg-slate-800'}`}>
                                                    {c.risk_segment}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td className="py-2 px-2 text-slate-400">{c.recommended_strategy || '—'}</td>
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