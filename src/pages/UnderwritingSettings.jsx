import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Settings, Save, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function UnderwritingSettings() {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState(null);

    const { data: rules, isLoading } = useQuery({
        queryKey: ['underwritingRules'],
        queryFn: async () => {
            const res = await base44.entities.UnderwritingRule.list();
            return res[0] || null;
        }
    });

    useEffect(() => {
        if (rules) {
            setFormData(rules);
        } else if (rules === null) {
            setFormData({
                company_name: 'חברת מימון דיפולטיבית',
                max_dti_approve: 35,
                max_dti_review: 45,
                min_liquidity_months: 1,
                max_expense_income_ratio: 90,
                min_income: 8000,
                enable_second_chance: true
            });
        }
    }, [rules]);

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            if (data.id) {
                return await base44.entities.UnderwritingRule.update(data.id, data);
            } else {
                return await base44.entities.UnderwritingRule.create(data);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['underwritingRules']);
            queryClient.invalidateQueries(['ai-insights-v2']);
            queryClient.invalidateQueries(['loanMetrics']);
            
            // Clear ALL loan metrics cache versions so Dashboard refetches with new rules
            Object.keys(sessionStorage).forEach(key => {
                if (key.startsWith('loanMetricsCache')) {
                    sessionStorage.removeItem(key);
                }
            });
            // Clear AI insights cache too
            try { localStorage.removeItem('flowup_ai_insights_cache_v2'); } catch (_) {}

            toast.success('מדיניות החיתום עודכנה בהצלחה. הדף יתרענן בפעם הבאה שתכנס.');
        },
        onError: (err) => {
            toast.error('שגיאה בשמירת הנתונים: ' + err.message);
        }
    });

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        if (!formData) return;
        saveMutation.mutate(formData);
    };

    if (isLoading || !formData) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                        <Settings className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-100">הגדרות חיתום ומדיניות סיכונים</h1>
                        <p className="text-sm text-slate-400">התאם אישית את מנוע ה-AI והפרמטרים לאישור הלוואות</p>
                    </div>
                </div>
                <Link to="/" className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 px-4 py-2 rounded-lg border border-indigo-500/20">
                    חזרה לדאשבורד <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 shadow-xl space-y-8">
                
                {/* General */}
                <section>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                        הגדרות כלליות
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm text-slate-400">שם חברת המימון</label>
                            <Input 
                                value={formData.company_name} 
                                onChange={(e) => handleChange('company_name', e.target.value)}
                                className="bg-slate-800/50 border-slate-700 text-white"
                            />
                        </div>
                    </div>
                </section>

                <div className="h-px bg-slate-800 w-full" />

                {/* Risk Thresholds */}
                <section>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-400" />
                        ספי סיכון (Risk Thresholds)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm text-slate-400">DTI מקסימלי לאישור אוטומטי (%)</label>
                            <Input 
                                type="number"
                                value={formData.max_dti_approve} 
                                onChange={(e) => handleChange('max_dti_approve', Number(e.target.value))}
                                className="bg-slate-800/50 border-slate-700 text-white"
                            />
                            <p className="text-xs text-slate-500">עד יחס זה, הלקוח יקבל המלצת אישור (בהנחה ששאר המדדים תקינים).</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm text-slate-400">DTI מקסימלי לבחינה (%)</label>
                            <Input 
                                type="number"
                                value={formData.max_dti_review} 
                                onChange={(e) => handleChange('max_dti_review', Number(e.target.value))}
                                className="bg-slate-800/50 border-slate-700 text-white"
                            />
                            <p className="text-xs text-slate-500">מעל יחס זה, הלקוח יקבל דחייה אוטומטית.</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm text-slate-400">יחס הוצאות/הכנסות מקסימלי (%)</label>
                            <Input 
                                type="number"
                                value={formData.max_expense_income_ratio} 
                                onChange={(e) => handleChange('max_expense_income_ratio', Number(e.target.value))}
                                className="bg-slate-800/50 border-slate-700 text-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm text-slate-400">מינימום חודשי נזילות</label>
                            <Input 
                                type="number"
                                step="0.1"
                                value={formData.min_liquidity_months} 
                                onChange={(e) => handleChange('min_liquidity_months', Number(e.target.value))}
                                className="bg-slate-800/50 border-slate-700 text-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm text-slate-400">הכנסה חודשית מינימלית (₪)</label>
                            <Input 
                                type="number"
                                value={formData.min_income} 
                                onChange={(e) => handleChange('min_income', Number(e.target.value))}
                                className="bg-slate-800/50 border-slate-700 text-white"
                            />
                        </div>
                    </div>
                </section>

                <div className="h-px bg-slate-800 w-full" />

                {/* AI & Behavior */}
                <section>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-indigo-400" />
                        הגדרות מנוע AI והתנהגות
                    </h3>
                    <div className="flex items-center justify-between bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
                        <div>
                            <p className="text-sm font-medium text-white">מנגנון הזדמנות שנייה (Second Chance)</p>
                            <p className="text-xs text-slate-400 mt-1">מאפשר למנוע ה-AI לאשר לקוחות גבוליים אם זוהתה מגמת שיפור עקבית בהתנהלות הפיננסית.</p>
                        </div>
                        <Switch 
                            checked={formData.enable_second_chance}
                            onCheckedChange={(checked) => handleChange('enable_second_chance', checked)}
                        />
                    </div>
                </section>

                <div className="flex justify-end pt-4">
                    <Button 
                        onClick={handleSave} 
                        disabled={saveMutation.isPending}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {saveMutation.isPending ? 'שומר...' : 'שמור שינויים'}
                    </Button>
                </div>
            </div>
        </div>
    );
}