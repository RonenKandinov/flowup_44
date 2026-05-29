import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Copy, Key, Users, Link as LinkIcon, ShieldCheck, Eye, EyeOff, ArrowLeft, Plus, RefreshCw } from 'lucide-react';
// ArrowLeft used for RTL chevron
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function PartnerClientPortal() {
  const [showToken, setShowToken] = useState(false);

  const { data: partner, isLoading } = useQuery({
    queryKey: ['my-partner-profile'],
    queryFn: async () => {
      try {
        const list = await base44.entities.B2BPartner.list('-created_date', 1);
        return list[0] || null;
      } catch { return null; }
    }
  });

  const { data: sessions = [], isLoading: loadingSessions, refetch } = useQuery({
    queryKey: ['my-partner-sessions', partner?.id],
    enabled: !!partner?.id,
    queryFn: async () => {
      try {
        return await base44.entities.CustomerOnboardingSession.filter({ b2b_partner_id: partner.id }, '-created_date', 25);
      } catch { return []; }
    }
  });

  const copyToken = () => {
    if (!partner?.api_key) return;
    navigator.clipboard.writeText(partner.api_key);
    toast.success('הטוקן הועתק ללוח');
  };

  const statusColor = (s) => ({
    pending: 'bg-slate-500/20 text-slate-300',
    link_opened: 'bg-blue-500/20 text-blue-300',
    consent_started: 'bg-amber-500/20 text-amber-300',
    consent_granted: 'bg-amber-500/20 text-amber-300',
    analyzing: 'bg-cyan-500/20 text-cyan-300',
    completed: 'bg-emerald-500/20 text-emerald-300',
    expired: 'bg-red-500/20 text-red-300',
    failed: 'bg-red-500/20 text-red-300',
  })[s] || 'bg-slate-500/20 text-slate-300';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white" dir="rtl">
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <header className="relative z-10 px-6 py-8 max-w-6xl mx-auto border-b border-slate-800">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs text-cyan-400 tracking-widest mb-1">PARTNER PORTAL</div>
            <h1 className="text-3xl font-bold">{partner?.name || 'הפורטל שלי'}</h1>
            <p className="text-slate-400 text-sm mt-1">ניהול לקוחות, קישורי אונבורדינג וטוקן Open Finance</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="bg-slate-800/50 border-slate-700 text-slate-200 hover:bg-slate-700">
              <Link to="/for-partners"><ArrowLeft className="w-4 h-4 ml-2" />חזרה לדף שותפים</Link>
            </Button>
            <Button asChild className="bg-cyan-600 hover:bg-cyan-500">
              <Link to="/partners-admin"><Plus className="w-4 h-4 ml-2" />ניהול מתקדם</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-6 py-8 max-w-6xl mx-auto space-y-6">
        {/* API Token Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800/60 border-cyan-500/20 p-6">
            <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center border border-cyan-500/20">
                  <Key className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">טוקן API שלך</h3>
                  <p className="text-slate-400 text-xs mt-0.5">מקבלים אותו מ-FlowUp או מספק Open Finance שלך</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300">פעיל</span>
              </div>
            </div>

            {isLoading ? (
              <div className="h-12 bg-slate-800/60 rounded animate-pulse" />
            ) : partner?.api_key ? (
              <div className="flex gap-2">
                <div className="flex-1 bg-slate-950/60 border border-slate-700 rounded-lg px-4 py-3 font-mono text-sm text-slate-300 overflow-x-auto">
                  {showToken ? partner.api_key : '•'.repeat(Math.min(partner.api_key.length, 40))}
                </div>
                <Button onClick={() => setShowToken(!showToken)} variant="outline" className="bg-slate-800 border-slate-700">
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button onClick={copyToken} variant="outline" className="bg-slate-800 border-slate-700">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-sm text-amber-200">
                עדיין לא הוקצה לך טוקן. צוות FlowUp ייצור איתך קשר להפעלה, או פנה ל-<Link to="/for-partners" className="underline">דף ההצטרפות</Link>.
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-3 mt-5 pt-5 border-t border-slate-800">
              <div>
                <div className="text-xs text-slate-500">Webhook URL</div>
                <div className="text-sm text-slate-300 mt-1 truncate font-mono">{partner?.webhook_url || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">סטטוס</div>
                <div className="text-sm text-emerald-300 mt-1">{partner?.active ? 'פעיל' : 'לא פעיל'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">תיעוד API</div>
                <Link to="/developers" className="text-sm text-cyan-400 hover:underline mt-1 inline-block">לפורטל המפתחים →</Link>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Quick Create Onboarding Link */}
        <Card className="bg-slate-900/60 border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20">
                <LinkIcon className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">צור קישור אונבורדינג חדש</h3>
                <p className="text-slate-400 text-xs mt-0.5">שלח ללקוח קישור חד-פעמי לחיבור בנק דרך Open Finance</p>
              </div>
            </div>
            <Button asChild className="bg-blue-600 hover:bg-blue-500">
              <Link to="/partners-admin"><Plus className="w-4 h-4 ml-2" />יצירת קישור</Link>
            </Button>
          </div>
        </Card>

        {/* Sessions list */}
        <Card className="bg-slate-900/60 border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20">
                <Users className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">לקוחות אחרונים</h3>
                <p className="text-slate-400 text-xs mt-0.5">{sessions.length} סשנים</p>
              </div>
            </div>
            <Button onClick={() => refetch()} variant="outline" size="sm" className="bg-slate-800 border-slate-700">
              <RefreshCw className="w-3 h-3 ml-2" />רענן
            </Button>
          </div>

          {loadingSessions ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-14 bg-slate-800/40 rounded animate-pulse" />)}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              עדיין לא חיברת לקוחות. <Link to="/partners-admin" className="text-cyan-400 hover:underline">צור קישור ראשון</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => (
                <Link
                  key={s.id}
                  to={`/partner-portal/client/${s.id}`}
                  className="flex items-center justify-between bg-slate-950/40 border border-slate-800 rounded-lg p-3 hover:border-cyan-500/40 hover:bg-slate-900/60 transition-all cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-white text-sm truncate">{s.customer_name || s.customer_email || '—'}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{s.customer_email}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {s.requested_amount && (
                      <div className="text-xs text-slate-400">₪{Number(s.requested_amount).toLocaleString('he-IL')}</div>
                    )}
                    <span className={`text-xs px-2.5 py-1 rounded-full ${statusColor(s.status)}`}>{s.status}</span>
                    <ArrowLeft className="w-4 h-4 text-slate-600" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <div className="text-center text-xs text-slate-500 pt-4">
          כל פעולה נרשמת ב-AuditLog • הצפנה AES-256 • Open Finance תקני בנק ישראל
        </div>
      </main>
    </div>
  );
}