import React, { useRef, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';

const fmt = (n) => Math.round(Number(n || 0)).toLocaleString('en-US');

// One-click "Underwriting Memo" — renders a hidden, styled A4 document and exports
// it as PDF via html2canvas → jsPDF (Hebrew-safe: rendered as image, not native text).
export default function UnderwritingMemo({ metrics, insights, customerId }) {
  const docRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = async () => {
    if (!docRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(docRef.current, { scale: 2, backgroundColor: '#ffffff' });
      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const w = 210;
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(img, 'PNG', 0, 0, w, Math.min(h, 297));
      pdf.save(`FlowUp_Memo_${customerId || 'client'}_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('מזכר החיתום הופק בהצלחה');
    } catch (e) {
      console.error('Memo export failed:', e);
      toast.error('הפקת המזכר נכשלה — נסה שוב');
    }
    setIsExporting(false);
  };

  if (!metrics) return null;

  const p = metrics.positiveSignals || {};
  const tier = insights?.risk_tier || (metrics.status === 'GREEN' ? 'Green' : metrics.status === 'RED' ? 'Red' : 'Orange');
  const tierColor = tier === 'Green' ? '#059669' : tier === 'Red' ? '#dc2626' : '#d97706';
  const positives = [];
  if (p.surplusCreation?.detected) positives.push(`יצירת עודף חודשי עקבי: ₪${fmt(p.surplusCreation.monthlySurplus)} (${p.surplusCreation.surplusRatio}% מההכנסה)`);
  if (p.financialDiscipline?.detected) positives.push('משמעת פיננסית — הוצאות יציבות ללא קפיצות אימפולסיביות');
  if (p.upwardMobility?.detected) positives.push(`מוביליות כלפי מעלה — צמיחת הכנסה של ${p.upwardMobility.growthPct}%`);
  if (p.wealthBuilding?.detected) positives.push(`בניית הון — ₪${fmt(p.wealthBuilding.monthlyOutflow)}/חודש מנותב לחיסכון והשקעות`);
  if (p.resilience?.recovered) positives.push('חוסן פיננסי — התאושש מחודש קשה ללא כניסה למינוס');

  return (
    <>
      <Button
        onClick={exportPdf}
        disabled={isExporting}
        variant="ghost"
        size="sm"
        className="bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/40 hover:text-white transition-all h-8 px-3 rounded-md shadow-sm shadow-emerald-500/10"
      >
        {isExporting ? <Loader2 className="w-3 h-3 ml-1.5 animate-spin" /> : <FileText className="w-3 h-3 ml-1.5" />}
        <span className="text-[11px] font-medium">מזכר חיתום PDF</span>
      </Button>

      {/* Hidden A4 document rendered off-screen for the export */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
        <div ref={docRef} dir="rtl" style={{ width: '794px', padding: '48px', background: '#ffffff', color: '#0f172a', fontFamily: 'Arial, sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #0891b2', paddingBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0891b2' }}>FlowUp</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>מזכר חיתום — Positive Underwriting Memo</div>
            </div>
            <div style={{ textAlign: 'left', fontSize: '11px', color: '#64748b' }}>
              <div>לקוח: {customerId || '—'}</div>
              <div>תאריך: {new Date().toLocaleDateString('he-IL')}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', margin: '24px 0' }}>
            {[
              { label: 'ציון FlowUp', value: `${metrics.score ?? 0}/100`, color: tierColor },
              { label: 'רמת סיכון', value: tier, color: tierColor },
              { label: 'Opportunity Score', value: `${p.opportunityScore || 0}/100`, color: '#059669' },
              { label: 'DTI', value: `${Math.round(metrics.dti || 0)}%`, color: '#0f172a' },
            ].map((b, i) => (
              <div key={i} style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: b.color }}>{b.value}</div>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>{b.label}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>נתונים פיננסיים (ממוצע 12 חודשים)</div>
          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', marginBottom: '24px' }}>
            <tbody>
              {[
                ['הכנסה חודשית ממוצעת', `₪${fmt(metrics.totalIncome)}`],
                ['הוצאות חודשיות ממוצעות', `₪${fmt(metrics.totalExpenses)}`],
                ['הוצאות קבועות', `₪${fmt(metrics.totalFixedExpenses)}`],
                ['נכסים נזילים', `₪${fmt(metrics.liquidAssets)}`],
              ].map(([k, v], i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 0', color: '#475569' }}>{k}</td>
                  <td style={{ padding: '8px 0', fontWeight: 'bold', textAlign: 'left' }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {positives.length > 0 && (
            <>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#059669', marginBottom: '8px' }}>סיגנלים חיוביים — נימוקי אישור</div>
              <ul style={{ fontSize: '12px', color: '#334155', paddingRight: '20px', marginBottom: '24px', lineHeight: 1.8 }}>
                {positives.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </>
          )}

          {(insights?.executive_summary || insights?.narrative) && (
            <>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>תמצית מנהלים (AI Analyst)</div>
              <p style={{ fontSize: '12px', color: '#334155', lineHeight: 1.8, marginBottom: '24px' }}>
                {insights.executive_summary || insights.narrative}
              </p>
            </>
          )}

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', fontSize: '9px', color: '#94a3b8' }}>
            מסמך זה הופק אוטומטית על ידי מנוע החיתום של FlowUp על בסיס נתוני Open Finance. אינו מהווה ייעוץ פיננסי או התחייבות למתן אשראי. ההחלטה הסופית נתונה לגוף המממן בלבד.
          </div>
        </div>
      </div>
    </>
  );
}