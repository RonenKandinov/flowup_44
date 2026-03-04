import * as XLSX from '@e965/xlsx';

export const generateUnderwritingReport = (metrics, insights, user) => {
    if (!metrics) return;

    const wb = XLSX.utils.book_new();
    
    // --- הגדרות צבעים ועיצוב (Styles) ---
    const COLORS = {
        navy: "0F172A",    // כחול כהה (כמו הרקע של האפליקציה)
        blue: "3B82F6",    // כחול FlowUp
        slate: "64748B",   // אפור לטקסט משני
        lightBg: "F8FAFC", // רקע לשורות
        white: "FFFFFF",
        riskRed: "FECACA",
        riskOrange: "FFEDD5",
        riskGreen: "DCFCE7"
    };

    const styles = {
        mainTitle: {
            font: { bold: true, sz: 18, color: { rgb: COLORS.white } },
            fill: { fgColor: { rgb: COLORS.navy } },
            alignment: { horizontal: "center", vertical: "center" }
        },
        sectionHeader: {
            font: { bold: true, sz: 12, color: { rgb: COLORS.white } },
            fill: { fgColor: { rgb: COLORS.blue } },
            alignment: { horizontal: "right", vertical: "center", indent: 1 }
        },
        label: {
            font: { color: { rgb: COLORS.slate }, sz: 11 },
            fill: { fgColor: { rgb: COLORS.white } },
            alignment: { horizontal: "right", vertical: "center", indent: 1 },
            border: { bottom: { style: "thin", color: { rgb: "E2E8F0" } } }
        },
        value: (isRisk = false, riskLevel = '') => {
            let bgColor = COLORS.white;
            if (isRisk) {
                const level = riskLevel.toLowerCase();
                if (level.includes('red')) bgColor = COLORS.riskRed;
                else if (level.includes('orange')) bgColor = COLORS.riskOrange;
                else bgColor = COLORS.riskGreen;
            }
            return {
                font: { bold: true, color: { rgb: COLORS.navy }, sz: 11 },
                fill: { fgColor: { rgb: bgColor } },
                alignment: { horizontal: "left", vertical: "center" },
                border: { bottom: { style: "thin", color: { rgb: "E2E8F0" } } }
            };
        },
        aiText: {
            font: { sz: 11 },
            alignment: { horizontal: "right", vertical: "top", wrapText: true, indent: 1 },
            fill: { fgColor: { rgb: COLORS.white } }
        }
    };

    // פונקציית עזר ליצירת שורה עם "עמודת ריווח" (A)
    const createRow = (label, val, isHeader = false) => {
        if (isHeader) {
            return [
                { v: "" }, // עמודה A - Padding
                { v: label, s: styles.sectionHeader },
                { v: "", s: styles.sectionHeader }
            ];
        }
        const isRiskRow = label.includes("סיכון");
        return [
            { v: "" }, // עמודה A - Padding
            { v: label, s: styles.label },
            { v: val, s: styles.value(isRiskRow, String(val)) }
        ];
    };

    // --- Sheet 1: החלטת אשראי ---
    const sheet1Data = [
        [{ v: "" }, { v: "FlowUp - דוח חיתום אשראי", s: styles.mainTitle }, { v: "" }],
        [{ v: "" }, { v: `הופק בתאריך: ${new Date().toLocaleDateString('he-IL')}`, s: { alignment: { horizontal: "center" } } }],
        [],
        createRow("פרטי לקוח", "", true),
        createRow("שם / מזהה לקוח", user?.email || "Ronen", false),
        createRow("ציון FlowUp Score", `${metrics.score || 35}/100`, false),
        createRow("רמת סיכון", insights?.risk_tier || "Red", false),
        [],
        createRow("מדדים פיננסיים (ממוצע 6 חודשים)", "", true),
        createRow("הכנסה חודשית ממוצעת", `₪${(metrics.totalIncome || 3168).toLocaleString()}`, false),
        createRow("סה\"כ הוצאות חודשיות", `₪${(metrics.totalExpenses || 2182).toLocaleString()}`, false),
        createRow("עודף חודשי פנוי", `₪${((metrics.totalIncome - metrics.totalExpenses) || 986).toLocaleString()}`, false),
        createRow("יחס שירות חוב (DTI)", `${metrics.dti || 14}%`, false),
        [],
        createRow("המלצת מערכת", "", true),
        createRow("סכום הלוואה מקסימלי", `₪${(metrics.maxLoan || 35496).toLocaleString()}`, false),
        createRow("תקופת החזר מומלצת", insights?.recommended_loan_structure || "Standard (72 חודשים)", false)
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);

    // הגדרות RTL ומבנה לגיליון 1
    ws1['!views'] = [{ RTL: true }]; // עמודה A עוברת לימין
    ws1['!cols'] = [{ wch: 3 }, { wch: 35 }, { wch: 25 }];
    ws1['!merges'] = [
        { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } }, // כותרת ראשית
        { s: { r: 3, c: 1 }, e: { r: 3, c: 2 } }, // כותרת פרטי לקוח
        { s: { r: 8, c: 1 }, e: { r: 8, c: 2 } }, // כותרת מדדים
        { s: { r: 14, c: 1 }, e: { r: 14, c: 2 } } // כותרת המלצה
    ];

    XLSX.utils.book_append_sheet(wb, ws1, "החלטת אשראי");

    // --- Sheet 2: ניתוח אנליסט AI ---
    const aiParagraph = insights?.executive_summary || 
        "כושר ההחזר של הלקוח אינו עונה על הקריטריונים האופטימליים, עם יחס חוב להכנסה גבוה במיוחד. ההכנסות החודשיות במצב של אי-יציבות, מה שמעיד על פגיעות כלכלית.";

    const sheet2Data = [
        [{ v: "" }, { v: "ניתוח אנליסט AI", s: styles.mainTitle }, { v: "" }, { v: "" }],
        [],
        [{ v: "" }, { v: aiParagraph, s: styles.aiText }, { v: "", s: styles.aiText }, { v: "", s: styles.aiText }]
    ];

    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
    ws2['!views'] = [{ RTL: true }];
    ws2['!cols'] = [{ wch: 3 }, { wch: 25 }, { wch: 25 }, { wch: 25 }];
    ws2['!merges'] = [
        { s: { r: 0, c: 1 }, e: { r: 0, c: 3 } }, // כותרת
        { s: { r: 2, c: 1 }, e: { r: 10, c: 3 } } // תיבת טקסט גדולה (שורות 2-10)
    ];

    XLSX.utils.book_append_sheet(wb, ws2, "ניתוח אנליסט AI");

    // --- הגדרה גלובלית לקובץ (מבטיח RTL ב-Excel Desktop) ---
    if (!wb.Workbook) wb.Workbook = {};
    if (!wb.Workbook.Views) wb.Workbook.Views = [];
    wb.Workbook.Views[0] = { RTL: true };

    // ייצוא
    XLSX.writeFile(wb, `FlowUp_Report_${user?.name || 'Customer'}.xlsx`);
};