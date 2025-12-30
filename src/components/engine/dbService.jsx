import { base44 } from '@/api/base44Client';

export const saveFinancialData = async (engineResult) => {
  try {
    // Save snapshot
    await base44.entities.FinancialSnapshot.create({
      current_balance: engineResult.currentBalance,
      projected_balance: engineResult.safeProjection,
      risk_level: engineResult.riskLevel,
      risk_day: engineResult.riskDay || '',
      total_income: engineResult.totalIncome,
      total_expenses: engineResult.totalExpenses,
      upload_date: new Date().toISOString()
    });

    // Save recent transactions (last 50)
    const recentTxs = engineResult.transactions.slice(-50);
    await Promise.all(
      recentTxs.map(tx =>
        base44.entities.Transaction.create({
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          balance: tx.balance,
          category: tx.category
        })
      )
    );

    return { success: true };
  } catch (error) {
    console.error('Error saving data:', error);
    return { success: false, error: error.message };
  }
};

export const loadLatestSnapshot = async () => {
  try {
    const snapshots = await base44.entities.FinancialSnapshot.list();
    if (snapshots.length === 0) return null;

    // Sort by upload_date descending
    const sorted = snapshots.sort((a, b) => 
      new Date(b.upload_date) - new Date(a.upload_date)
    );

    return sorted[0];
  } catch (error) {
    console.error('Error loading snapshot:', error);
    return null;
  }
};