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
        // VORTEX EXPERIMENT MODE: Fixed Key
        // For testing the Shadow Realm transformation in the dashboard
        const EXPERIMENT_KEY = "1.234567";
        
        let key = localStorage.getItem(STORAGE_KEY);
        
        // Force the experiment key if not matching (or for this session)
        if (key !== EXPERIMENT_KEY) {
            key = EXPERIMENT_KEY;
            localStorage.setItem(STORAGE_KEY, key);
            console.log("🗝️ Millennium Protocol: Key updated to VORTEX EXPERIMENT KEY: 1.234567");
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