import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Activity, ShieldAlert, CheckCircle2, XCircle, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AuditLogs() {
    const { data: logs, isLoading } = useQuery({
        queryKey: ['auditLogs'],
        queryFn: () => base44.entities.AuditLog.list('-created_date', 100),
        refetchInterval: 10000
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6" dir="rtl">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                        <ShieldAlert className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-100">Audit Log (יומן אירועים)</h1>
                        <p className="text-sm text-slate-400">מעקב אחר פעולות מערכת ואירועי אבטחה לקראת פיילוט</p>
                    </div>
                </div>
                <Link to="/" className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 px-4 py-2 rounded-lg border border-indigo-500/20">
                    חזרה לדאשבורד <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 border-b border-slate-800">
                            <tr>
                                <th className="px-6 py-4 font-medium">תאריך ושעה</th>
                                <th className="px-6 py-4 font-medium">משתמש</th>
                                <th className="px-6 py-4 font-medium">פעולה</th>
                                <th className="px-6 py-4 font-medium">סטטוס</th>
                                <th className="px-6 py-4 font-medium">פרטים נוספים</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {logs?.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4 font-mono text-slate-300 text-sm" dir="ltr">
                                        {format(new Date(log.created_date), 'dd/MM/yyyy HH:mm:ss')}
                                    </td>
                                    <td className="px-6 py-4 text-slate-300">{log.user_id}</td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-200 border border-slate-700 shadow-sm">
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {log.status === 'SUCCESS' && <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md w-fit"><CheckCircle2 className="w-4 h-4" /> הצלחה</span>}
                                        {log.status === 'FAILURE' && <span className="flex items-center gap-1.5 text-red-400 bg-red-400/10 px-2 py-1 rounded-md w-fit"><XCircle className="w-4 h-4" /> שגיאה</span>}
                                        {log.status === 'PENDING' && <span className="flex items-center gap-1.5 text-amber-400 bg-amber-400/10 px-2 py-1 rounded-md w-fit"><Clock className="w-4 h-4" /> ממתין</span>}
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 font-mono text-xs max-w-xs truncate" dir="ltr">
                                        {JSON.stringify(log.details)}
                                    </td>
                                </tr>
                            ))}
                            {(!logs || logs.length === 0) && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                                        <ShieldAlert className="w-8 h-8 mx-auto mb-3 opacity-20" />
                                        אין אירועים מתועדים במערכת
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}