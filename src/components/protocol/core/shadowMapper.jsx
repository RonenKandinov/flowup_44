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

const PRECISION_SCALE = 1000; // Normalization Scale (Vortex Edition)
const ENTROPY_FACTOR = 1000000; // Entropy Multiplier
const EPSILON = Number.EPSILON;

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

        // 1. Normalization (Prevent large number artifacts)
        // Scale down to unit range (approx) to preserve floating point precision in rotation
        const normalizedAmount = data.amount / PRECISION_SCALE;

        // 2. The Theta Rotation (Secret Angle from Master Key)
        // Vortex Engine - Millennium Edition: High Entropy Factor
        const theta = (userKeyFactor * ENTROPY_FACTOR) % (2 * Math.PI);
        
        // 3. Vector Rotation (The "Gold Vector" Rotation)
        // Rotate the scalar vector (x, 0) into the Shadow Plane (x', y')
        // magnitude = x_norm * cos(theta)
        // phantom   = x_norm * sin(theta)
        const magnitude = normalizedAmount * Math.cos(theta);
        const phantom = normalizedAmount * Math.sin(theta);
        
        return {
            magnitude: magnitude, 
            phantom: phantom,   
            angle_hash: hash(theta),
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

        // 1. Regenerate Theta
        // Vortex Engine - Millennium Edition: High Entropy Factor
        const theta = (userKeyFactor * ENTROPY_FACTOR) % (2 * Math.PI);
        
        // 2. Reverse Rotation (Mathematical Restoration)
        // normalized_amount = magnitude * cos(theta) + phantom * sin(theta)
        // This leverages the identity: cos^2 + sin^2 = 1, avoiding division by zero errors.
        const normalizedAmount = (shadowData.magnitude * Math.cos(theta)) + (shadowData.phantom * Math.sin(theta));

        // 3. Denormalization (Restore Scale)
        let amount = normalizedAmount * PRECISION_SCALE;

        // 4. Floating Point Shield
        // Eliminate micro-fractions that occur due to IEEE 754 floating point math
        if (Math.abs(amount) < EPSILON * 1000) {
            amount = 0;
        } else {
            // Round to 2 decimal places carefully
            amount = Math.round((amount + EPSILON) * 100) / 100;
        }

        return {
            amount: amount,
            date: shadowData.date
        };
    }
}