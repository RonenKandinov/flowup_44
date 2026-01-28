/**
 * FlowUp Multi-Bank CSV Parser System
 * ====================================
 * Supports: Bank Hapoalim, Bank Leumi, Discount, Mizrahi-Tefahot, First International
 * Each bank has a dedicated parser due to different CSV structures
 */

// Safe number conversion utility
const toNum = (v) => {
    if (!v) return 0;
    const str = v.toString().replace(/[^\d.-]/g, '');
    return parseFloat(str) || 0;
};

/**
 * Detect bank type from CSV header row
 */
export const detectBankFromHeader = (headerRow) => {
    const header = headerRow.toLowerCase();
    
    // Bank Hapoalim - תאריך, תיאור הפעולה, חובה, זכות, יתרה
    if (header.includes('תיאור הפעולה') || header.includes('תאריך ערך')) {
        return 'hapoalim';
    }
    
    // Bank Leumi - Date, Details, Debit, Credit, Balance
    if (header.includes('תיאור') && header.includes('חיוב') && header.includes('זיכוי')) {
        return 'leumi';
    }
    
    // Discount Bank - תאריך פעולה, פרטים, חובה/זכות, יתרה
    if (header.includes('פרטים') && header.includes('חשבון')) {
        return 'discount';
    }
    
    // Mizrahi-Tefahot - תאריך, סוג פעולה, משיכה, הפקדה
    if (header.includes('סוג פעולה') || header.includes('משיכה') || header.includes('הפקדה')) {
        return 'mizrahi';
    }
    
    // First International Bank - Date, Description, Amount, Balance
    if (header.includes('amount') || header.includes('סכום')) {
        return 'beinleumi';
    }
    
    return 'unknown';
};

/**
 * Find column index by possible Hebrew names
 */
const findColumn = (headers, possibleNames) => {
    for (let i = 0; i < headers.length; i++) {
        const header = headers[i].toLowerCase().trim();
        if (possibleNames.some(name => header.includes(name))) {
            return i;
        }
    }
    return -1;
};

/**
 * Parse Bank Hapoalim CSV
 * Format: תאריך, תיאור הפעולה, פרטים, חשבון, אסמכתא, תאריך ערך, חובה, זכות, יתרה
 */
export const parsePoalimRow = (row, headers) => {
    // בדיקה אם השורה בכלל מכילה תאריך (מונע קריסה על שורות הכותרת של הבנק)
    const dateRegex = /^\d{4}-\d{2}-\d{2}/;
    // Bank Hapoalim CSV often has metadata rows at the top. 
    // We check if the first column looks like a date or if it's a valid data row.
    // Note: The user requested specific logic. 
    // However, the user's snippet uses row[0], row[1] etc hardcoded indices.
    // The previous implementation used dynamic header detection (findColumn).
    // Bank Hapoalim CSV structure can vary.
    // Let's try to combine the robustness.
    // The user's code:
    /*
    const dateRegex = /^\d{4}-\d{2}-\d{2}/;
    if (!dateRegex.test(row[0])) return null; 

    return {
        date: row[0],             // תאריך
        description: row[1],      // הפעולה
        subDescription: row[2],   // פרטים
        reference: row[3],        // אסמכתא
        debit: parseFloat(row[4]) || 0,  // חובה
        credit: parseFloat(row[5]) || 0, // זכות
        balance: parseFloat(row[6]) || 0 // יתרה בש''ח
    };
    */
   
    // If I switch to hardcoded indices, I might break parsing if columns shift.
    // But the user said "To be robust... update your function... here is the logic you need to add".
    // And provided code using hardcoded indices.
    // I should probably respect the user's code but maybe keep the dynamic check if possible?
    // "כדי ש-FlowUp תהיה חסינה ... אתה צריך לעדכן ... הנה הלוגיקה"
    // The user explicitly provided a snippet. I will use it but maybe adapt safe access.
    
    // Actually, row[0] for date implies specific column order.
    // Let's trust the user's specific request for Hapoalim as they might be targeting a specific export format they have.
    
    // BUT, the `row` passed to `parsePoalimRow` comes from `parseCSVRow` in `forecastingLogic.js` (wait, no, it's called from `CSVUploader` or `forecastingLogic`).
    // In `forecastingLogic.js`, line 62: `const row = line.split(delimiter)...`
    // And `detectBankFromHeader` determines the bank.
    
    // Let's use the user's logic but ensure `row` elements exist.
    
    const dateStr = row[0]?.trim();
    // Regex for DD/MM/YYYY or YYYY-MM-DD or DD-MM-YYYY
    // The user's regex `^\d{4}-\d{2}-\d{2}` matches YYYY-MM-DD.
    // Hapoalim usually exports DD/MM/YYYY. 
    // But maybe the user's file is different.
    // I'll stick to the user's provided regex as requested, but I'll add a check for the other common format just in case, or strict to their request.
    // The user said: "תגיד לפרסר להתעלם מכל שורה שלא מתחילה בתאריך תקין (YYYY-MM-DD)."
    // So they explicitly want YYYY-MM-DD.
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}/;
    // Also support DD/MM/YYYY just to be safe? 
    // The user said "Skip top rows ... that don't start with valid date (YYYY-MM-DD)".
    // I will use their regex.
    
    if (!dateStr || !dateRegex.test(dateStr)) return null;

    return {
        date: dateStr,
        description: row[1]?.trim() || 'תנועה',
        details: row[2]?.trim() || '',
        reference: row[3]?.trim() || '',
        debit: toNum(row[4]),
        credit: toNum(row[5]),
        balance: toNum(row[6])
    };
};

/**
 * Parse Bank Leumi CSV
 * Format: תאריך, תיאור, חיוב, זיכוי, יתרה זמינה
 */
export const parseLeumiRow = (row, headers) => {
    const dateIdx = findColumn(headers, ['תאריך', 'date']);
    const descIdx = findColumn(headers, ['תיאור', 'details']);
    const debitIdx = findColumn(headers, ['חיוב', 'debit']);
    const creditIdx = findColumn(headers, ['זיכוי', 'credit']);
    const balanceIdx = findColumn(headers, ['יתרה', 'balance']);
    
    if (dateIdx === -1 || balanceIdx === -1) return null;
    
    return {
        date: row[dateIdx]?.trim() || '',
        description: row[descIdx]?.trim() || 'תנועה',
        debit: debitIdx !== -1 ? toNum(row[debitIdx]) : 0,
        credit: creditIdx !== -1 ? toNum(row[creditIdx]) : 0,
        balance: toNum(row[balanceIdx])
    };
};

/**
 * Parse Discount Bank CSV
 * Format: תאריך, פרטים, חובה, זכות, יתרה
 */
export const parseDiscountRow = (row, headers) => {
    const dateIdx = findColumn(headers, ['תאריך', 'תאריך פעולה']);
    const descIdx = findColumn(headers, ['פרטים', 'תיאור']);
    const debitIdx = findColumn(headers, ['חובה']);
    const creditIdx = findColumn(headers, ['זכות']);
    const balanceIdx = findColumn(headers, ['יתרה']);
    
    if (dateIdx === -1 || balanceIdx === -1) return null;
    
    return {
        date: row[dateIdx]?.trim() || '',
        description: row[descIdx]?.trim() || 'תנועה',
        debit: debitIdx !== -1 ? toNum(row[debitIdx]) : 0,
        credit: creditIdx !== -1 ? toNum(row[creditIdx]) : 0,
        balance: toNum(row[balanceIdx])
    };
};

/**
 * Parse Mizrahi-Tefahot Bank CSV
 * Format: תאריך, סוג פעולה, משיכה, הפקדה, יתרה
 */
export const parseMizrahiRow = (row, headers) => {
    const dateIdx = findColumn(headers, ['תאריך']);
    const descIdx = findColumn(headers, ['סוג פעולה', 'תיאור']);
    const debitIdx = findColumn(headers, ['משיכה', 'חיוב']);
    const creditIdx = findColumn(headers, ['הפקדה', 'זיכוי']);
    const balanceIdx = findColumn(headers, ['יתרה']);
    
    if (dateIdx === -1 || balanceIdx === -1) return null;
    
    return {
        date: row[dateIdx]?.trim() || '',
        description: row[descIdx]?.trim() || 'תנועה',
        debit: debitIdx !== -1 ? toNum(row[debitIdx]) : 0,
        credit: creditIdx !== -1 ? toNum(row[creditIdx]) : 0,
        balance: toNum(row[balanceIdx])
    };
};

/**
 * Parse First International Bank CSV
 * Format: Date, Description, Amount (single column with +/-), Balance
 */
export const parseBeinleumiRow = (row, headers) => {
    const dateIdx = findColumn(headers, ['תאריך', 'date']);
    const descIdx = findColumn(headers, ['תיאור', 'description']);
    const amountIdx = findColumn(headers, ['סכום', 'amount']);
    const balanceIdx = findColumn(headers, ['יתרה', 'balance']);
    
    if (dateIdx === -1 || amountIdx === -1 || balanceIdx === -1) return null;
    
    const amount = toNum(row[amountIdx]);
    
    return {
        date: row[dateIdx]?.trim() || '',
        description: row[descIdx]?.trim() || 'תנועה',
        debit: amount < 0 ? Math.abs(amount) : 0,
        credit: amount > 0 ? amount : 0,
        balance: toNum(row[balanceIdx])
    };
};

/**
 * Universal CSV Parser Router
 * Detects bank and routes to appropriate parser
 */
export const parseCSVRow = (row, headers, bankType) => {
    switch (bankType) {
        case 'hapoalim':
            return parsePoalimRow(row, headers);
        case 'leumi':
            return parseLeumiRow(row, headers);
        case 'discount':
            return parseDiscountRow(row, headers);
        case 'mizrahi':
            return parseMizrahiRow(row, headers);
        case 'beinleumi':
            return parseBeinleumiRow(row, headers);
        default:
            return null;
    }
};

/**
 * Get bank display name
 */
export const getBankDisplayName = (bankType) => {
    const names = {
        hapoalim: 'בנק הפועלים',
        leumi: 'בנק לאומי',
        discount: 'בנק דיסקונט',
        mizrahi: 'מזרחי-טפחות',
        beinleumi: 'הבינלאומי',
        unknown: 'לא מזוהה'
    };
    return names[bankType] || 'לא מזוהה';
};