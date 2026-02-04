/**
 * MILLENNIUM CORE - KEY CHAIN MANAGER
 * Proprietary Logic by Ronen Kandinov (c) 2026
 * 
 * מנהל את המפתחות הקריפטוגרפיים של הפרוטוקול.
 * אחראי לוודא שלכל משתמש יש "Master Key" (UserKeyFactor) ייחודי וקבוע.
 */

const STORAGE_KEY = 'MILLENNIUM_MASTER_KEY';
const DEFAULT_PRIME = 1.61803398875; // Golden Ratio base fallback

export const KeyChain = {
    /**
     * מבטיח קיום של מפתח על.
     * אם לא קיים - מייצר אחד חדש ומאובטח.
     * אם קיים - מחזיר את הקיים.
     * @returns {number} The Master Key Factor
     */
    ensureMasterKey: () => {
        let key = localStorage.getItem(STORAGE_KEY);
        
        if (!key) {
            console.log("🗝️ Millennium Protocol: Generating new Master Key...");
            // ייצור מפתח המבוסס על אנטרופיה וראשוניים
            const entropy = Math.random() * 100;
            const timeComponent = Date.now() % 1000;
            // יצירת פקטור ייחודי (למשל: 3.1415...) שאינו 0 או 1
            key = (entropy + (timeComponent / 1000) + Math.PI).toFixed(8);
            
            // שמירה באחסון המקומי
            localStorage.setItem(STORAGE_KEY, key);
        }
        
        return parseFloat(key);
    },

    /**
     * מחזיר את המפתח הנוכחי ללא יצירה מחדש (אם קיים)
     */
    getKey: () => {
        const key = localStorage.getItem(STORAGE_KEY);
        return key ? parseFloat(key) : null;
    },

    /**
     * מאפשר דריסה ידנית של המפתח (במקרה של שחזור)
     * @param {number} newKey 
     */
    setManualKey: (newKey) => {
        if (!newKey || isNaN(newKey)) throw new Error("Invalid Key");
        localStorage.setItem(STORAGE_KEY, newKey);
        console.log("🗝️ Millennium Protocol: Master Key updated manually.");
    },

    /**
     * השמדה עצמית של המפתח (חירום בלבד)
     */
    purgeKey: () => {
        localStorage.removeItem(STORAGE_KEY);
        console.warn("⚠️ Millennium Protocol: MASTER KEY PURGED. Data may be unreadable.");
    }
};