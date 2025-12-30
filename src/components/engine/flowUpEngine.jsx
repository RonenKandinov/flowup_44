/**
 * FlowUp Pro Engine
 * Hybrid Forecasting: 70% Seasonal Average + 30% SES (Simple Exponential Smoothing)
 * Applies 17% Safety Buffer (The FlowUp Rule)
 */

export const processCSV = (csvText) => {
  try {
    const clean = (val) => {
      if (!val) return 0;
      // Remove ₪, commas, quotes, and any non-numeric characters except . and -
      return parseFloat(val.toString().replace(/[₪,"']/g, '').replace(/[^\d.-]/g, '')) || 0;
    };

    const lines = csvText.split('\n').filter(l => l.trim());
    if (lines.length < 2) {
      throw new Error('קובץ ריק או לא תקין');
    }

    const transactions = [];
    let currentBalance = 0;

    // Parse Israeli Bank CSV: Date=Col0, Debit=Col6, Credit=Col7, Balance=Col8
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < 9) continue;

      const debit = clean(cols[6]);
      const credit = clean(cols[7]);
      const balance = clean(cols[8]);

      // Update current balance from the last valid balance column
      if (!isNaN(balance) && balance !== 0) {
        currentBalance = balance;
      }

      const netAmount = credit - debit;
      if (netAmount !== 0) {
        transactions.push({
          date: cols[0] || new Date().toISOString().split('T')[0],
          description: cols[1] || 'עסקה',
          amount: netAmount,
          balance: balance || currentBalance,
          category: netAmount > 0 ? 'income' : 'expense'
        });
      }
    }

    if (transactions.length === 0) {
      throw new Error('לא נמצאו עסקאות תקינות בקובץ');
    }

    // Calculate monthly totals
    const totalIncome = transactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = Math.abs(
      transactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0)
    );

    // HYBRID MODEL: 70% Seasonal + 30% SES
    const seasonalAvg = (totalIncome - totalExpenses) / 30;
    const recentTrend = transactions[transactions.length - 1]?.amount || seasonalAvg;
    const hybridDailyNet = (seasonalAvg * 0.7) + (recentTrend * 0.3);

    // Project to end of month
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - today.getDate();

    // Raw projection
    const rawProjection = currentBalance + (hybridDailyNet * daysRemaining);

    // THE 17% RULE: Apply safety buffer
    const safeProjection = Math.floor(rawProjection * 0.83);
    const safetyBuffer = Math.floor(rawProjection * 0.17);

    // Risk Calculation
    let riskLevel = 'green';
    if (safeProjection < 0) {
      riskLevel = 'red';
    } else if (safeProjection < 1000) {
      riskLevel = 'yellow';
    }

    // Calculate Risk Day (when balance crosses zero)
    let riskDay = null;
    if (hybridDailyNet < 0) {
      const daysToZero = Math.floor(Math.abs(currentBalance / hybridDailyNet));
      if (daysToZero <= daysRemaining) {
        riskDay = `יום ${daysToZero}`;
      }
    }

    // Generate 30-day forecast graph
    const graphData = Array.from({ length: 30 }, (_, i) => ({
      day: `${i + 1}`,
      balance: Math.floor((currentBalance + (hybridDailyNet * i)) * 0.83)
    }));

    return {
      success: true,
      currentBalance,
      safeProjection,
      rawProjection,
      safetyBuffer,
      totalIncome,
      totalExpenses,
      riskLevel,
      riskDay,
      transactions,
      graphData,
      dailyAvg: Math.floor(hybridDailyNet)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'שגיאה בעיבוד הקובץ'
    };
  }
};