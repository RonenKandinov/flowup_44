// FlowUp Credit Justification Engine
// Generates formal, audit-ready credit justifications per strategy.
// Aligned with Deal Rescuer spec (Stage 6): risk level by margin, strategy-aware language.

const POLICY_DSR_THRESHOLD_DEFAULT = 40; // %, only used as a fallback when no threshold is passed

/**
 * Classify by DSR margin/overflow vs the ACTIVE policy threshold
 * (comes from UnderwritingRule.max_dti_approve — pass it in as `threshold`).
 *   DSR <= threshold:   margin = threshold - dsr
 *     margin > 15 → low
 *     5 ≤ margin ≤ 15 → medium
 *     margin < 5 → borderline
 *   DSR > threshold:
 *     overflow ≤ 5 → elevated (conditional)
 *     overflow > 5 → high (exception)
 */
function classify(dsr, threshold = POLICY_DSR_THRESHOLD_DEFAULT) {
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

// 1) Policy compliance / deviation
function policyComplianceSentence(dsr, withinPolicy, approvalType, threshold) {
    if (withinPolicy) {
        return `המבנה המוצע עומד ביחס החזר של ${dsr}%, הנמוך מסף המדיניות של ${threshold}%`;
    }
    if (approvalType === 'conditional_approval') {
        return `הבקשה חורגת ממדיניות האשראי ביחס החזר של ${dsr}% ומוגדרת כאישור מותנה הדורש שיקול דעת נוסף`;
    }
    return `הבקשה חורגת באופן מהותי ממדיניות האשראי ביחס החזר של ${dsr}% ומוגדרת כחריגה הדורשת אישור פרטני`;
}

// 2) Affordability — strategy-aware
function affordabilitySentence(strategyType, risk, withinPolicy) {
    if (strategyType === 'cash_flow_alignment') {
        return withinPolicy
            ? 'הפריסה המוצעת מקטינה את העומס החודשי ומשמרת יציבות תזרימית'
            : 'הפריסה המוצעת נועדה להקל על העומס החודשי תחת פיקוח תזרימי הדוק';
    }
    if (strategyType === 'exposure_reduction') {
        return withinPolicy
            ? 'הקטנת הסכום והחשיפה מפחיתה את הסיכון הכולל ותואמת את כושר ההחזר'
            : 'הקטנת הסכום תורמת להפחתת חשיפה, אם כי כושר ההחזר נותר תחת בחינה מוגברת';
    }
    // behavioral_approval
    if (withinPolicy) {
        return 'ההחזר החודשי תואם את כושר ההחזר של הלקוח בהתבסס על התנהלות פיננסית יציבה';
    }
    return 'החריגה נשלטת ונבחנת על בסיס התנהלות פיננסית עקבית ויכולת החזר מוכחת';
}

// 3) Risk control
function riskControlSentence(risk) {
    switch (risk) {
        case 'low': return 'רמת הסיכון נמוכה ומבוקרת.';
        case 'medium': return 'רמת הסיכון נמצאת בטווח מבוקר.';
        case 'borderline': return 'האישור ניתן תחת תנאים שמרניים לניהול סיכון.';
        case 'elevated': return 'רמת הסיכון גבוהה מהסטנדרט ומנוהלת תחת מעקב מוגבר.';
        case 'high': return 'רמת הסיכון גבוהה ומחייבת ניהול הדוק ותנאים מגבילים.';
        default: return 'רמת הסיכון נמצאת תחת ניהול שוטף.';
    }
}

// 4) Optional supporting factor
function supportingFactor(strategy, insights) {
    const liquidity = Number(insights?.liquidityMonths ?? strategy?.liquidityMonths);
    const incomeTrend = insights?.incomeTrend ?? strategy?.incomeTrend;
    if (Number.isFinite(liquidity) && liquidity >= 1.5) {
        return `נזילות זמינה של ${liquidity.toFixed(1)} חודשים תומכת בעמידה בהחזרים`;
    }
    if (incomeTrend === 'improving' || incomeTrend === 'up') {
        return 'מגמת שיפור בהכנסות מחזקת את יציבות ההחזר';
    }
    return null;
}

export function buildCreditJustification(strategy, insights = {}, policyThreshold = POLICY_DSR_THRESHOLD_DEFAULT) {
    const dsr = Number(strategy?.dsr ?? 0);
    const strategyType = strategy?.type || 'behavioral_approval';
    const threshold = Number(policyThreshold) || POLICY_DSR_THRESHOLD_DEFAULT;
    const { approvalType, risk, withinPolicy } = classify(dsr, threshold);

    const sentences = [
        policyComplianceSentence(dsr, withinPolicy, approvalType, threshold),
        affordabilitySentence(strategyType, risk, withinPolicy)
    ];
    const support = supportingFactor(strategy, insights);
    if (support) sentences.push(support);

    const paragraph = sentences.join(', ') + '. ' + riskControlSentence(risk);

    return { paragraph, approvalType, risk, withinPolicy };
}