import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Cpu, Layers, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
import ModuleCard from './ModuleCard';
import { Button } from '@/components/ui/button';

/**
 * Underwriting Infrastructure tab — surfaces UnderwritingAnalysis records
 * produced by the existing loanLogicV2 / insightEngine / dealRescuerEngine pipeline.
 * Read-only summary; full settings live in /UnderwritingSettings.
 */
export default function UnderwritingInfraTab() {
    const { data: analyses = [], isLoading } = useQuery({
        queryKey: ['underwriting-analyses'],
        queryFn: () => base44.entities.UnderwritingAnalysis.list('-created_date', 50),
        initialData: []
    });

    const total = analyses.length;
    const green = analyses.filter(a => a.risk_tier === 'Green').length;
    const orange = analyses.filter(a => a.risk_tier === 'Orange').length;
    const red = analyses.filter(a => a.risk_tier === 'Red').length;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <ModuleCard icon={Layers} label="סך תיקי חיתום" value={total} accent="cyan" delay={0} />
                <ModuleCard icon={CheckCircle2} label="Green (אישור)" value={green} accent="emerald" delay={0.05} />
                <ModuleCard icon={AlertTriangle} label="Orange (מותנה)" value={orange} accent="amber" delay={0.1} />
                <ModuleCard icon={Cpu} label="Red (סיכון גבוה)" value={red} accent="rose" delay={0.15} />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white text-sm font-semibold">תיקי חיתום אחרונים</h3>
                    <Button asChild variant="ghost" size="sm" className="text-cyan-300 hover:text-white text-[11px] h-7">
                        <Link to="/UnderwritingSettings">
                            הגדרות חיתום
                            <ArrowLeft className="w-3 h-3 mr-1" />
                        </Link>
                    </Button>
                </div>
                {isLoading ? (
                    <div className="text-slate-500 text-xs py-6 text-center">טוען...</div>
                ) : analyses.length === 0 ? (
                    <div className="text-slate-500 text-xs py-8 text-center">
                        אין עדיין ניתוחי חיתום. ניתוח ראשון ייוצר אוטומטית מהדשבורד.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-slate-300">
                            <thead className="text-slate-500 text-[10px] uppercase tracking-wider">
                                <tr>
                                    <th className="text-right py-2 px-2">משתמש</th>
                                    <th className="text-right py-2 px-2">ציון</th>
                                    <th className="text-right py-2 px-2">Tier</th>
                                    <th className="text-right py-2 px-2">DSR</th>
                                    <th className="text-right py-2 px-2">תאריך</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analyses.slice(0, 10).map(a => (
                                    <tr key={a.id} className="border-t border-slate-800/60">
                                        <td className="py-2 px-2">{a.user_email || '—'}</td>
                                        <td className="py-2 px-2 font-medium text-white">{a.score ?? '—'}</td>
                                        <td className="py-2 px-2">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                                                a.risk_tier === 'Green' ? 'bg-emerald-500/20 text-emerald-300' :
                                                a.risk_tier === 'Orange' ? 'bg-amber-500/20 text-amber-300' :
                                                'bg-rose-500/20 text-rose-300'
                                            }`}>{a.risk_tier}</span>
                                        </td>
                                        <td className="py-2 px-2">{a.dsr != null ? `${a.dsr}%` : '—'}</td>
                                        <td className="py-2 px-2 text-slate-500">{a.created_date ? new Date(a.created_date).toLocaleDateString('he-IL') : '—'}</td>
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