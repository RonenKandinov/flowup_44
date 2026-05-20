import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Send, CheckCircle2, Loader2, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

/**
 * One-shot generator for B2B customer onboarding links.
 * Used by analysts on the PartnersAdmin page — per partner row.
 */
export default function OnboardingLinkGenerator({ partner, onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer_name: '', customer_email: '', customer_phone: '', requested_amount: '' });
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState(null);

  const reset = () => {
    setForm({ customer_name: '', customer_email: '', customer_phone: '', requested_amount: '' });
    setResult(null);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await base44.functions.invoke('onboardingLinkCreate', {
        b2b_partner_id: partner.id,
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        customer_phone: form.customer_phone,
        requested_amount: form.requested_amount ? Number(form.requested_amount) : null,
        base_url: window.location.origin
      });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      toast.success('הקישור נוצר בהצלחה');
      onCreated?.();
    } catch (err) {
      toast.error(err?.message || 'יצירת הקישור נכשלה');
    } finally {
      setCreating(false);
    }
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('הקישור הועתק');
  };

  const sendWhatsApp = (phone, link) => {
    const msg = `שלום, להמשך בקשת האשראי מול ${partner.name} אנא חבר את חשבון הבנק שלך בקישור הבא: ${link}`;
    const clean = String(phone || '').replace(/\D/g, '');
    const url = clean
      ? `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const sendEmail = (email, link) => {
    const subject = `בקשת אשראי מול ${partner.name} – חיבור בנק מאובטח`;
    const body = `שלום,\n\nלהמשך בקשת האשראי שלך מול ${partner.name}, אנא חבר את חשבון הבנק שלך באמצעות הקישור המאובטח הבא:\n\n${link}\n\nהקישור חד-פעמי ויפוג תוך 24 שעות.\n\nFlowUp`;
    const to = email || '';
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="border-blue-500/40 text-blue-300 hover:bg-blue-500/10 hover:text-blue-200 gap-2"
      >
        <LinkIcon className="w-3.5 h-3.5" />
        צור קישור ללקוח
      </Button>
    );
  }

  return (
    <Card className="bg-slate-950/60 border-blue-500/30 mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-slate-100 text-base">קישור Onboarding ללקוח של {partner.name}</CardTitle>
        <CardDescription className="text-slate-400 text-xs">
          קישור חד-פעמי, מאובטח, פג תוך 24 שעות.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!result ? (
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 text-xs">שם הלקוח</Label>
                <Input
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  placeholder="ישראל ישראלי"
                  className="bg-slate-900 border-slate-800 text-slate-200 mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">אימייל</Label>
                <Input
                  value={form.customer_email}
                  onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                  placeholder="customer@example.com"
                  dir="ltr"
                  className="bg-slate-900 border-slate-800 text-slate-200 mt-1 text-left"
                />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">טלפון (לוואטסאפ)</Label>
                <Input
                  value={form.customer_phone}
                  onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                  placeholder="972501234567"
                  dir="ltr"
                  className="bg-slate-900 border-slate-800 text-slate-200 mt-1 text-left"
                />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">סכום מבוקש (₪)</Label>
                <Input
                  type="number"
                  value={form.requested_amount}
                  onChange={(e) => setForm({ ...form, requested_amount: e.target.value })}
                  placeholder="50000"
                  className="bg-slate-900 border-slate-800 text-slate-200 mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => { setOpen(false); reset(); }} className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
                ביטול
              </Button>
              <Button type="submit" size="sm" disabled={creating} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LinkIcon className="w-3.5 h-3.5" />}
                צור קישור
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-300 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              הקישור מוכן לשליחה ללקוח
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-md p-2 break-all text-xs text-slate-300" dir="ltr">
              {result.link}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => copy(result.link)} className="border-slate-700 text-slate-200 hover:bg-slate-800 gap-2">
                <Copy className="w-3.5 h-3.5" /> העתק
              </Button>
              <Button size="sm" variant="outline" onClick={() => sendWhatsApp(form.customer_phone, result.link)} className="border-emerald-700/40 text-emerald-300 hover:bg-emerald-500/10 gap-2">
                <Send className="w-3.5 h-3.5" /> WhatsApp
              </Button>
              <Button size="sm" variant="outline" onClick={() => sendEmail(form.customer_email, result.link)} className="border-blue-700/40 text-blue-300 hover:bg-blue-500/10 gap-2">
                <Send className="w-3.5 h-3.5" /> אימייל
              </Button>
              <Button size="sm" variant="ghost" onClick={reset} className="text-slate-400 hover:text-slate-200 hover:bg-slate-800">
                צור קישור נוסף
              </Button>
            </div>
            <p className="text-[10px] text-slate-500">
              פג תוקף: {new Date(result.expires_at).toLocaleString('he-IL')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}