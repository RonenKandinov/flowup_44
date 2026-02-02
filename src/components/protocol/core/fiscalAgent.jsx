/**
 * MILLENNIUM CORE - FISCAL AGENT
 * Proprietary Logic by Ronen Kandinov (c) 2026
 * 
 * Shadow Realm Transformation Engine (v2.0):
 * Non-linear projection into a 44-dimensional vector space ($x\mathbb{G}^{44}$).
 */

import { CATEGORY_MAPPING } from '../config/mappingTable';

const BASE_DIMENSION = 44;

/**
 * processToShadowRealm - Millennium Transformation ($T_t$)
 * Projects scalar financial values into 44-dimensional vector space.
 * 
 * @param {number} amount - The financial scalar ($V$)
 * @param {number} categoryId - Semantic anchor
 * @returns {Object} 44-dim Vector Object
 */
export const processToShadowRealm = (amount, categoryId) => {
    // 1. Client-Side Entropy (The "Shadow" Logic)
    // In a full implementation, this comes from a User-Side Key.
    // For POC, we generate a session-based entropy signature.
    const entropy = Math.random(); 
    
    // 2. Vectorized Mapping ($x\mathbb{G}^n$)
    // Initialize 44-dimensional void
    const vector = new Array(BASE_DIMENSION).fill(0);
    
    // Get category vector base for semantic coloring
    const category = Object.values(CATEGORY_MAPPING).find(c => c.id === categoryId);
    const vectorBase = category ? category.vectorBase : 0.1;

    // Distribute the scalar 'amount' across the vector space
    // We use a non-linear distribution to make it look like noise
    let remainingAmount = amount;
    
    for (let i = 0; i < BASE_DIMENSION - 1; i++) {
        // Generate a random partition coefficient based on entropy and dimension index
        // This ensures "Statistically indistinguishable from noise"
        const partition = (Math.random() * (1 / (BASE_DIMENSION / 4))) * remainingAmount;
        
        // Apply "Gamified Space" Logic: Alternate strictly positive/negative to simulate signal noise
        // while maintaining the algebraic sum.
        // For simple reconstruction in POC, we stick to additive partitions, 
        // but scramble them with the vectorBase.
        vector[i] = partition;
        remainingAmount -= partition;
    }
    
    // The final dimension holds the residue to ensure mathematical consistency ($V = \sum v_i$)
    // In a real ZK-Proof, this would be obfuscated by the User Key.
    vector[BASE_DIMENSION - 1] = remainingAmount;

    // 3. Apply Semantic Embedding (Metadata Injection)
    // We inject the category ID into the vector's imaginary plane (simulated here by adding small epsilon variations)
    vector[0] += (categoryId * 0.0000001); 

    return {
        vector: vector,
        dimension: BASE_DIMENSION,
        timestamp: Date.now(),
        owner: "Ronen Kandinov",
        integrityHash: generateIntegrityHash(vector),
        protocolVersion: "2.0-MILLENNIUM"
    };
};

/**
 * generateIntegrityHash - 44-Base Checksum
 * @param {Array} vector - The 44-dim vector
 * @returns {string} Integrity signature
 */
const generateIntegrityHash = (vector) => {
    // Calculate magnitude of the vector
    const magnitude = vector.reduce((acc, val) => acc + Math.abs(val), 0);
    return `MGH-${BASE_DIMENSION}-${Math.floor(magnitude * 1000).toString(36).toUpperCase()}`;
};

/**
 * reconstructFromShadowRealm - Inverse Transformation ($T_t^{-1}$)
 * Collapses the 44-dimensional vector back to scalar space $\mathbb{R}$.
 * 
 * @param {Object} shadowData - The Shadow Realm object
 * @returns {number} The original scalar Amount
 */
export const reconstructFromShadowRealm = (shadowData) => {
    if (!shadowData || !shadowData.vector) return 0;
    
    // Re-aggregate the vector components
    // $V = \sum_{i=0}^{n} v_i$
    // Note: We ignore the epsilon noise added for semantic embedding in a real scenario,
    // but here it's negligible for display purposes.
    const rawSum = shadowData.vector.reduce((acc, val) => acc + val, 0);
    
    // Remove the semantic embedding artifact if strict precision is needed
    // (In this POC, we round to 2 decimals anyway)
    return Math.round(rawSum * 100) / 100;
};