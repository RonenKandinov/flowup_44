export const processAndForecast = (csvText) => {
  try {
    const lines = csvText.split('\n').filter(l => l.trim());
    if (lines.length < 2) throw new Error("File empty");
    const transactions = [];
    let currentBalance = 0;
    // Parse Israeli CSV: Date=0, Debit=6, Credit=7, Balance=8
    for (let i = 1; i < lines.length; i++) {
      const col = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
      if (col.length < 5) continue;
      const debit = parseFloat(col[6]?.replace(/[^\d.-]/g, '')) || 0;
      const credit = parseFloat(col[7]?.replace(/[^\d.-]/g, '')) || 0;
      const balance = parseFloat(col[8]?.replace(/[^\d.-]/g, ''));
      if (!isNaN(balance)) currentBalance = balance;
      const net = credit - debit;
      if (net !== 0) transactions.push({ date: col[0], desc: col[1] || 'Tx', amount: net, balance, category: net > 0 ? 'income' : 'expense' });
    }
    // Hybrid Model: 70% Seasonal + 30% SES
    const totalIncome = transactions.filter(t => t.amount > 0).reduce((a, b) => a + b.amount, 0);
    const totalExpense = Math.abs(transactions.filter(t => t.amount < 0).reduce((a, b) => a + b.amount, 0));
    const seasonalNet = (totalIncome - totalExpense) / 30;
    const recentTrend = transactions[transactions.length - 1]?.amount || seasonalNet;
    const hybridNet = (seasonalNet * 0.7) + (recentTrend * 0.3);
    // 17% SAFETY BUFFER
    const daysLeft = 30 - new Date().getDate();
    const projectedEOM = Math.floor((currentBalance + (hybridNet * daysLeft)) * 0.83);
    // Risk Calculation
    let riskStatus = projectedEOM < 0 ? 'red' : projectedEOM < 1000 ? 'yellow' : 'green';
    let riskDay = null;
    if (riskStatus === 'red') {
       const daysToZero = Math.abs(currentBalance / hybridNet);
       riskDay = daysToZero < daysLeft ? `Day ${Math.ceil(daysToZero)}` : null;
    }
    const graphPoints = Array.from({ length: 30 }, (_, i) => ({
      date: `Day ${i + 1}`,
      balance: Math.floor((currentBalance + (hybridNet * i)) * 0.83)
    }));
    return { success: true, currentBalance, projectedEOM, totalIncome, totalExpense, riskStatus, riskDay, transactions, graphPoints };
  } catch (e) { return { error: e.message }; }
};