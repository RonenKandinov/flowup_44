import * as XLSX from '@e965/xlsx';

export const generateUnderwritingReport = (metrics, insights, user) => {
    if (!metrics) return;

    const wb = XLSX.utils.book_new();
    const formatCurrency = (val) => `₪${Math.round(val || 0).toLocaleString('he-IL')}`;

    // --- Sheet 1: החלטת אשראי ---
    const income = metrics.totalIncome || 0;
    const expenses = metrics.totalExpenses || 0;
    const surplus = income - expenses;
    const score = metrics.score || 0;
    const riskTier = insights?.risk_tier || metrics.status || 'לא ידוע';
    
    let decision = 'אישור';
    if (riskTier === 'Red' || riskTier === 'RED') decision = 'דחייה / בחינה נוספת';
    else if (riskTier === 'Orange' || riskTier === 'ORANGE') decision = 'אישור בתנאים מגבילים';

    const maxLoan = surplus > 0 ? surplus * 36 : 0;
    const maxRepayment = surplus > 0 ? surplus * 0.8 : 0;

    const sheet1Data = [
        ["FlowUp AI", ""],
        ["דוח חיתום אשראי", ""],
        ["מבוסס נתוני Open Banking", ""],
        ["", ""],
        ["פרטי לקוח והחלטה", ""],
        ["מזהה לקוח", user?.email || user?.id || 'לא ידוע'],
        ["ציון FlowUp", score],
        ["רמת סיכון", riskTier],
        ["החלטת אשראי", decision],
        ["", ""],
        ["מדדים פיננסיים מרכזיים", ""],
        ["הכנסה חודשית ממוצעת", formatCurrency(income)],
        ["סה\"כ הוצאות חודשיות", formatCurrency(expenses)],
        ["עודף חודשי", formatCurrency(surplus)],
        ["יחס שירות חוב (DTI)", `${metrics.dti || 0}%`],
        ["", ""],
        ["המלצת אשראי", ""],
        ["סכום הלוואה מקסימלי מומלץ", formatCurrency(maxLoan)],
        ["החזר חודשי מקסימלי", formatCurrency(maxRepayment)],
        ["תקופת הלוואה מומלצת", insights?.recommended_loan_structure || 'Standard (24-60 חודשים)']
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
    ws1['!cols'] = [{ wch: 30 }, { wch: 30 }];
    ws1['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws1, "החלטת אשראי");

    // --- Sheet 2: ניתוח פיננסי ---
    const fixedExpenses = metrics.totalFixedExpenses || metrics.fixedExpenses || 0;
    const flexExpenses = metrics.totalLifestyleExpenses || metrics.lifestyleExpenses || 0;
    
    const sheet2Data = [
        ["ניתוח הכנסות", ""],
        ["הכנסה חודשית ממוצעת", formatCurrency(income)],
        ["יציבות הכנסה", (metrics.trends?.income || 0) > -5 ? 'יציב' : 'תנודתי'],
        ["תנודתיות הכנסה", `${insights?.metrics?.income_volatility || 0}%`],
        ["", ""],
        ["ניתוח הוצאות", ""],
        ["הוצאות חיוניות", formatCurrency(fixedExpenses)],
        ["הוצאות פנאי", formatCurrency(flexExpenses)],
        ["סה\"כ הוצאות", formatCurrency(expenses)],
        ["", ""],
        ["יכולת החזר", ""],
        ["עודף חודשי", formatCurrency(surplus)],
        ["יחס שירות חוב מותאם (DTI)", `${insights?.metrics?.adjusted_dti || metrics.dti || 0}%`],
        ["יחס התחייבויות מבני", `${insights?.metrics?.structural_dti || metrics.dti || 0}%`],
        ["כרית נזילות", `${insights?.metrics?.liquidity_buffer_months || 0} חודשים`]
    ];

    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
    ws2['!cols'] = [{ wch: 30 }, { wch: 30 }];
    ws2['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws2, "ניתוח פיננסי");

    // --- Sheet 3: ניתוח אנליסט AI ---
    const paragraph = insights?.executive_summary || 
        `המערכת מזהה רמת סיכון ${riskTier === 'Red' ? 'גבוהה' : riskTier === 'Orange' ? 'בינונית' : 'נמוכה'} עקב יחס שירות חוב של ${metrics.dti || 0}% ויכולת החזר ${riskTier === 'Red' ? 'מוגבלת' : 'סבירה'}.`;
    
    const sheet3Data = [
        ["ניתוח אנליסט AI"],
        [],
        [paragraph]
    ];

    const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);
    ws3['!cols'] = [{ wch: 100 }];
    ws3['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws3, "ניתוח אנליסט AI");

    // Save the file
    XLSX.writeFile(wb, "flowup_credit_underwriting_report.xlsx");
};