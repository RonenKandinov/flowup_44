import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart } from 'recharts';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Activity, LineChart as LineChartIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { FiscalAgent } from '@/components/protocol/core/fiscalAgent';
import { useQuery } from '@tanstack/react-query';
import { appParams } from '@/lib/app-params';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TrendsDashboard() {
    const [localData, setLocalData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const { data: user } = useQuery({
        queryKey: ['user', appParams.token ?? ''],
        queryFn: async () => {
            try {
                return await base44.auth.me();
            } catch (e) {
                if (e.response?.status === 401) return null;
                throw e;
            }
        },
        enabled: !!appParams.token,
        retry: false,
    });

    const { data: shadowEntries } = useQuery({
        queryKey: ['shadow-entries'],
        queryFn: () => base44.entities.ShadowRealmEntry.list('-transaction_date', 2000),
        initialData: []
    });

    useEffect(() => {
        if (!appParams.token) {
            setIsLoading(false);
            return;
        }
        const loadFromStorage = async () => {
            try {
                const res = await base44.functions.invoke('systemUtils', { service: 'storage', action: 'load' });
                const data = res.data?.data;
                if (data) {
                    if (data.transactions) {
                        data.transactions.forEach(t => t.date = new Date(t.date));
                    }
                    setLocalData(data);
                }
            } catch (e) {
                console.error("Failed to load local data", e);
            } finally {
                setIsLoading(false);
            }
        };
        loadFromStorage();
    }, []);

    const transactions = useMemo(() => {
        if (localData?.transactions?.length > 0) {
            return localData.transactions;
        }
        const list = Array.isArray(shadowEntries) ? shadowEntries : [];
        return list.map(entry => FiscalAgent.recoverEntry(entry))
            .filter(t => !t.is_corrupted)
            .map(t => ({ ...t, date: new Date(t.date) }))
            .sort((a, b) => b.date - a.date);
    }, [shadowEntries, localData]);

    const monthlyData = useMemo(() => {
        if (!transactions || transactions.length === 0) return [];
        
        const monthsMap = {};
        
        transactions.forEach(t => {
            if (isNaN(t.date.getTime())) return;
            
            const monthKey = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
            const monthLabel = t.date.toLocaleDateString('he-IL', { month: 'short', year: '2-digit' });
            
            if (!monthsMap[monthKey]) {
                monthsMap[monthKey] = {
                    key: monthKey,
                    label: monthLabel,
                    income: 0,
                    expenses: 0,
                    netFlow: 0
                };
            }
            
            let amount = 0;
            if (t.amount !== undefined) {
                amount = t.amount;
            } else if (t.credit !== undefined || t.debit !== undefined) {
                amount = (t.credit || 0) - (t.debit || 0);
            }
            
            if (amount > 0) {
                monthsMap[monthKey].income += amount;
            } else {
                monthsMap[monthKey].expenses += Math.abs(amount);
            }
            monthsMap[monthKey].netFlow += amount;
        });
        
        return Object.values(monthsMap)
            .sort((a, b) => a.key.localeCompare(b.key))
            .slice(-6);
            
    }, [transactions]);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-right" dir="rtl">
                    <p className="text-white font-medium mb-2">{label}</p>
                    {payload.map((entry, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm mb-1">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-slate-300">{entry.name}:</span>
                            <span className="font-semibold text-white mr-auto">
                                ₪{Math.round(entry.value).toLocaleString('he-IL')}
                            </span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-950">
                <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 p-6 md:p-8" dir="rtl">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center gap-4 mb-8">
                    <Button variant="ghost" size="icon" asChild className="hover:bg-slate-800 text-slate-400">
                        <Link to="/">
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                            <LineChartIcon className="w-8 h-8 text-cyan-500" />
                            ניתוח מגמות
                        </h1>
                        <p className="text-slate-400 mt-1">מבט היסטורי על הכנסות, הוצאות ויכולת החזר (6 חודשים אחרונים)</p>
                    </div>
                </div>

                {monthlyData.length === 0 ? (
                    <Card className="bg-slate-900/50 border-slate-800">
                        <CardContent className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <Activity className="w-12 h-12 mb-4 opacity-50" />
                            <p>אין נתונים מספיקים להצגת מגמות</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {/* Income vs Expenses Bar Chart */}
                        <Card className="bg-slate-900/50 border-slate-800">
                            <CardHeader>
                                <CardTitle className="text-lg text-slate-200">הכנסות מול הוצאות</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[350px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                            <XAxis dataKey="label" stroke="#64748b" tick={{ fill: '#94a3b8' }} axisLine={{ stroke: '#334155' }} />
                                            <YAxis stroke="#64748b" tick={{ fill: '#94a3b8' }} axisLine={{ stroke: '#334155' }} tickFormatter={(value) => `₪${value/1000}k`} />
                                            <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                            <Bar dataKey="income" name="הכנסות" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                            <Bar dataKey="expenses" name="הוצאות" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Net Cashflow Line Chart */}
                        <Card className="bg-slate-900/50 border-slate-800">
                            <CardHeader>
                                <CardTitle className="text-lg text-slate-200">תזרים נטו (הכנסות פחות הוצאות)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                            <XAxis dataKey="label" stroke="#64748b" tick={{ fill: '#94a3b8' }} axisLine={{ stroke: '#334155' }} />
                                            <YAxis stroke="#64748b" tick={{ fill: '#94a3b8' }} axisLine={{ stroke: '#334155' }} tickFormatter={(value) => `₪${value/1000}k`} />
                                            <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                            <Line type="monotone" dataKey="netFlow" name="תזרים נטו" stroke="#06b6d4" strokeWidth={3} dot={{ r: 4, fill: '#06b6d4', strokeWidth: 2, stroke: '#0f172a' }} activeDot={{ r: 6 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}