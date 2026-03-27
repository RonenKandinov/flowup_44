import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Copy, CheckCircle2, Key, Link as LinkIcon, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from "sonner";
import { useAuth } from '@/lib/AuthContext';

export default function PartnersAdmin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newPartner, setNewPartner] = useState({ name: '', webhook_url: '' });

  const { data: partners, isLoading } = useQuery({
    queryKey: ['b2b_partners'],
    queryFn: () => base44.entities.B2BPartner.list('-created_date', 50),
    enabled: user?.role === 'admin'
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Generate a random API key
      const apiKey = 'sk_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      return base44.entities.B2BPartner.create({ ...data, api_key: apiKey, active: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b_partners'] });
      setShowForm(false);
      setNewPartner({ name: '', webhook_url: '' });
      toast.success("שותף חדש נוצר בהצלחה");
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }) => base44.entities.B2BPartner.update(id, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b_partners'] });
      toast.success("סטטוס שותף עודכן");
    }
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newPartner.name || !newPartner.webhook_url) {
      toast.error("נא למלא את כל השדות");
      return;
    }
    createMutation.mutate(newPartner);
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    toast.success(`${type} הועתק ללוח`);
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="w-full max-w-md text-center p-6">
          <CardTitle className="text-red-500 mb-2">אין הרשאה</CardTitle>
          <CardDescription>עמוד זה מיועד למנהלי מערכת בלבד.</CardDescription>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6" dir="rtl">
      <div className="flex justify-between items-center bg-slate-900/40 p-6 rounded-2xl border border-slate-800/60">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Button variant="ghost" size="icon" asChild className="h-10 w-10 rounded-full bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
              <Link to="/">
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <h1 className="text-3xl font-bold text-white">ניהול שותפי B2B</h1>
          </div>
          <p className="text-slate-400 mt-1 pr-14">ניהול חברות מימון, מפתחות API והגדרות Webhook</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20">
          <Plus className="w-4 h-4" />
          שותף חדש
        </Button>
      </div>

      {showForm && (
        <Card className="border-blue-500/30 bg-slate-900/80 shadow-lg shadow-blue-900/10">
          <CardHeader>
            <CardTitle className="text-slate-100">הוספת שותף B2B חדש</CardTitle>
            <CardDescription className="text-slate-400">המערכת תייצר מפתח API מאובטח באופן אוטומטי.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-300">שם החברה (לדוגמה: פמה, מימון ישיר)</Label>
                  <Input 
                    value={newPartner.name}
                    onChange={e => setNewPartner({...newPartner, name: e.target.value})}
                    placeholder="הזן שם חברה"
                    className="bg-slate-950 border-slate-800 text-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">כתובת Webhook (URL)</Label>
                  <Input 
                    value={newPartner.webhook_url}
                    onChange={e => setNewPartner({...newPartner, webhook_url: e.target.value})}
                    placeholder="https://api.partner.com/webhook/flowup"
                    dir="ltr"
                    className="text-left bg-slate-950 border-slate-800 text-slate-200"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">ביטול</Button>
                <Button type="submit" disabled={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {createMutation.isPending ? "שומר..." : "צור שותף"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="text-center py-16 text-slate-500">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            טוען נתונים...
          </div>
        ) : partners?.length === 0 ? (
          <Card className="bg-slate-900/40 border-slate-800/60 border-dashed shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-20 text-slate-400">
              <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                <Key className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-lg font-medium text-slate-300 mb-1">לא נמצאו שותפים במערכת</p>
              <p className="text-sm text-slate-500 mb-6">הוסף את חברת המימון הראשונה כדי להתחיל</p>
              <Button onClick={() => setShowForm(true)} className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700">
                <Plus className="w-4 h-4 ml-2" />
                צור את השותף הראשון
              </Button>
            </CardContent>
          </Card>
        ) : (
          partners?.map(partner => (
            <Card key={partner.id} className={`bg-slate-900/60 border-slate-800/80 shadow-sm ${!partner.active ? "opacity-50" : ""}`}>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between gap-6">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold text-slate-100">{partner.name}</h3>
                      {!partner.active && <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-0.5 rounded-full">לא פעיל</span>}
                    </div>
                    <p className="text-sm text-slate-500">נוצר בתאריך: {new Date(partner.created_date).toLocaleDateString('he-IL')}</p>
                  </div>
                  
                  <div className="flex items-center gap-4 bg-slate-950/50 p-4 rounded-xl flex-1 border border-slate-800/60">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-slate-400 font-medium tracking-wide">API Key</Label>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-slate-300 hover:bg-slate-800" onClick={() => copyToClipboard(partner.api_key, 'API Key')}>
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <code className="text-xs bg-slate-900 text-slate-300 px-3 py-2 rounded-md border border-slate-800 block truncate" dir="ltr">
                        {partner.api_key}
                      </code>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 bg-slate-950/50 p-4 rounded-xl flex-1 border border-slate-800/60">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-slate-400 font-medium tracking-wide">Webhook URL</Label>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-slate-300 hover:bg-slate-800" onClick={() => copyToClipboard(partner.webhook_url, 'Webhook URL')}>
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <code className="text-xs bg-slate-900 text-slate-300 px-3 py-2 rounded-md border border-slate-800 block truncate" dir="ltr">
                        {partner.webhook_url}
                      </code>
                    </div>
                  </div>

                  <div className="flex items-center justify-end pl-2">
                    <div className="flex items-center gap-3">
                      <Label htmlFor={`active-${partner.id}`} className="text-sm text-slate-300 cursor-pointer">פעיל</Label>
                      <Switch 
                        id={`active-${partner.id}`}
                        checked={partner.active}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: partner.id, active: checked })}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}