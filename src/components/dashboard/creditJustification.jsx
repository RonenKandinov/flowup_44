// FlowUp Credit Justification Engine
// Generates formal, audit-ready credit justifications for approved loan strategies.
// Output: a single, consistent paragraph per strategy, grounded in policy metrics.

const POLICY_DSR_THRESHOLD = 40; // %

/**
 * Classify approval type and risk level based on DSR vs. policy threshold.
 * DSR <= threshold:
 *   margin > 15  → standard_approval / low risk
 *   5 ≤ margin ≤ 15 → standard_approval / medium risk
 *   margin < 5   → conditional_approval / borderline risk
 * DSR > threshold:
 *   overflow ≤ 5  → conditional_approval / elevated risk
 *   overflow > 5  → exception_case / high risk
 */
function classify(dsr, threshold = POLICY_DSR_THRESHOLD) {
    if (dsr <= threshold) {
        const margin = threshold - dsr;
        if (margin > 15) return { approvalType: 'standard_approval', risk: 'low', withinPolicy: true };
        if (margin >= 5) return { approvalType: 'standard_approval', risk: 'medium', withinPolicy: true };
        return { approvalType: 'conditional_approval', risk: 'borderline', withinPolicy: true };
    }
    const overflow = dsr - threshold;
    if (overflow <= 5) return { approvalType: 'conditional_approval', risk: 'elevated', withinPolicy: false };
    return { approvalType: 'exception_case', risk: 'high', withinPolicy: false };
}

function policyComplianceSentence(dsr, withinPolicy, approvalType) {
    if (withinPolicy) {
        return `המבנה המוצע עומד במדיניות האשראי ביחס החזר של ${dsr}%`;
    }
    if (approvalType === 'conditional_approval') {
        return `הבקשה חורגת ממדיניות האשראי ביחס החזר של ${dsr}% ומוגדרת כאישור מותנה הדורש שיקול דעת נוסף`;
    }
    return `הבקשה חורגת באופן מהותי ממדיניות האשראי ביחס החזר של ${dsr}% ומוגדרת כחריגה הדורשת אישור פרטני ושיקול דעת מנהלתי`;
}

function affordabilitySentence(risk, withinPolicy) {
    if (!withinPolicy) {
        return 'ההחזר החודשי נבחן אל מול כושר ההחזר של הלקוח ותחת בחינה מוגברת של עמידה עתידית בהתחייבות';
    }
    if (risk === 'low') {
        return 'ההחזר החודשי תואם את כושר ההחזר של הלקוח ומשאיר מרווח ביטחון מספק בתזרים החודשי';
    }
    return 'ההחזר החודשי תואם את כושר ההחזר של הלקוח';
}

function riskControlSentence(risk) {
    switch (risk) {
        case 'low': return 'רמת הסיכון נמוכה ומבוקרת.';
        case 'medium': return 'רמת הסיכון נמצאת בטווח מבוקר.';
        case 'borderline': return 'האישור ניתן תחת תנאים שמרניים לניהול סיכון.';
        case 'elevated': return 'רמת הסיכון גבוהה מהסטנדרט ומנוהלת תחת מעקב מוגבר.';
        case 'high': return 'רמת הסיכון גבוהה ומחייבת ניהול הדוק, מעקב תקופתי ותנאים מגבילים.';
        default: return 'רמת הסיכון נמצאת תחת ניהול שוטף.';
    }
}

function supportingFactors(strategy, insights) {
    const parts = [];
    const liquidity = Number(insights?.liquidityMonths ?? strategy?.liquidityMonths);
    const behavioral = Number(insights?.behavioralScore ?? strategy?.behavioralScore);
    const incomeTrend = insights?.incomeTrend ?? strategy?.incomeTrend;

    if (Number.isFinite(liquidity) && liquidity >= 1) {
        parts.push(`תומך בנזילות זמינה של ${liquidity.toFixed(1)} חודשים`);
    }
    if (strategy?.type === 'behavioral_approval' || (Number.isFinite(behavioral) && behavioral >= 70)) {
        parts.push('ובהתבסס על התנהלות פיננסית יציבה');
    }
    if (incomeTrend === 'improving' || incomeTrend === 'up') {
        parts.push('תוך מגמת שיפור בהכנסות');
    }
    return parts;
}

/**
 * Build the full credit justification paragraph + classification.
 * @param {object} strategy - { type, dsr, ... }
 * @param {object} insights - optional analysis insights
 * @returns {{ paragraph: string, approvalType: string, risk: string, withinPolicy: boolean }}
 */
export function buildCreditJustification(strategy, insights = {}) {
    const dsr = Number(strategy?.dsr ?? 0);
    const { approvalType, risk, withinPolicy } = classify(dsr);

    const sentences = [
        policyComplianceSentence(dsr, withinPolicy, approvalType),
        affordabilitySentence(risk, withinPolicy)
    ];

    const supporting = supportingFactors(strategy, insights);
    if (supporting.length > 0) sentences.push(supporting.join(', '));

    const paragraph = sentences.join(', ') + '. ' + riskControlSentence(risk);

    return { paragraph, approvalType, risk, withinPolicy };
}