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
import { SealOfOrichalcos } from './sealOfOrichalcos';

export const FiscalAgent = {
    /**
     * Signs a transaction with the Millennium Protocol signatures.
     * 
     * @param {Object} transaction - Standard transaction object {amount, date, description, category}
     * @returns {Object} A pristine ShadowRealmEntry object ready for storage. NO RAW AMOUNT.
     */
    processTransaction: (transaction) => {
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

        // 3. Apply The Seal of Orichalcos (Integrity Hash)
        const sealHash = SealOfOrichalcos.seal(shadowVector.magnitude, shadowVector.phantom, shadowVector.date);

        // 4. Construct the Shadow Realm Entry (NO RAW AMOUNT!)
        return {
            magnitude: shadowVector.magnitude,
            phantom: shadowVector.phantom,
            transaction_date: shadowVector.date,
            monster_card_name: mapping.monster,
            element: mapping.element,
            shadow_type: transaction.amount > 0 ? 'DEF' : 'ATK', // ATK = Expense (Damage), DEF = Income (Defense)
            integrity_hash: sealHash,
            is_corrupted: false,
            // SECURITY UPDATE: Raw description is deleted. Only the Shadow Mapping remains.
            description: "Sealed Content" 
        };
    },

    /**
     * Recovers a Shadow Entry back to a usable Transaction object.
     * Uses the Master Key to reverse the projection.
     */
    recoverEntry: (shadowEntry) => {
        const masterKey = KeyChain.ensureMasterKey();

        // 1. Verify Integrity
        if (!SealOfOrichalcos.verify(shadowEntry)) {
            console.error("DATA CORRUPTION DETECTED in entry:", shadowEntry);
            return { ...shadowEntry, is_corrupted: true, amount: 0 };
        }

        // 2. Reverse Vector Transformation
        const recoveredData = ShadowMapper.fromShadow(shadowEntry, masterKey);
        
        // 3. Restore Sign
        const signedAmount = shadowEntry.shadow_type === 'ATK' ? -recoveredData.amount : recoveredData.amount;

        return {
            date: recoveredData.date,
            amount: signedAmount,
            description: shadowEntry.description,
            category: shadowEntry.shadow_type === 'DEF' ? 'income' : 'expense',
            _metadata: {
                monster: shadowEntry.monster_card_name,
                element: shadowEntry.element
            }
        };
    }
};