import * as XLSX from '@e965/xlsx';

export const generateUnderwritingReport = (metrics, insights, user) => {
    if (!metrics) return;

    const wb = XLSX.utils.book_new();
    
    // --- הגדרות עיצוב (Styles) ---
    const styles = {
        mainTitle: {
            font: { bold: true, sz: 20, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "0F172A" } }, // כחול כהה מאוד (Slate 900)
            alignment: { horizontal: "center", vertical: "center" }
        },
        sectionHeader: {
            font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "3B82F6" } }, // כחול FlowUp
            alignment: { horizontal: "right", vertical: "center" },
            border: { bottom: { style: "medium", color: { rgb: "1E293B" } } }
        },
        labelCell: {
            font: { bold: true, color: { rgb: "475569" } },
            fill: { fgColor: { rgb: "F8FAFC" } },
            alignment: { horizontal: "right" },
            border: { bottom: { style: "thin", color: { rgb: "E2E8F0" } } }
        },
        valueCell: {
            font: { sz: 11 },
            alignment: { horizontal: "left" },
            border: { bottom: { style: "thin", color: { rgb: "E2E8F0" } } }
        },
        aiBox: {
            alignment: { horizontal: "right", vertical: "top", wrapText: true },
            font: { sz: 12 },
            fill: { fgColor: { rgb: "FFFFFF" } }
        }
    };

    // פונקציית עזר ליצירת שורת נתונים עם ריווח
    const createDataRow = (label, value, isHeader = false) => {
        if (isHeader) {
            return [
                { v: "" }, // עמודה A (Padding)
                { v: label, s: styles.sectionHeader },
                { v: "", s: styles.sectionHeader } // עמודה C (חלק מהמיזוג)
            ];
        }
        return [
            { v: "" }, // Padding
            { v: label, s: styles.labelCell },
            { v: value, s: styles.valueCell }
        ];
    };

    // --- בניית הנתונים לגיליון הראשון (החלטת אשראי) ---
    const sheet1Data = [
        [{ v: "" }, { v: "FlowUp - דוח חיתום אשראי", s: styles.mainTitle }, { v: "" }],
        [{ v: "" }, { v: `תאריך הפקה: ${new Date().toLocaleDateString('he-IL')}`, s: { alignment: { horizontal: "center" } } }],
        [], // שורת רווח
        createDataRow("פרטי לקוח", "", true),
        createDataRow("שם לקוח / מזהה", user?.email || "Ronen", false),
        createDataRow("ציון FlowUp Score", metrics.score || "35", false),
        createDataRow("רמת סיכון", insights?.risk_tier || "Red", false),
        [],
        createDataRow("מדדים פיננסיים", "", true),
        createDataRow("הכנסה חודשית ממוצעת", `₪${(metrics.totalIncome || 3168).toLocaleString()}`, false),
        createDataRow("סה\"כ הוצאות", `₪${(metrics.totalExpenses || 2182).toLocaleString()}`, false),
        createDataRow("יחס שירות חוב (DTI)", `${metrics.dti || 14}%`, false),
        createDataRow("עודף חודשי", `₪${(metrics.totalIncome - metrics.totalExpenses || 986).toLocaleString()}`, false),
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);

    // הגדרות מבנה הגיליון (Layout)
    ws1['!merges'] = [
        { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } }, // מיזוג כותרת ראשית
        { s: { r: 3, c: 1 }, e: { r: 3, c: 2 } }, // מיזוג כותרת "פרטי לקוח"
        { s: { r: 8, c: 1 }, e: { r: 8, c: 2 } }  // מיזוג כותרת "מדדים פיננסיים"
    ];

    ws1['!cols'] = [
        { wch: 4 },  // עמודה A: ריווח צד (Margin)
        { wch: 35 }, // עמודה B: תוויות (Labels)
        { wch: 25 }  // עמודה C: ערכים (Values)
    ];

    ws1['!views'] = [{ RTL: true }]; // הגדרת כיוון הגיליון מימין לשמאל
    XLSX.utils.book_append_sheet(wb, ws1, "החלטת אשראי");

    // --- גיליון אנליסט AI ---
    const aiText = insights?.executive_summary || "המערכת מזהה רמת סיכון גבוהה עקב יחס שירות חוב גבוה וחוסר יציבות בהכנסה.";
    const sheet3Data = [
        [{ v: "" }, { v: "ניתוח אנליסט AI", s: styles.mainTitle }],
        [],
        [{ v: "" }, { v: aiText, s: styles.aiBox }]
    ];

    const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);
    ws3['!merges'] = [
        { s: { r: 0, c: 1 }, e: { r: 0, c: 4 } }, // כותרת רחבה
        { s: { r: 2, c: 1 }, e: { r: 12, c: 4 } } // תיבת טקסט גדולה
    ];
    ws3['!cols'] = [{ wch: 4 }, { wch: 80 }]; 
    ws3['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws3, "ניתוח אנליסט AI");

    XLSX.writeFile(wb, "FlowUp_Financial_Report.xlsx");
};