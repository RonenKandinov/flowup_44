import { base44 } from '@/api/base44Client';

export const dbService = {
  saveSnapshot: async (data) => {
    try {
      await base44.entities.FinancialSnapshot.create({
        current_balance: data.currentBalance,
        projected_eom_balance: data.projectedEOM,
        risk_level: data.riskStatus,
        risk_day: data.riskDay || '',
        upload_date: new Date().toISOString()
      });
    } catch (e) {
      console.error('Error saving snapshot:', e);
    }
  },

  saveTransactions: async (txs) => {
    try {
      const recent = txs.slice(-50);
      await Promise.all(
        recent.map(t =>
          base44.entities.Transaction.create({
            date: t.date,
            description: t.desc,
            amount: t.amount,
            balance: t.balance,
            category: t.category
          })
        )
      );
    } catch (e) {
      console.error('Error saving transactions:', e);
    }
  },

  getLastSnapshot: async () => {
    try {
      const res = await base44.entities.FinancialSnapshot.list();
      const sorted = res.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date));
      return sorted[0];
    } catch (e) {
      return null;
    }
  }
};