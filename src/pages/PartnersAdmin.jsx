import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Copy, CheckCircle2, Key, Link as LinkIcon } from 'lucide-react';
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">ניהול שותפי B2B</h1>
          <p className="text-slate-500 mt-1">ניהול חברות מימון, מפתחות API והגדרות Webhook</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="w-4 h-4" />
          שותף חדש
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20 shadow-md">
          <CardHeader>
            <CardTitle>הוספת שותף B2B חדש</CardTitle>
            <CardDescription>המערכת תייצר מפתח API מאובטח באופן אוטומטי.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>שם החברה (לדוגמה: פמה, מימון ישיר)</Label>
                  <Input 
                    value={newPartner.name}
                    onChange={e => setNewPartner({...newPartner, name: e.target.value})}
                    placeholder="הזן שם חברה"
                  />
                </div>
                <div className="space-y-2">
                  <Label>כתובת Webhook (URL)</Label>
                  <Input 
                    value={newPartner.webhook_url}
                    onChange={e => setNewPartner({...newPartner, webhook_url: e.target.value})}
                    placeholder="https://api.partner.com/webhook/flowup"
                    dir="ltr"
                    className="text-left"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>ביטול</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "שומר..." : "צור שותף"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="text-center py-12 text-slate-500">טוען נתונים...</div>
        ) : partners?.length === 0 ? (
          <Card className="bg-slate-50 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Key className="w-12 h-12 mb-4 text-slate-300" />
              <p>לא נמצאו שותפים במערכת.</p>
              <Button variant="link" onClick={() => setShowForm(true)}>צור את השותף הראשון</Button>
            </CardContent>
          </Card>
        ) : (
          partners?.map(partner => (
            <Card key={partner.id} className={!partner.active ? "opacity-60" : ""}>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold">{partner.name}</h3>
                      {!partner.active && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">לא פעיל</span>}
                    </div>
                    <p className="text-sm text-slate-500">נוצר בתאריך: {new Date(partner.created_date).toLocaleDateString('he-IL')}</p>
                  </div>
                  
                  <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg flex-1 border">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-slate-500">API Key</Label>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(partner.api_key, 'API Key')}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <code className="text-xs bg-white px-2 py-1 rounded border block truncate" dir="ltr">
                        {partner.api_key}
                      </code>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg flex-1 border">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-slate-500">Webhook URL</Label>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(partner.webhook_url, 'Webhook URL')}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <code className="text-xs bg-white px-2 py-1 rounded border block truncate" dir="ltr">
                        {partner.webhook_url}
                      </code>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`active-${partner.id}`} className="text-sm">פעיל</Label>
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