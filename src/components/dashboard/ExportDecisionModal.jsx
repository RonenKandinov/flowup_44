import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Send, Settings2, Loader2 } from 'lucide-react';
import { toast } from "sonner";

export default function ExportDecisionModal({ analysis }) {
    const [isOpen, setIsOpen] = useState(false);
    const [exportType, setExportType] = useState('csv'); // csv, api
    const [apiUrl, setApiUrl] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    
    // Default field mapping for LOS systems
    const [fieldMapping, setFieldMapping] = useState({
        decision: 'DecisionStatus',
        confidence: 'ConfidenceLevel',
        dti: 'DebtToIncomeRatio',
        income: 'MonthlyIncome',
        expenses: 'MonthlyExpenses',
        liquidity: 'LiquidityMonths',
        risk_tier: 'RiskTier'
    });

    const handleMappingChange = (key, value) => {
        setFieldMapping(prev => ({ ...prev, [key]: value }));
    };

    const getMappedData = () => {
        if (!analysis || !analysis.analyst_recommendation) return {};
        
        const { analyst_recommendation, metrics, risk_tier } = analysis;
        
        return {
            [fieldMapping.decision]: analyst_recommendation.recommendation.decision,
            [fieldMapping.confidence]: analyst_recommendation.recommendation.confidence,
            [fieldMapping.dti]: metrics?.dti ?? 0,
            [fieldMapping.income]: metrics?.totalIncome ?? 0,
            [fieldMapping.expenses]: metrics?.totalExpenses ?? 0,
            [fieldMapping.liquidity]: metrics?.liquidity_months ?? 0,
            [fieldMapping.risk_tier]: risk_tier
        };
    };

    const handleExportCSV = () => {
        const data = getMappedData();
        const headers = Object.keys(data).join(',');
        const values = Object.values(data).map(v => `"${v}"`).join(',');
        const csvContent = `${headers}\n${values}`;
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `decision_export_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('קובץ ה-CSV יוצא בהצלחה');
        setIsOpen(false);
    };

    const handleExportAPI = async () => {
        if (!apiUrl) {
            toast.error('נא להזין כתובת API תקינה');
            return;
        }
        
        setIsExporting(true);
        try {
            const data = getMappedData();
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) throw new Error('שגיאה בשליחת הנתונים לשרת');
            
            toast.success('הנתונים נשלחו בהצלחה ל-API');
            setIsOpen(false);
        } catch (error) {
            toast.error(error.message || 'אירעה שגיאה בשליחת הנתונים');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 bg-slate-800/50 border-slate-700 hover:bg-slate-800 text-slate-300">
                    <Send className="w-4 h-4" />
                    ייצוא ל-LOS
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 sm:max-w-[500px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                        <Settings2 className="w-5 h-5 text-indigo-400" />
                        ייצוא החלטת חיתום
                    </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="csv" className="w-full mt-4" onValueChange={setExportType}>
                    <TabsList className="grid w-full grid-cols-2 bg-slate-800">
                        <TabsTrigger value="csv" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">CSV / Excel</TabsTrigger>
                        <TabsTrigger value="api" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">API (Webhook)</TabsTrigger>
                    </TabsList>
                    
                    <div className="mt-6 space-y-4">
                        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                            <h4 className="text-sm font-medium text-slate-300 mb-3">מיפוי שדות (Field Mapping)</h4>
                            <p className="text-xs text-slate-500 mb-4">התאם את שמות השדות למערכת ה-LOS שלך</p>
                            <div className="grid grid-cols-2 gap-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                {Object.entries(fieldMapping).map(([key, value]) => (
                                    <div key={key} className="flex flex-col gap-1.5">
                                        <Label className="text-xs text-slate-400 capitalize">{key.replace('_', ' ')}</Label>
                                        <Input 
                                            value={value} 
                                            onChange={(e) => handleMappingChange(key, e.target.value)}
                                            className="h-8 bg-slate-950 border-slate-700 text-xs text-left"
                                            dir="ltr"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <TabsContent value="api" className="mt-0 space-y-3">
                            <div className="space-y-1.5">
                                <Label className="text-sm text-slate-300">כתובת API (Endpoint URL)</Label>
                                <Input 
                                    placeholder="https://api.your-los.com/webhook" 
                                    value={apiUrl}
                                    onChange={(e) => setApiUrl(e.target.value)}
                                    className="bg-slate-950 border-slate-700 text-left"
                                    dir="ltr"
                                />
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
                    <Button variant="ghost" onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white hover:bg-slate-800">
                        ביטול
                    </Button>
                    {exportType === 'csv' ? (
                        <Button onClick={handleExportCSV} className="bg-indigo-600 hover:bg-indigo-700 gap-2 text-white">
                            <Download className="w-4 h-4" />
                            הורד CSV
                        </Button>
                    ) : (
                        <Button onClick={handleExportAPI} disabled={isExporting} className="bg-indigo-600 hover:bg-indigo-700 gap-2 text-white">
                            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            שלח נתונים
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}