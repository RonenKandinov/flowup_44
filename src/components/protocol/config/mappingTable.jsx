/**
 * MILLENNIUM PROTOCOL - MAPPING TABLE
 * Proprietary IP by Ronen Kandinov (c) 2026
 * 
 * Semantic Category Mapping: המילון המרכזי שמחבר בין קטגוריות פיננסיות
 * לוקטורים מוצפנים במרחב Shadow Realm.
 */

export const CATEGORY_MAPPING = {
    INCOME: {
        id: 1000,
        name: 'income',
        displayName: 'הכנסה',
        shadowType: 'ATK'
    },
    EXPENSE: {
        id: 2000,
        name: 'expense',
        displayName: 'הוצאה',
        shadowType: 'DEF'
    },
    TRANSFER: {
        id: 3000,
        name: 'transfer',
        displayName: 'העברה',
        shadowType: 'SPELL'
    },
    RECURRING: {
        id: 4000,
        name: 'recurring',
        displayName: 'קבועה',
        shadowType: 'TRAP'
    },
    UNKNOWN: {
        id: 9999,
        name: 'unknown',
        displayName: 'לא מזוהה',
        shadowType: 'NEUTRAL'
    }
};

// Reverse lookup utility
export const getCategoryById = (id) => {
    return Object.values(CATEGORY_MAPPING).find(c => c.id === id);
};

export const getCategoryByName = (name) => {
    return Object.values(CATEGORY_MAPPING).find(c => c.name === name);
};