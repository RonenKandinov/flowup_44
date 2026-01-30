/**
 * Strategic Brain Agent (The CEO)
 * --------------------------------
 * This agent does not scan transactions directly.
 * Instead, it scans the *outputs* of other agents (Fiscal, Liquidity, Trend).
 * 
 * Goals:
 * 1. Cross-Reference: Connect insights (e.g., use tax refund to close a deficit).
 * 2. Prioritization: Rank by "Low Hanging Fruit" (Ease of Execution vs Value).
 * 3. Natural Language Summary: Generate a human-like financial summary.
 */

export const runStrategicBrainAgent = (insights) => {
    if (!insights || insights.length === 0) return null;

    // 1. Analyze the Mix
    const moneyLeaks = insights.filter(i => i.type === 'money_leak');
    const taxRefunds = insights.filter(i => i.type === 'tax_refund');
    const lifestyle = insights.filter(i => i.type === 'lifestyle' || i.type === 'info');
    const alerts = insights.filter(i => i.type === 'alert');

    const totalPotentialSavings = insights.reduce((sum, i) => sum + (i.annualImpact || 0), 0);
    const monthlySavings = insights.reduce((sum, i) => sum + (i.monthlySavings || 0), 0);

    // 2. Identify "Low Hanging Fruit" (Quick Wins)
    // Money Leaks are the easiest to fix (usually just a phone call or click)
    const quickWins = moneyLeaks.reduce((sum, i) => sum + (i.monthlySavings || 0), 0);

    // 3. Generate Strategy Narrative
    let title = "סיכום מצב אסטרטגי";
    let summary = "";
    let actionItem = "";
    let mood = "neutral"; // neutral, happy, urgent

    // Scenario A: Significant "Found Money" (Tax Refunds + Leaks)
    if (totalPotentialSavings > 2000) {
        title = "מצאתי הזדמנויות משמעותיות";
        mood = "happy";
        
        const refundTotal = taxRefunds.reduce((sum, i) => sum + (i.annualImpact || 0), 0);
        
        if (refundTotal > 1000 && quickWins > 100) {
            // Cross-Reference: Refund + Leaks
            summary = `זיהיתי פוטנציאל של ₪${Math.round(totalPotentialSavings).toLocaleString()} שניתן להחזיר לכיס השנה. שילוב של החזרי מס (₪${Math.round(refundTotal)}) ועצירת דליפות קטנות (₪${Math.round(quickWins)}/חודש).`;
            actionItem = "התחל עם עצירת הדליפות - זה הכסף הכי קל לאיסוף.";
        } else if (refundTotal > 0) {
            summary = `הכסף הגדול נמצא בהחזרי המס שלך (₪${Math.round(refundTotal)}). זה דורש מעט בירוקרטיה, אבל התמורה גבוהה.`;
            actionItem = "מומלץ להתמקד בהגשת בקשה להחזר מס תחילה.";
        } else {
             summary = `יש לך הזדמנות לחסוך ₪${Math.round(totalPotentialSavings)} בשנה רק על ידי אופטימיזציה של תשלומים קיימים.`;
             actionItem = "עבור על רשימת הכפילויות והמנויים למטה.";
        }
    } 
    // Scenario B: Lots of Small Leaks
    else if (moneyLeaks.length >= 2) {
        title = "יש כאן 'כסף על הרצפה'";
        mood = "urgent";
        summary = `מצאתי ${moneyLeaks.length} מקומות שבהם כסף דולף סתם. זה אולי נראה מעט בנפרד, אבל מצטבר ל-₪${Math.round(quickWins * 12)} בשנה.`;
        actionItem = "זה ה-Low Hanging Fruit שלך. שיחת טלפון אחת או שתיים יסגרו את זה.";
    }
    // Scenario C: Lifestyle Issues Only
    else if (lifestyle.length > 0) {
        title = "אופטימיזציה של הרגלים";
        mood = "neutral";
        summary = "ההוצאות הקבועות נראות תקינות. הפוטנציאל העיקרי לשיפור נמצא בהוצאות המשתנות (מסעדות/בילויים).";
        actionItem = "שינוי קטן בהרגלי הצריכה יעשה את ההבדל הגדול ביותר כרגע.";
    }
    // Scenario D: Clean Slate
    else {
        title = "המצב נראה יציב";
        mood = "happy";
        summary = "לא זיהיתי דליפות חריגות או החזרי מס משמעותיים כרגע. ההתנהלות הפיננסית נראית מאוזנת.";
        actionItem = "המשך לעקוב, אעדכן אם אזהה משהו חדש.";
    }

    return {
        type: 'strategic_brain',
        title: title,
        description: summary,
        actionItem: actionItem,
        mood: mood,
        totalPotential: totalPotentialSavings,
        icon: 'BrainCircuit', // Needs to be mapped in InsightsAgent
        priority: 1000 // Always top
    };
};