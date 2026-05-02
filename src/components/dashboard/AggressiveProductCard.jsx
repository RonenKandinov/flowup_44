import React from 'react';
import { Zap, AlertTriangle } from 'lucide-react';

// Profit-margin → categorical label (no raw ₪ — same wording as the rest of the UI).
const profitabilityLabel = (margin) => {
    if (!Number.isFinite(margin)) return null;
    if (margin >= 0.05) return { text: 'רווחיות גבוהה', tone: 'text-emerald-300' };
    if (margin >= 0.02) return { text: 'רווחיות תקינה', tone: 'text-emerald-300' };
    if (margin >= 0)    return { text: 'רווחיות גבולית', tone: 'text-amber-300' };
    return { text: 'סיכון גבוה ביחס לרווח', tone: 'text-red-300' };
};

const formatILS = (n) => `₪${Number(n || 0).toLocaleString('he-IL')}`;

/**
 * AggressiveProductCard — renders the aggressive_approval product as a
 * SEPARATE offer card (not one of the standard strategies).
 *
 * The product has its own framing:
 *   • Distinct visual identity (amber border + lightning icon + "מוצר נפרד" badge)
 *   • A header explaining it's a different product class with different terms
 *   • The same profitability-as-words convention as the strategy cards
 */
export default function AggressiveProductCard({ product }) {
    if (!product) return null;
    const lbl = profitabilityLabel(product.profitMargin);

    return (
        <div className="rounded-lg border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-slate-900/60 p-3">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <Zap className="w-3.5 h-3.5" />
                    {product.productLabel || 'מוצר אישור אגרסיבי'}
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-200 font-bold">
                    מוצר נפרד
                </span>
            </div>

            <div className="flex items-start gap-1.5 text-[10px] text-amber-100/80 mb-2 leading-4">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>תנאים שונים מהאישור הסטנדרטי — DSR גבוה יותר, ריבית גבוהה יותר, תקופה ארוכה יותר. דורש סקירה ידנית של פקיד אשראי.</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300 mb-2">
                <div>
                    <div className="text-slate-500 text-[10px]">סכום</div>
                    <div className="text-white font-medium">{formatILS(product.loanAmount)}</div>
                </div>
                <div>
                    <div className="text-slate-500 text-[10px]">תקופה</div>
                    <div className="text-white font-medium">{product.termMonths} ח׳</div>
                </div>
                <div>
                    <div className="text-slate-500 text-[10px]">החזר חודשי</div>
                    <div className="text-white font-medium">{formatILS(product.monthlyPayment)}</div>
                </div>
                <div>
                    <div className="text-slate-500 text-[10px]">ריבית</div>
                    <div className="text-white font-medium">{product.interestRate}%</div>
                </div>
                <div>
                    <div className="text-slate-500 text-[10px]">דירוג</div>
                    <div className="text-amber-300 font-medium">Tier {product.tier || 'C'}</div>
                </div>
                <div>
                    <div className="text-slate-500 text-[10px]">DSR חדש</div>
                    <div className="text-amber-300 font-medium">{product.dsr}%</div>
                </div>
            </div>

            {lbl && (
                <div className="rounded-md bg-slate-950/60 border border-slate-800/80 px-2 py-1 flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">תמחור מול סיכון</span>
                    <span className={`font-semibold ${lbl.tone}`}>{lbl.text}</span>
                </div>
            )}
        </div>
    );
}