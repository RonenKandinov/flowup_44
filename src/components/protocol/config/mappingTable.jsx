/**
 * MILLENNIUM PROTOCOL - MAPPING TABLE (ENHANCED)
 * Proprietary IP by Ronen Kandinov (c) 2026
 * 
 
 */

export const CATEGORY_MAPPING = {
    // === הכנסות ===
    SALARY: {
        id: 1100,
        name: 'salary',
        displayName: 'משכורת',
        shadowType: 'DEF', // הגנה על התקציב
        element: 'LIGHT',
        monster: 'Blue-Eyes White Dragon' // המגן הראשי
    },
    BONUS_INCOME: {
        id: 1200,
        name: 'bonus',
        displayName: 'בונוס',
        shadowType: 'DEF',
        element: 'DARK',
        monster: 'Dark Magician' // קסם בלתי צפוי
    },

    // === הוצאות קבועות וכבדות ===
    RENT_MORTGAGE: {
        id: 2100,
        name: 'rent_mortgage',
        displayName: 'שכירות/משכנתא',
        shadowType: 'ATK', // תוקף את התקציב
        element: 'EARTH',
        monster: 'Gaia The Fierce Knight' // אביר אדיר ותמיד נוכח
    },
    GROCERIES: {
        id: 2200,
        name: 'groceries',
        displayName: 'קניות בסופר',
        shadowType: 'ATK',
        element: 'EARTH',
        monster: 'Celtic Guardian' // שומר בסיס הבית
    },
    UTILITIES: {
        id: 2300,
        name: 'utilities',
        displayName: 'חשבונות',
        shadowType: 'TRAP', // מלכודת חודשית
        element: 'LIGHT',
        monster: 'Swords of Revealing Light' // מתגלים בסוף החודש
    },

    // === הוצאות משתנות ופנאי ===
    ENTERTAINMENT: {
        id: 2400,
        name: 'entertainment',
        displayName: 'בידור ופנאי',
        shadowType: 'ATK',
        element: 'WIND',
        monster: 'Mystical Elf' // קליל ומשתנה
    },
    TRANSPORT: {
        id: 2500,
        name: 'transport',
        displayName: 'תחבורה',
        shadowType: 'ATK',
        element: 'WIND',
        monster: 'Winged Dragon, Guardian of the Fortress' // תמיד בתנועה
    },

    // === הוצאות נסתרות/בעייתיות ===
    SUBSCRIPTIONS_DUPE: {
        id: 2600,
        name: 'subscriptions_dupe',
        displayName: 'מנויים כפולים',
        shadowType: 'ATK',
        element: 'DARK',
        monster: 'Man-Eater Bug' // זולל כסף בחשאי
    },

    // === חיסכון והשקעות ===
    SAVINGS: {
        id: 3100,
        name: 'savings',
        displayName: 'חיסכון',
        shadowType: 'SPELL',
        element: 'LIGHT',
        monster: 'Pot of Greed' // מגדיל את היד
    },
    LONG_TERM_REAL_ESTATE: {
        id: 3200,
        name: 'long_term_real_estate',
        displayName: 'השקעת נדל"ן (טווח ארוך)',
        shadowType: 'DEF', // הגנה וצמיחה לטווח ארוך
        element: 'EARTH',
        monster: 'Green-Eyes White Dragon' // המיוחד שלך!
    },
    INVESTMENTS_HIGH_RISK: {
        id: 3300,
        name: 'investments_high_risk',
        displayName: 'השקעות בסיכון גבוה',
        shadowType: 'SPELL',
        element: 'DARK',
        monster: 'Exodia The Forbidden One' // הכל או כלום
    },

    // === לא מזוהה ===
    UNKNOWN: {
        id: 9999,
        name: 'unknown',
        displayName: 'לא מזוהה',
        shadowType: 'NEUTRAL',
        element: 'NEUTRAL',
        monster: 'Kuriboh' // מגן מפני מכה חזקה
    }
};

// Reverse lookup utility
export const getCategoryById = (id) => {
    return Object.values(CATEGORY_MAPPING).find(c => c.id === id);
};

export const getCategoryByName = (name) => {
    return Object.values(CATEGORY_MAPPING).find(c => c.name === name);
};