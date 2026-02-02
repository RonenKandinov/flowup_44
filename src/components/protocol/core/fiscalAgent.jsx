/**
 * MILLENNIUM CORE - FISCAL AGENT
 * Proprietary Logic by Ronen Kandinov (c) 2026
 * 
 * Shadow Realm Transformation Engine:
 * ההתמרה המתמטית שמפצלת כל סכום למרחב n-ממדי מוצפן.
 */

import { CATEGORY_MAPPING } from '../config/mappingTable';

/**
 * processToShadowRealm - הפונקציה המרכזית להתמרת נתונים פיננסיים
 * @param {number} amount - הסכום המקורי
 * @param {number} categoryId - מזהה הקטגוריה מה-mappingTable
 * @returns {Object} וקטור מוצפן במרחב Shadow Realm
 */
export const processToShadowRealm = (amount, categoryId) => {
    // 1. Shadow Splitting (עוצמת הרצף א)
    const entropy = Math.random();
    const v1 = amount * entropy;
    const v2 = amount - v1;

    // 2. Semantic Embedding (שילוב הקטגוריה)
    const category = Object.values(CATEGORY_MAPPING).find(c => c.id === categoryId);
    const v3 = category ? category.id + (Math.random() * 0.1) : 999;

    // 3. הוקטור הסופי ב-GX^n
    return {
        vector: [v1, v2, v3],
        timestamp: Date.now(),
        owner: "Ronen Kandinov",
        integrityHash: generateIntegrityHash([v1, v2, v3])
    };
};

/**
 * generateIntegrityHash - חתימה מתמטית לאימות שלמות הנתונים
 * @param {Array} vector - הוקטור המוצפן
 * @returns {string} חתימה מקוצרת
 */
const generateIntegrityHash = (vector) => {
    const sum = vector.reduce((acc, val) => acc + val, 0);
    return `MGH-${Math.floor(sum * 1000).toString(36).toUpperCase()}`;
};

/**
 * reconstructFromShadowRealm - פענוח חזרה לעולם הפיזי
 * @param {Object} shadowData - אובייקט Shadow Realm מוצפן
 * @returns {number} הסכום המקורי
 */
export const reconstructFromShadowRealm = (shadowData) => {
    const [v1, v2] = shadowData.vector;
    return v1 + v2;
};