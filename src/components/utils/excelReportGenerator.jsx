import * as XLSX from '@e965/xlsx';

export const generateUnderwritingReport = (metrics, insights, user) => {
    if (!metrics) return;

    const wb = XLSX.utils.book_new();
    const formatCurrency = (val) => `₪${Math.round(val || 0).toLocaleString('he-IL')}`;

    // Styles
    const titleStyle = {
        font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1E3A8A" } }, // Tailwind blue-900
        alignment: { horizontal: "center", vertical: "center" }
    };

    const sectionHeaderStyle = {
        font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "3B82F6" } }, // Tailwind blue-500
        alignment: { horizontal: "right", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    };

    const paramStyle = {
        font: { bold: true, color: { rgb: "333333" } },
        fill: { fgColor: { rgb: "F3F4F6" } }, // Tailwind gray-100
        alignment: { horizontal: "right", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    };

    const valueStyle = {
        alignment: { horizontal: "right", vertical: "center" },
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    };

    const createStyledRow = (param, value, isHeader = false) => {
        if (isHeader) {
            return [
                { v: param, t: 's', s: sectionHeaderStyle },
                { v: value, t: 's', s: sectionHeaderStyle }
            ];
        }
        return [
            { v: param, t: 's', s: paramStyle },
            { v: value, t: typeof value === 'number' ? 'n' : 's', s: valueStyle }
        ];
    };

    const emptyRow = [{ v: "", s: {} }, { v: "", s: {} }];

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
        [{ v: "FlowUp AI - דוח חיתום אשראי", t: 's', s: titleStyle }, { v: "", t: 's', s: titleStyle }],
        [{ v: "מבוסס נתוני Open Banking", t: 's', s: { ...titleStyle, sz: 12, fill: { fgColor: { rgb: "2563EB" } } } }, { v: "", t: 's', s: { ...titleStyle, sz: 12, fill: { fgColor: { rgb: "2563EB" } } } }],
        emptyRow,
        createStyledRow("פרטי לקוח", "", true),
        createStyledRow("מזהה לקוח", user?.email || user?.id || 'לא ידוע'),
        createStyledRow("ציון FlowUp", score),
        createStyledRow("רמת סיכון", riskTier),
        createStyledRow("החלטת אשראי", decision),
        emptyRow,
        createStyledRow("מדדים פיננסיים", "", true),
        createStyledRow("הכנסה חודשית ממוצעת", formatCurrency(income)),
        createStyledRow("סה\"כ הוצאות חודשיות", formatCurrency(expenses)),
        createStyledRow("עודף חודשי", formatCurrency(surplus)),
        createStyledRow("יחס שירות חוב (DTI)", `${metrics.dti || 0}%`),
        emptyRow,
        createStyledRow("המלצת אשראי", "", true),
        createStyledRow("סכום הלוואה מקסימלי מומלץ", formatCurrency(maxLoan)),
        createStyledRow("החזר חודשי מקסימלי", formatCurrency(maxRepayment)),
        createStyledRow("תקופת הלוואה מומלצת", insights?.recommended_loan_structure || 'Standard (24-60 חודשים)')
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
    ws1['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
        { s: { r: 9, c: 0 }, e: { r: 9, c: 1 } },
        { s: { r: 15, c: 0 }, e: { r: 15, c: 1 } }
    ];
    ws1['!cols'] = [{ wch: 35 }, { wch: 35 }];
    ws1['!dir'] = 'rtl';
    ws1['!views'] = [{ RTL: true, rightToLeft: true }];
    XLSX.utils.book_append_sheet(wb, ws1, "החלטת אשראי");

    // --- Sheet 2: ניתוח פיננסי ---
    const fixedExpenses = metrics.totalFixedExpenses || metrics.fixedExpenses || 0;
    const flexExpenses = metrics.totalLifestyleExpenses || metrics.lifestyleExpenses || 0;
    
    const sheet2Data = [
        [{ v: "ניתוח פיננסי מורחב", t: 's', s: titleStyle }, { v: "", t: 's', s: titleStyle }],
        emptyRow,
        createStyledRow("ניתוח הכנסות", "", true),
        createStyledRow("הכנסה חודשית ממוצעת", formatCurrency(income)),
        createStyledRow("יציבות הכנסה", (metrics.trends?.income || 0) > -5 ? 'יציב' : 'תנודתי'),
        createStyledRow("תנודתיות הכנסה", `${insights?.metrics?.income_volatility || 0}%`),
        emptyRow,
        createStyledRow("ניתוח הוצאות", "", true),
        createStyledRow("הוצאות חיוניות", formatCurrency(fixedExpenses)),
        createStyledRow("הוצאות פנאי", formatCurrency(flexExpenses)),
        createStyledRow("סה\"כ הוצאות", formatCurrency(expenses)),
        emptyRow,
        createStyledRow("יכולת החזר", "", true),
        createStyledRow("עודף חודשי", formatCurrency(surplus)),
        createStyledRow("יחס שירות חוב מותאם (DTI)", `${insights?.metrics?.adjusted_dti || metrics.dti || 0}%`),
        createStyledRow("יחס התחייבויות מבני", `${insights?.metrics?.structural_dti || metrics.dti || 0}%`),
        createStyledRow("כרית נזילות", `${insights?.metrics?.liquidity_buffer_months || 0} חודשים`)
    ];

    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
    ws2['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
        { s: { r: 7, c: 0 }, e: { r: 7, c: 1 } },
        { s: { r: 12, c: 0 }, e: { r: 12, c: 1 } }
    ];
    ws2['!cols'] = [{ wch: 35 }, { wch: 35 }];
    ws2['!dir'] = 'rtl';
    ws2['!views'] = [{ RTL: true, rightToLeft: true }];
    XLSX.utils.book_append_sheet(wb, ws2, "ניתוח פיננסי");

    // --- Sheet 3: ניתוח אנליסט AI ---
    const paragraph = insights?.executive_summary || 
        `המערכת מזהה רמת סיכון ${riskTier === 'Red' ? 'גבוהה' : riskTier === 'Orange' ? 'בינונית' : 'נמוכה'} עקב יחס שירות חוב של ${metrics.dti || 0}% ויכולת החזר ${riskTier === 'Red' ? 'מוגבלת' : 'סבירה'}.`;
    
    const sheet3Data = [
        [{ v: "ניתוח אנליסט AI", t: 's', s: titleStyle }, { v: "", t: 's', s: titleStyle }, { v: "", t: 's', s: titleStyle }, { v: "", t: 's', s: titleStyle }],
        [{ v: "", t: 's', s: {} }, { v: "", t: 's', s: {} }, { v: "", t: 's', s: {} }, { v: "", t: 's', s: {} }],
        [{ 
            v: paragraph, 
            t: 's', 
            s: { 
                alignment: { horizontal: "right", vertical: "top", wrapText: true },
                font: { sz: 12 }
            } 
        }, { v: "", t: 's', s: {} }, { v: "", t: 's', s: {} }, { v: "", t: 's', s: {} }]
    ];

    const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);
    ws3['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
        { s: { r: 2, c: 0 }, e: { r: 10, c: 3 } } // Merge a large area for the text
    ];
    ws3['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 25 }];
    ws3['!dir'] = 'rtl';
    ws3['!views'] = [{ RTL: true, rightToLeft: true }];
    XLSX.utils.book_append_sheet(wb, ws3, "ניתוח אנליסט AI");

    // Save the file
    XLSX.writeFile(wb, "flowup_credit_underwriting_report.xlsx");
};