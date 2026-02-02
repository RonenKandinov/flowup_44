/**
 * MILLENNIUM CORE - SHADOW MAPPER (xG² Logic)
 * Proprietary Logic by Ronen Kandinov (c) 2026
 * 
 * Minimalist data transformation layer mapping financial inputs 
 * into a simplified vector space (Shadow Realm).
 */

export class ShadowMapper {
    /**
     * Maps raw financial data to the Shadow Realm vector space.
     * @param {Object} data - Raw transaction object
     * @param {number} data.amount - The transaction amount
     * @param {string} data.date - ISO date string
     * @param {string} data.type - 'income' | 'expense'
     * @param {number} userKeyFactor - Unique user obfuscation factor
     * @returns {Object} Shadow object { date, magnitude, mode }
     */
    static toShadow(data, userKeyFactor) {
        if (!userKeyFactor || userKeyFactor === 0) {
            throw new Error("Millennium Protocol: Invalid UserKeyFactor for Shadow transformation.");
        }

        return {
            date: data.date,
            magnitude: data.amount * userKeyFactor,
            mode: data.type === 'income' ? 'DEF' : 'ATK'
        };
    }

    /**
     * Reconstructs original financial data from Shadow Realm vector.
     * @param {Object} shadowData - Shadow object { date, magnitude, mode }
     * @param {number} userKeyFactor - Unique user obfuscation factor
     * @returns {Object} Reconstructed data { amount, date, type }
     */
    static fromShadow(shadowData, userKeyFactor) {
        if (!userKeyFactor || userKeyFactor === 0) {
            throw new Error("Millennium Protocol: Invalid UserKeyFactor for Shadow reconstruction.");
        }

        return {
            amount: shadowData.magnitude / userKeyFactor,
            date: shadowData.date,
            type: shadowData.mode === 'DEF' ? 'income' : 'expense'
        };
    }
}