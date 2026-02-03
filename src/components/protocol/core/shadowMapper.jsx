/**
 * MILLENNIUM CORE - SHADOW MAPPER (xG² Logic)
 * Proprietary Logic by Ronen Kandinov (c) 2026
 * 
 * Minimalist data transformation layer mapping financial inputs 
 * into a simplified vector space (Shadow Realm).
 */

// Internal hash utility for the protocol
function hash(val) {
    let str = String(val);
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    }
    return h.toString(16);
}

export class ShadowMapper {
    /**
     * Maps raw financial data to the Shadow Realm vector space.
     * @param {Object} data - Raw transaction object
     * @param {number} data.amount - The transaction amount
     * @param {string} data.date - ISO date string
     * @param {number} userKeyFactor - Unique user obfuscation factor (Master Key)
     * @returns {Object} Shadow object { magnitude, phantom, angle_hash, date }
     */
    static toShadow(data, userKeyFactor) {
        if (!userKeyFactor || userKeyFactor === 0) {
            throw new Error("Millennium Protocol: Invalid UserKeyFactor for Shadow transformation.");
        }

        // 1. Secret Angle Generation from Master Key
        const angle = (userKeyFactor * 1337) % (2 * Math.PI);
        
        // 2. Vector Transformation (Projection)
        // Transform the scalar amount into a point in 2D space
        const magnitudeX = data.amount * Math.cos(angle);
        const magnitudeY = data.amount * Math.sin(angle);
        
        return {
            magnitude: magnitudeX, // This is what gets stored in the DB (Projection)
            phantom: magnitudeY,   // The "Noise" that completes the vector (Hidden)
            angle_hash: hash(angle),
            date: data.date
        };
    }

    /**
     * Reconstructs original financial data from Shadow Realm vector.
     * @param {Object} shadowData - Shadow object
     * @param {number} userKeyFactor - Unique user obfuscation factor
     * @returns {Object} Reconstructed data { amount, date }
     */
    static fromShadow(shadowData, userKeyFactor) {
        if (!userKeyFactor || userKeyFactor === 0) {
            throw new Error("Millennium Protocol: Invalid UserKeyFactor for Shadow reconstruction.");
        }

        const angle = (userKeyFactor * 1337) % (2 * Math.PI);
        
        // Reverse the projection: amount = magnitude / cos(angle)
        // Note: Precision loss is possible near cos(angle) = 0
        const amount = shadowData.magnitude / Math.cos(angle);

        return {
            amount: amount,
            date: shadowData.date
        };
    }
}