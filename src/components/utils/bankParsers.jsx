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
    // Legacy support (mostly will fail with garbage headers)
    const header = headerRow.toLowerCase();
    
    if (header.includes('יתרה בש"ח') || header.includes('הפעולה') || header.includes('תיאור הפעולה') || header.includes('תאריך ערך')) {
        return 'hapoalim';
    }
    if (header.includes('זכות/חובה') || header.includes('תיאור התנועה') || (header.includes('פרטים') && header.includes('חשבון'))) {
        return 'discount';
    }

    // Keep existing detections as fallback
    if (header.includes('תיאור') && header.includes('חיוב') && header.includes('זיכוי')) {
        return 'leumi';
    }
    if (header.includes('סוג פעולה') || header.includes('משיכה') || header.includes('הפקדה')) {
        return 'mizrahi';
    }
    if (header.includes('amount') || header.includes('סכום')) {
        return 'beinleumi';
    }
    
    return 'unknown';
};

/**
 * 3. לוגיקת הזיהוי האוטומטי (להוסיף ב-Parser Manager)
 * Supports garbage line skipping by concatenating first few lines
 */
export const detectBank = (firstLine, secondLine, headers) => {
    const combined = (firstLine + (secondLine || '') + (headers || '')).toLowerCase();
    
    if (combined.includes('יתרה בש"ח') || combined.includes('הפעולה')) {
        return 'hapoalim'; // Normalized to internal key
    }
    if (combined.includes('זכות/חובה') || combined.includes('תיאור התנועה')) {
        return 'discount'; // Normalized to internal key
    }
    
    // Fallback to standard detection if no special match
    return detectBankFromHeader(combined);
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
    // דילוג על שורות כותרת - מחפש תבנית של תאריך YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}/;
    if (!row[0] || !dateRegex.test(row[0])) return null;

    return {
        date: row[0],
        description: row[1],
        subDescription: row[2],
        debit: parseFloat(row[4]) || 0,  // עמודה 5 - חובה
        credit: parseFloat(row[5]) || 0, // עמודה 6 - זכות
        balance: parseFloat(row[6]) || 0 // עמודה 7 - יתרה
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
    // דילוג על שורות כותרת - בדרך כלל מתחיל בשורה 8
    const dateRegex = /^\d{4}-\d{2}-\d{2}/;
    if (!row[0] || !dateRegex.test(row[0])) return null;

    // בדיסקונט יש עמודה אחת לסכום (אינדקס 3) - חיובי זה זכות, שלילי זה חובה
    const rawAmount = row[3] ? row[3].toString().replace(/[^\d.-]/g, '') : "0";
    const amount = parseFloat(rawAmount) || 0;

    return {
        date: row[0],
        description: row[2], // תיאור התנועה
        debit: amount < 0 ? Math.abs(amount) : 0,
        credit: amount > 0 ? amount : 0,
        balance: parseFloat(row[4].toString().replace(/[^\d.-]/g, '')) || 0
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