// FlowUp Credit Justification Engine
// Generates formal, audit-ready credit justifications for approved loan strategies.
// Output: a single, consistent paragraph per strategy, grounded in policy metrics.

const POLICY_DSR_THRESHOLD = 40; // %

/**
 * Classify risk based on safety margin from policy threshold.
 * margin > 15  → low
 * 5 ≤ margin ≤ 15 → medium
 * margin < 5   → borderline
 */
function classifyRisk(dsr, threshold = POLICY_DSR_THRESHOLD) {
    const margin = threshold - dsr;
    if (margin > 15) return { level: 'low', margin };
    if (margin >= 5) return { level: 'medium', margin };
    return { level: 'borderline', margin };
}

function riskControlSentence(level) {
    if (level === 'low') return 'רמת הסיכון נמוכה ומבוקרת.';
    if (level === 'medium') return 'רמת הסיכון נמצאת בטווח מבוקר.';
    return 'האישור ניתן תחת תנאים שמרניים לניהול סיכון.';
}

function affordabilitySentence(level) {
    // High margin → emphasize buffer, otherwise stick to baseline affordability.
    if (level === 'low') {
        return 'ההחזר החודשי תואם את כושר ההחזר של הלקוח ומשאיר מרווח ביטחון מספק בתזרים החודשי';
    }
    return 'ההחזר החודשי תואם את כושר ההחזר של הלקוח';
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
 * Build the full credit justification paragraph.
 * @param {object} strategy  - rescue strategy { type, dsr, ... }
 * @param {object} insights  - optional analysis insights from the engine
 * @returns {string}
 */
export function buildCreditJustification(strategy, insights = {}) {
    const dsr = Number(strategy?.dsr ?? 0);
    const threshold = POLICY_DSR_THRESHOLD;
    const { level } = classifyRisk(dsr, threshold);

    const sentences = [];

    // 1. Policy compliance
    sentences.push(
        `המבנה המוצע עומד ביחס החזר של ${dsr}%, הנמוך מסף המדיניות (${threshold}%)`
    );

    // 2. Affordability
    sentences.push(affordabilitySentence(level));

    // 3. Supporting factors (optional)
    const supporting = supportingFactors(strategy, insights);
    if (supporting.length > 0) {
        sentences.push(supporting.join(', '));
    }

    // 4. Risk control
    const paragraph = sentences.join(', ') + '. ' + riskControlSentence(level);

    return paragraph;
}