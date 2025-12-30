export const processAndForecast = (csvText) => {
  try {
    const clean = (val) => parseFloat(val?.replace(/[^\d.-]/g, '')) || 0;
    
    const lines = csvText.split('\n').filter(l => l.trim());
    if (lines.length < 2) throw new Error("קובץ ריק או לא תקין");
    
    const transactions = [];
    let currentBalance = 0;
    
    // Parse Israeli CSV: Date=0, Debit=6, Credit=7, Balance=8
    for (let i = 1; i < lines.length; i++) {
      const col = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
      if (col.length < 9) continue;
      
      const debit = clean(col[6]);
      const credit = clean(col[7]);
      const balance = clean(col[8]);
      
      if (!isNaN(balance) && balance !== 0) {
        currentBalance = balance;
      }
      
      const net = credit - debit;
      if (net !== 0) {
        transactions.push({ 
          date: col[0], 
          desc: col[1] || 'עסקה', 
          amount: net, 
          balance, 
          category: net > 0 ? 'income' : 'expense' 
        });
      }
    }
    
    if (transactions.length === 0) {
      throw new Error("לא נמצאו עסקאות תקינות בקובץ");
    }
    
    // Hybrid Model: 70% Seasonal + 30% SES
    const totalIncome = transactions.filter(t => t.amount > 0).reduce((a, b) => a + b.amount, 0);
    const totalExpense = Math.abs(transactions.filter(t => t.amount < 0).reduce((a, b) => a + b.amount, 0));
    const seasonalNet = (totalIncome - totalExpense) / 30;
    const recentTrend = transactions[transactions.length - 1]?.amount || seasonalNet;
    const hybridNet = (seasonalNet * 0.7) + (recentTrend * 0.3);
    
    // 17% SAFETY BUFFER applied to projection
    const daysLeft = 30 - new Date().getDate();
    const rawProjection = currentBalance + (hybridNet * daysLeft);
    const projectedEOM = Math.floor(rawProjection * 0.83);
    
    // Risk Calculation (updated thresholds)
    let riskStatus = 'green';
    if (projectedEOM < 0) {
      riskStatus = 'red';
    } else if (projectedEOM < 2000) {
      riskStatus = 'yellow';
    }
    
    let riskDay = null;
    if (riskStatus === 'red' && hybridNet < 0) {
      const daysToZero = Math.abs(currentBalance / hybridNet);
      riskDay = daysToZero < daysLeft ? `יום ${Math.ceil(daysToZero)}` : null;
    }
    
    const graphPoints = Array.from({ length: 30 }, (_, i) => ({
      date: `יום ${i + 1}`,
      balance: Math.floor((currentBalance + (hybridNet * i)) * 0.83)
    }));
    
    return { 
      success: true, 
      currentBalance, 
      projectedEOM, 
      totalIncome, 
      totalExpense, 
      riskStatus, 
      riskDay, 
      transactions, 
      graphPoints,
      safetyBuffer: Math.floor(rawProjection * 0.17)
    };
  } catch (e) { 
    return { error: e.message }; 
  }
};