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
    
    // Generic/Universal Check (for "xlsx-CSV" or unknown formats)
    if ((header.includes('date') || header.includes('תאריך')) && 
        (header.includes('balance') || header.includes('יתרה') || header.includes('amount') || header.includes('סכום') || header.includes('חובה'))) {
        return 'universal';
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
    const dateIdx = findColumn(headers, ['תאריך']);
    const descIdx = findColumn(headers, ['תיאור']);
    const detailsIdx = findColumn(headers, ['פרטים']);
    const debitIdx = findColumn(headers, ['חובה', 'חיוב']);
    const creditIdx = findColumn(headers, ['זכות', 'זיכוי']);
    const balanceIdx = findColumn(headers, ['יתרה']);
    
    if (dateIdx === -1 || balanceIdx === -1) return null;
    
    return {
        date: row[dateIdx]?.trim() || '',
        description: row[descIdx]?.trim() || row[descIdx + 1]?.trim() || 'תנועה',
        details: detailsIdx !== -1 ? row[detailsIdx]?.trim() : '',
        debit: debitIdx !== -1 ? toNum(row[debitIdx]) : 0,
        credit: creditIdx !== -1 ? toNum(row[creditIdx]) : 0,
        balance: toNum(row[balanceIdx])
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
 * Parse Universal/Generic CSV Row
 * Uses a superset of keywords to find columns
 */
export const parseUniversalRow = (row, headers) => {
    const dateIdx = findColumn(headers, ['תאריך', 'date', 'ערך']);
    const descIdx = findColumn(headers, ['תיאור', 'description', 'פרטים', 'details', 'סוג פעולה']);
    const debitIdx = findColumn(headers, ['חובה', 'חיוב', 'debit', 'משיכה']);
    const creditIdx = findColumn(headers, ['זכות', 'זיכוי', 'credit', 'הפקדה']);
    const balanceIdx = findColumn(headers, ['יתרה', 'balance']);
    const amountIdx = findColumn(headers, ['סכום', 'amount']);

    if (dateIdx === -1) return null;

    let dateVal = row[dateIdx]?.trim() || '';
    // Handle Excel Serial Dates (e.g., 45680)
    if (dateVal && !isNaN(dateVal) && dateVal.length >= 5) {
        dateVal = convertExcelDate(parseFloat(dateVal));
    }

    let debit = 0;
    let credit = 0;

    // Strategy 1: Explicit Debit/Credit columns
    if (debitIdx !== -1 || creditIdx !== -1) {
        if (debitIdx !== -1) debit = toNum(row[debitIdx]);
        if (creditIdx !== -1) credit = toNum(row[creditIdx]);
    } 
    // Strategy 2: Single Amount column
    else if (amountIdx !== -1) {
        const amount = toNum(row[amountIdx]);
        if (amount < 0) debit = Math.abs(amount);
        else credit = amount;
    }

    return {
        date: dateVal,
        description: (descIdx !== -1 ? row[descIdx] : '')?.trim() || 'תנועה',
        debit,
        credit,
        balance: balanceIdx !== -1 ? toNum(row[balanceIdx]) : 0
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
        case 'universal':
            return parseUniversalRow(row, headers);
        default:
            // Fallback to universal if unknown
            return parseUniversalRow(row, headers);
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