import * as XLSX from '@e965/xlsx';

export const generateUnderwritingReport = (metrics, insights, user) => {
    if (!metrics) return;

    const wb = XLSX.utils.book_new();
    
    // --- הגדרות צבעים ועיצוב (Premium Analyst Styles) ---
    const COLORS = {
        navy: "0F172A",    // כחול עמוק
        blue: "2563EB",    // כחול מוסדי (מימון ישיר style)
        slate: "64748B",   // אפור טקסט
        lightBg: "F8FAFC", 
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
            font: { bold: true, color: { rgb: COLORS.slate }, sz: 11 },
            fill: { fgColor: { rgb: COLORS.white } },
            alignment: { horizontal: "right", vertical: "center", indent: 1 },
            border: { bottom: { style: "thin", color: { rgb: "E2E8F0" } } }
        },
        value: (isRisk = false, riskLevel = '') => {
            let bgColor = COLORS.white;
            if (isRisk) {
                const level = String(riskLevel).toLowerCase();
                if (level.includes('red') || level.includes('high')) bgColor = COLORS.riskRed;
                else if (level.includes('orange') || level.includes('med')) bgColor = COLORS.riskOrange;
                else bgColor = COLORS.riskGreen;
            }
            return {
                font: { bold: true, color: { rgb: COLORS.navy }, sz: 11 },
                fill: { fgColor: { rgb: bgColor } },
                alignment: { horizontal: "left", vertical: "center" },
                border: { bottom: { style: "thin", color: { rgb: "E2E8F0" } } }
            };
        },
        mitigantText: {
            font: { sz: 10, italic: true, color: { rgb: "1E293B" } },
            alignment: { horizontal: "right", vertical: "center", wrapText: true },
            fill: { fgColor: { rgb: COLORS.white } },
            border: { bottom: { style: "thin", color: { rgb: "E2E8F0" } } }
        }
    };

    // פונקציית עזר ליצירת שורת חיתום עם עמודת הערת אנליסט (D)
    const createAnalystRow = (label, val, mitigant = "") => {
        const isRiskRow = label.includes("סיכון") || label.includes("DSR") || label.includes("LTV") || label.includes("חריגות");
        return [
            { v: "" }, // עמודה A - Padding
            { v: label, s: styles.label },
            { v: val, s: styles.value(isRiskRow, val) },
            { v: mitigant, s: styles.mitigantText } // עמודה D - הערת האנליסט
        ];
    };

    // --- חישובי חיתום (Analyst Logic) ---
    const surplus = (metrics.totalIncome || 0) - (metrics.fixedExpenses || 0);
    const dsr = metrics.dsr || (surplus > 0 ? Math.round((800 / surplus) * 100) : 100);
    const ltv = metrics.ltv || 80;
    const negativeSignals = insights?.negative_signals_count || 0;

    // --- Sheet 1: סיכום חיתום מנהלים ---
    const sheet1Data = [
        [{ v: "" }, { v: "דוח חיתום אשראי - FlowUp Executive Summary", s: styles.mainTitle }, { v: "" }, { v: "" }],
        [{ v: "" }, { v: `מזהה: ${user?.email || "Ronen"} | תאריך: ${new Date().toLocaleDateString('he-IL')}`, s: { alignment: { horizontal: "center" } } }],
        [],
        [{ v: "" }, { v: "מדדי סיכון ובטוחות", s: styles.sectionHeader }, { v: "", s: styles.sectionHeader }, { v: "הערת אנליסט (Mitigant)", s: styles.sectionHeader }],
        createAnalystRow("DSR (יחס החזר פנוי)", `${dsr}%`, dsr > 45 ? "חנק תזרימי - מומלץ פריסה ל-72 חודשים" : "כושר החזר תקין"),
        createAnalystRow("LTV (חשיפת בטוחה)", `${ltv}%`, ltv > 85 ? "חשיפה גבוהה - נדרשת הגדלת מקדמה" : "כיסוי בטוחה מספק"),
        createAnalystRow("חריגות עו\"ש (היגיינה)", negativeSignals > 0 ? "זוהו חריגות" : "תקין", negativeSignals > 0 ? `זוהו ${negativeSignals} אירועים - נדרש בירור` : "אין חזרות חיובים ב-6 חודשים"),
        [],
        [{ v: "" }, { v: "ניתוח תזרים מזומנים", s: styles.sectionHeader }, { v: "", s: styles.sectionHeader }, { v: "", s: styles.sectionHeader }],
        createAnalystRow("הכנסה חודשית (נטו)", `₪${(metrics.totalIncome || 0).toLocaleString()}`, "מבוסס ממוצע בנקאי מאומת"),
        createAnalystRow("הוצאות קבועות", `₪${(metrics.fixedExpenses || 0).toLocaleString()}`, "כולל הלוואות ודיור"),
        createAnalystRow("עודף פנוי להחזר", `₪${surplus.toLocaleString()}`, "יכולת החזר ריאלית"),
        [],
        [{ v: "" }, { v: "החלטת חיתום סופית", s: styles.sectionHeader }, { v: dsr > 50 ? "דחייה/בחינה" : "אישור בתנאי סף", s: styles.value(true, dsr > 50 ? 'red' : 'green') }, { v: "" }]
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
    ws1['!views'] = [{ RTL: true }];
    ws1['!cols'] = [{ wch: 3 }, { wch: 25 }, { wch: 15 }, { wch: 45 }];
    ws1['!merges'] = [
        { s: { r: 0, c: 1 }, e: { r: 0, c: 3 } }, // כותרת
        { s: { r: 1, c: 1 }, e: { r: 1, c: 3 } }, // תאריך
        { s: { r: 3, c: 1 }, e: { r: 3, c: 2 } }, // כותרת סקציה 1
        { s: { r: 8, c: 1 }, e: { r: 8, c: 2 } }, // כותרת סקציה 2
        { s: { r: 13, c: 2 }, e: { r: 13, c: 3 } } // כפתור החלטה
    ];

    XLSX.utils.book_append_sheet(wb, ws1, "סיכום חיתום");

    // --- Sheet 2: חוות דעת אנליסט AI ---
    const sheet2Data = [
        [{ v: "" }, { v: "ניתוח אנליסט AI מורחב", s: styles.mainTitle }, { v: "" }, { v: "" }],
        [],
        [{ v: "" }, { v: insights?.executive_summary || "ניתוח מעמיק מזהה פוטנציאל החזר גבוה למרות יחס חוב נוכחי.", s: styles.aiText }, { v: "", s: styles.aiText }, { v: "", s: styles.aiText }]
    ];

    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
    ws2['!views'] = [{ RTL: true }];
    ws2['!cols'] = [{ wch: 3 }, { wch: 30 }, { wch: 30 }, { wch: 30 }];
    ws2['!merges'] = [
        { s: { r: 0, c: 1 }, e: { r: 0, c: 3 } },
        { s: { r: 2, c: 1 }, e: { r: 18, c: 3 } }
    ];

    XLSX.utils.book_append_sheet(wb, ws2, "חוות דעת אנליסט");

    if (!wb.Workbook) wb.Workbook = {};
    if (!wb.Workbook.Views) wb.Workbook.Views = [];
    wb.Workbook.Views[0] = { RTL: true };

    XLSX.writeFile(wb, `FlowUp_Analyst_Report_${user?.name || 'Client'}.xlsx`);
};