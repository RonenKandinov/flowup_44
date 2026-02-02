/**
 * MILLENNIUM CORE - FISCAL AGENT
 * Proprietary Logic by Ronen Kandinov (c) 2026
 * 
 * The bridge between the physical world (User UI) and the Shadow Realm (DB/Encryption).
 * Ensures "Security by Nostalgia" is applied transparently.
 */

import { CATEGORY_MAPPING } from '../config/mappingTable';
import { KeyChain } from './keyChain';
import { ShadowMapper } from './shadowMapper';

export const FiscalAgent = {
    /**
     * Signs a transaction with the Millennium Protocol signatures.
     * Does NOT alter the visual data for the user, but attaches shadow metadata.
     * 
     * @param {Object} transaction - Standard transaction object
     * @returns {Object} Transaction enriched with hidden _shadow_metadata
     */
    signTransaction: (transaction) => {
        const masterKey = KeyChain.ensureMasterKey();
        
        // 1. Identify best semantic match (Monster Card)
        // This heuristic maps standard categories to our Shadow Archetypes
        let mapping = CATEGORY_MAPPING.UNKNOWN;
        
        if (transaction.amount > 0) {
            mapping = transaction.description.includes('משכורת') ? CATEGORY_MAPPING.SALARY : CATEGORY_MAPPING.BONUS_INCOME;
        } else {
            const desc = transaction.description.toLowerCase();
            if (desc.includes('שכר דירה') || desc.includes('משכנתא')) mapping = CATEGORY_MAPPING.RENT_MORTGAGE;
            else if (desc.includes('סופר') || desc.includes('מזון')) mapping = CATEGORY_MAPPING.GROCERIES;
            else if (desc.includes('חשמל') || desc.includes('מים') || desc.includes('ארנונה')) mapping = CATEGORY_MAPPING.UTILITIES;
            else if (desc.includes('ביט') || desc.includes('העברה')) mapping = CATEGORY_MAPPING.TRANSPORT;
            else mapping = CATEGORY_MAPPING.ENTERTAINMENT; // Default spending
        }

        // 2. Generate Shadow Vector (xG² Logic)
        const shadowVector = ShadowMapper.toShadow({
            amount: Math.abs(transaction.amount),
            date: transaction.date,
            type: transaction.amount > 0 ? 'income' : 'expense'
        }, masterKey);

        // 3. Attach Metadata (Hidden from standard UI)
        return {
            ...transaction,
            _shadow_metadata: {
                monster_card: mapping.monster,
                element: mapping.element,
                shadow_type: mapping.shadowType,
                vector_signature: shadowVector, // Encrypted Magnitude
                protocol_version: 'Millennium_1.0'
            }
        };
    }
};