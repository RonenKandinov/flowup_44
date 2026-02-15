import { useState, useCallback } from 'react';
import { openFinanceService } from '../services/openFinanceService';

export const useTransactionSync = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [error, setError] = useState(null);

    const sync = useCallback(async (connectionId, psuId) => {
        setIsLoading(true);
        setError(null);
        try {
            const txs = await openFinanceService.syncTransactions(connectionId, psuId);
            setTransactions(txs);
            return txs;
        } catch (err) {
            setError(err);
            console.error("Sync failed:", err);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, []);

    return { 
        sync, 
        transactions, 
        isLoading, 
        error,
        summary: {
            totalIncome: transactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0),
            totalExpenses: Math.abs(transactions.filter(t => t.amount < 0).reduce((acc, t) => acc + t.amount, 0)),
            net: transactions.reduce((acc, t) => acc + t.amount, 0)
        }
    };
};