import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Loader2, Copy, Send, Link as LinkIcon, X } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Dual-purpose analyst gate:
 *  - "new customer" (empty screen) AND "switch customer" (already viewing one)
 * Flow: phone/id → create signed onboarding link (b2bService) → send to customer →
 * subscribe to the CustomerOnboardingSession in real time → on 'completed' fire
 * onCustomerActivated() so the Dashboard clears the old customer and loads the new one.
 */
export default function CustomerGateModal({ onClose, onCustomerActivated }) {
  const [phase, setPhase] = useState('form'); // form | sent | waiting
  const [creating, setCreating] = useState(false);
  const [partnerId, setPartnerId] = useState('');
  const [form, setForm] = useState({ name: '', customerId: '', phone: '' });
  const [session, setSession] = useState(null); // { session_id, link, expires_at }

  const { data: partners = [] } = useQuery({
    queryKey: ['active-partners'],
    queryFn: () => base44.entities.B2BPartner.filter({ active: true })
  });

  useEffect(() => {
    if (!partnerId && partners.length > 0) setPartnerId(partners[0].id);
  }, [partners, partnerId]);

  // Real-time: watch the onboarding session created for this customer.
  useEffect(() => {
    if (!session?.session_id) return;
    const unsub = base44.entities.CustomerOnboardingSession.subscribe((event) => {
      if (event.id !== session.session_id) return;
      const status = event.data?.status;
      if (status === 'completed') {
        toast.success('הלקוח סיים אימות — טוען נתונים');
        onCustomerActivated(event.data?.customer_id || form.customerId);
      } else if (['link_opened', 'consent_started', 'consent_granted', 'analyzing'].includes(status)) {
        setPhase('waiting');
      }
    });
    return () => { try { unsub && unsub(); } catch (_) {} };
  }, [session, form.customerId, onCustomerActivated]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('נא להזין שם לקוח'); return; }
    if (!/^[0-9]{9}$/.test(form.customerId.trim())) { toast.error('תעודת זהות חייבת להיות 9 ספרות'); return; }
    if (!/^[0-9]{9,15}$/.test(form.phone.replace(/\D/g, ''))) { toast.error('נא להזין מספר טלפון תקין'); return; }
    setCreating(true);
    try {
      const res = await base44.functions.invoke('b2bService', {
        action: 'create_onboarding_link',
        b2b_partner_id: partnerId,
        customer_name: form.name,
        customer_id: form.customerId.trim(),
        customer_phone: form.phone.trim(),
        base_url: window.location.origin
      });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      setSession(data);
      setPhase('sent');
    } catch (err) {
      toast.error(err?.message || 'יצירת הקישור נכשלה');
    } finally {
      setCreating(false);
    }
  };

  const copy = () => { navigator.clipboard.writeText(session.link); toast.success('הקישור הועתק'); };
  const sendWhatsApp = () => {
    const msg = `שלום, להמשך בקשת האשראי אנא חבר את חשבון הבנק שלך בקישור המאובטח: ${session.link}`;
    const clean = String(form.phone || '').replace(/\D/g, '');
    window.open(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden p-6"
      dir="rtl"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-blue-400" />
          </div>
          <h2 className="text-lg font-bold text-white">בחירת / החלפת לקוח</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-white h-8 w-8">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {phase === 'form' && (
        <form onSubmit={handleCreate} className="space-y-3">
          {partners.length > 1 && (
            <div>
              <Label className="text-slate-300 text-xs">שותף</Label>
              <Select value={partnerId} onValueChange={setPartnerId}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {partners.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-300 text-xs">שם הלקוח</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ישראל ישראלי" className="bg-slate-800 border-slate-700 text-slate-200 mt-1" />
            </div>
            <div>
              <Label className="text-slate-300 text-xs">תעודת זהות</Label>
              <Input value={form.customerId} maxLength="9" onChange={(e) => setForm({ ...form, customerId: e.target.value.replace(/\D/g, '') })} placeholder="9 ספרות" className="bg-slate-800 border-slate-700 text-slate-200 mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-slate-300 text-xs">טלפון</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="972501234567" dir="ltr" className="bg-slate-800 border-slate-700 text-slate-200 mt-1 text-left" />
          </div>
          <Button type="submit" disabled={creating} className="w-full bg-blue-600 hover:bg-blue-500 text-white h-11 gap-2">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
            צור ושלח קישור אימות
          </Button>
        </form>
      )}

      {(phase === 'sent' || phase === 'waiting') && (
        <div className="space-y-4 text-center">
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-2 break-all text-xs text-slate-300" dir="ltr">
            {session?.link}
          </div>
          <div className="flex gap-2 justify-center">
            <Button size="sm" variant="outline" onClick={copy} className="border-slate-700 text-slate-200 hover:bg-slate-800 gap-2"><Copy className="w-3.5 h-3.5" /> העתק</Button>
            <Button size="sm" variant="outline" onClick={sendWhatsApp} className="border-emerald-700/40 text-emerald-300 hover:bg-emerald-500/10 gap-2"><Send className="w-3.5 h-3.5" /> WhatsApp</Button>
          </div>
          <div className="flex items-center justify-center gap-2 text-cyan-300 text-sm pt-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            ממתין לסיום האימות של הלקוח...
          </div>
          <p className="text-[11px] text-slate-500">המסך יתעדכן אוטומטית ברגע שהלקוח יחבר את הבנק.</p>
        </div>
      )}
    </motion.div>
  );
}