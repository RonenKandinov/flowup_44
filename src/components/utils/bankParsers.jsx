/**
 * FlowUp Multi-Bank CSV Parser System
 * ====================================
 * Supports: Bank Hapoalim, Bank Leumi, Discount, Mizrahi-Tefahot, First International
 * Each bank has a dedicated parser due to different CSV structures
 */

// פונקציית העזר שהופכת לכלוך למספרים
const toNum = (v) => {
  if (!v) return 0;
  // מסיר הכל חוץ ממספרים, נקודה עשרונית ומינוס
  let str = v.toString().replace(/[^\d.-]/g, '').trim();
  // אם המינוס בסוף (נפוץ בבנקים), מעביר אותו להתחלה
  if (str.endsWith('-')) str = '-' + str.slice(0, -1);
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
    // Expanded to catch formats without 'חשבון' but with 'פרטים' and 'יתרה' or 'סכום'
    // Also catches "תיאור התנועה" + "זכות/חובה" (The specific Excel format you provided)
    if ((header.includes('פרטים') || header.includes('תיאור התנועה')) && (header.includes('חשבון') || header.includes('יתרה') || header.includes('סכום') || header.includes('זכות/חובה'))) {
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
    if (header.includes('זכות/חובה')) {
        return 'israeli_general';
    }

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
 * פרסר פועלים (ארתור והקובץ שלך)
 */
export const parsePoalimRow = (row, headers) => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}/;
  if (!row[0] || !dateRegex.test(row[0].trim())) return null;

  // בפועלים העמודות קבועות בדרך כלל: חובה (4), זכות (5), יתרה (6)
  return {
    date: row[0].trim(),
    description: row[1]?.trim() || 'תנועה',
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
 * פרסר דיסקונט (איזיק וז'נטה) - הפיצוח
 */
export const parseDiscountRow = (row, headers) => {
  // CTO Fix: Relaxed date regex to accept 1/27/2026 format (slashes) AND 2026-01-27 (dashes)
  // Also checks length > 5 to filter out empty/garbage rows
  const dateStr = row[0]?.trim();
  if (!dateStr || dateStr.length < 5 || !/\d/.test(dateStr)) return null;

  // בדיסקונט: עמודה 3 זה תיאור (תיאור התנועה), עמודה 4 זה זכות/חובה (D)
  // Note: indices are 0-based. A=0, B=1, C=2, D=3, E=4
  const amount = toNum(row[3]);

  return {
    date: dateStr,
    description: row[2]?.trim() || 'תנועה',
    // כאן התיקון: מינוס הופך ל-debit, פלוס ל-credit
    debit: amount < 0 ? Math.abs(amount) : 0,
    credit: amount > 0 ? amount : 0,
    balance: toNum(row[4])
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
        date: row[dateIdx]?.trim() || '',
        description: (descIdx !== -1 ? row[descIdx] : '')?.trim() || 'תנועה',
        debit,
        credit,
        balance: balanceIdx !== -1 ? toNum(row[balanceIdx]) : 0
    };
};

/**
 * Parse General Israeli Bank CSV (Yahav/Otzar/General)
 * Format: Date, Value Date, Description, Amount (Zchut/Hova), Balance
 * Columns: A=Date, B=ValueDate, C=Description, D=Amount, E=Balance
 */
export const parseIsraeliGeneralRow = (row, headers) => {
    // Try to find columns dynamically first
    const dateIdx = findColumn(headers, ['תאריך']);
    const descIdx = findColumn(headers, ['תיאור', 'פרטים']);
    const amountIdx = findColumn(headers, ['זכות/חובה', 'סכום']);
    const balanceIdx = findColumn(headers, ['יתרה']);

    // Fallback to fixed indices if detection fails (based on user image)
    // Image: A=Date(0), C=Desc(2), D=Amount(3), E=Balance(4)
    const finalDateIdx = dateIdx !== -1 ? dateIdx : 0;
    const finalDescIdx = descIdx !== -1 ? descIdx : 2;
    const finalAmountIdx = amountIdx !== -1 ? amountIdx : 3;
    const finalBalanceIdx = balanceIdx !== -1 ? balanceIdx : 4;

    const dateStr = row[finalDateIdx]?.trim();
    if (!dateStr || dateStr.length < 5) return null;

    const amount = toNum(row[finalAmountIdx]);

    return {
        date: dateStr,
        description: row[finalDescIdx]?.trim() || 'תנועה',
        debit: amount < 0 ? Math.abs(amount) : 0,
        credit: amount > 0 ? amount : 0,
        balance: toNum(row[finalBalanceIdx])
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
        case 'israeli_general':
            return parseIsraeliGeneralRow(row, headers);
        case 'universal':
            return parseUniversalRow(row, headers);
        default:
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