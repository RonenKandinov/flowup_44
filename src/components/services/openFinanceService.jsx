import { base44 } from "@/api/base44Client";

export const openFinanceService = {
    /**
     * Initiates the Open Finance connection flow.
     * @param {string} psuId - The user's PSU ID / National ID.
     * @returns {Promise<{url: string}>} - The connection URL.
     */
    initiateConnection: async (psuId) => {
        const { data } = await base44.functions.invoke('fup_live', { psuId });
        if (data.error) throw new Error(data.error);
        return data;
    },

    /**
     * Syncs transactions for a given connection.
     * @param {string} connectionId - The connection ID to sync.
     * @param {string} psuId - The user's PSU ID.
     * @returns {Promise<Array>} - The synced transactions.
     */
    syncTransactions: async (connectionId, psuId) => {
        // Updated to use LoanLogic (Intelligence Layer)
        const { data } = await base44.functions.invoke('loanlogic', { 
            connectionId, 
            psuId 
        });
        if (data.error) throw new Error(data.error);
        return data;
    }
};