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

// Excel Date Converter (Serial to ISO)
const convertExcelDate = (excelDate) => {
    // Excel base date is Dec 30, 1899. 25569 is the offset to Unix Epoch (Jan 1, 1970)
    const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
};

/**
 * Detect bank type from CSV header row
 * Now scans multiple lines if needed to find the actual header
 */
export const detectBankFromHeader = (headerRow) => {
    const header = headerRow.toLowerCase();
    
    // Skip title rows like "תנועות בחשבון"
    if (header.includes('תנועות בחשבון') || header.includes('מספר חשבון')) {
        return 'needs_next_line';
    }
    
    // Excel Statement Format - MUST BE FIRST (most specific)
    // Wide format with: הפעולה + אסמכתא + חובה + זכות + יתרה בש"ח
    if (header.includes('הפעולה') && header.includes('אסמכתא') && 
        header.includes('חובה') && header.includes('זכות')) {
        return 'excel_statement';
    }
    
    // Bank Hapoalim - תאריך, תיאור הפעולה (without אסמכתא)
    if (header.includes('תיאור הפעולה') || 
        (header.includes('תאריך ערך') && !header.includes('אסמכתא'))) {
        return 'hapoalim';
    }
    
    // Bank Leumi - Date, Details, Debit, Credit, Balance
    if (header.includes('תיאור') && header.includes('חיוב') && header.includes('זיכוי')) {
        return 'leumi';
    }
    
    // Discount Bank - תאריך פעולה, פרטים, חובה/זכות, יתרה
    if (header.includes('פרטים') && header.includes('חשבון') && !header.includes('אסמכתא')) {
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
    const descIdx = findColumn(headers, ['תיאור', 'הפעולה']);
    const detailsIdx = findColumn(headers, ['פרטים']);
    const debitIdx = findColumn(headers, ['חובה', 'חיוב']);
    const creditIdx = findColumn(headers, ['זכות', 'זיכוי']);
    const balanceIdx = findColumn(headers, ['יתרה']);
    
    if (dateIdx === -1 || balanceIdx === -1) return null;
    
    // Handle date format (DD.MM.YYYY or DD/MM/YYYY)
    let dateVal = row[dateIdx]?.toString().trim() || '';
    if (dateVal.includes('.')) {
        const parts = dateVal.split('.');
        if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            let year = parts[2];
            if (year.length === 2) year = '20' + year;
            dateVal = `${day}/${month}/${year}`;
        }
    }
    
    // Build description from operation + details if available
    let description = '';
    if (descIdx !== -1 && row[descIdx]) {
        description = row[descIdx].toString().trim();
    }
    if (detailsIdx !== -1 && row[detailsIdx]) {
        const details = row[detailsIdx].toString().trim();
        if (details && details !== description) {
            description = description ? `${description} - ${details}` : details;
        }
    }
    if (!description) description = 'תנועה';
    
    return {
        date: dateVal,
        description,
        details: detailsIdx !== -1 ? row[detailsIdx]?.toString().trim() : '',
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
 * Parse Excel Statement Format (Wide Bank Statement)
 * Format: תאריך | הפעולה | פרטים | אסמכתא | חובה | זכות | יתרה בש"ח | תאריך ערך | (more cols)
 * This handles the multi-column Excel export format common in Israeli banks
 */
export const parseExcelStatementRow = (row, headers) => {
    // Find columns - Excel statements have a predictable structure
    const dateIdx = findColumn(headers, ['תאריך']);
    const operationIdx = findColumn(headers, ['הפעולה']);
    const detailsIdx = findColumn(headers, ['פרטים']);
    const debitIdx = findColumn(headers, ['חובה']);
    const creditIdx = findColumn(headers, ['זכות']);
    const balanceIdx = findColumn(headers, ['יתרה', 'יתרה בש"ח', 'יתרה לאחר']);
    
    // Must have at least date column
    if (dateIdx === -1) return null;
    
    // Get date value and handle potential Excel numeric dates
    let dateVal = row[dateIdx];
    if (typeof dateVal === 'number') {
        dateVal = convertExcelDate(dateVal);
    } else {
        dateVal = dateVal?.toString().trim() || '';
        
        // Skip rows with #### or empty dates
        if (!dateVal || dateVal.includes('#')) return null;
        
        // Handle DD.MM.YYYY format
        if (dateVal.includes('.')) {
            const parts = dateVal.split('.');
            if (parts.length === 3) {
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                let year = parts[2];
                if (year.length === 2) year = '20' + year;
                dateVal = `${day}/${month}/${year}`;
            }
        } 
        // Handle M/D/YYYY (American) or DD/MM/YYYY (European) formats
        else if (dateVal.includes('/')) {
            const parts = dateVal.split('/');
            if (parts.length === 3) {
                // Detect format: if year is first (YYYY/MM/DD) or last
                if (parts[0].length === 4) {
                    // YYYY/MM/DD format
                    const year = parts[0];
                    const month = parts[1].padStart(2, '0');
                    const day = parts[2].padStart(2, '0');
                    dateVal = `${day}/${month}/${year}`;
                } else if (parts[2].length === 4) {
                    // M/D/YYYY or DD/MM/YYYY format
                    const month = parts[0].padStart(2, '0');
                    const day = parts[1].padStart(2, '0');
                    const year = parts[2];
                    
                    // Smart detection: if day > 12, swap (it must be DD/MM)
                    // Otherwise trust M/D (American format)
                    if (parseInt(parts[1]) > 12) {
                        // DD/MM/YYYY - swap back
                        dateVal = `${day}/${month}/${year}`;
                    } else {
                        // M/D/YYYY - swap to DD/MM/YYYY
                        dateVal = `${day}/${month}/${year}`;
                    }
                }
            }
        } 
        else {
            // Not a valid date format
            return null;
        }
    }
    
    if (!dateVal) return null;
    
    // Build description from operation + details
    let description = '';
    if (operationIdx !== -1 && row[operationIdx]) {
        const op = row[operationIdx].toString().trim();
        // Skip rows with only #### symbols or empty
        if (op && op !== '########' && !op.startsWith('####')) {
            description = op;
        }
    }
    if (detailsIdx !== -1 && row[detailsIdx]) {
        const details = row[detailsIdx].toString().trim();
        // Skip if details are #### or empty
        if (details && details !== '########' && !details.startsWith('####') && details !== description) {
            description = description ? `${description} - ${details}` : details;
        }
    }
    
    // If still no description, try to use any non-empty cell as fallback
    if (!description) {
        for (let i = 0; i < row.length; i++) {
            const val = row[i]?.toString().trim();
            if (val && val !== '########' && !val.startsWith('####') && val.length > 2 && isNaN(val)) {
                description = val;
                break;
            }
        }
    }
    
    if (!description || description === '########') return null; // Skip rows without valid description
    
    // Get amounts - skip if both are 0 or invalid
    const debit = debitIdx !== -1 ? toNum(row[debitIdx]) : 0;
    const credit = creditIdx !== -1 ? toNum(row[creditIdx]) : 0;
    
    if (debit === 0 && credit === 0) return null;
    
    const balance = balanceIdx !== -1 ? toNum(row[balanceIdx]) : 0;
    
    return {
        date: dateVal,
        description,
        details: detailsIdx !== -1 ? row[detailsIdx]?.toString().trim() : '',
        debit,
        credit,
        balance
    };
};

/**
 * Parse Universal/Generic CSV Row (Robust Mode)
 * Implements fuzzy matching and robust error handling
 */
export const parseUniversalRow = (row, headers) => {
    // 1. Dynamic Column Mapping (Fuzzy Match)
    const dateIdx = findColumn(headers, ['תאריך', 'date', 'ערך']);
    const descIdx = findColumn(headers, ['פרטים', 'תיאור', 'details', 'פעולה', 'description', 'סוג פעולה']);
    
    // Money - Two Columns Strategy
    const debitIdx = findColumn(headers, ['חובה', 'חיוב', 'debit', 'משיכה']);
    const creditIdx = findColumn(headers, ['זכות', 'זיכוי', 'credit', 'הפקדה']);
    
    // Money - Single Column Strategy
    const amountIdx = findColumn(headers, ['סכום', 'amount', 'זכות/חובה']);
    
    const balanceIdx = findColumn(headers, ['יתרה', 'balance']);

    // 2. Noise Filtering - Skip if no date column found
    if (dateIdx === -1) return null;

    let dateVal = row[dateIdx];
    
    // Handle numeric Excel dates or string dates
    if (typeof dateVal === 'number') {
        dateVal = convertExcelDate(dateVal);
    } else {
        dateVal = dateVal?.toString().trim() || '';
        // Check if string is actually a number (Excel serial in CSV)
        if (dateVal && !isNaN(dateVal) && dateVal.length >= 4 && !dateVal.includes('/') && !dateVal.includes('.')) {
            dateVal = convertExcelDate(parseFloat(dateVal));
        }
    }

    // Noise Filtering - Skip if date value is empty after conversion
    if (!dateVal) return null;

    let debit = 0;
    let credit = 0;

    // 3. Logic: Debit/Credit vs Single Amount
    if (debitIdx !== -1 || creditIdx !== -1) {
        // Two columns strategy
        if (debitIdx !== -1) debit = toNum(row[debitIdx]);
        if (creditIdx !== -1) credit = toNum(row[creditIdx]);
    } else if (amountIdx !== -1) {
        // Single column strategy
        const amount = toNum(row[amountIdx]);
        if (amount < 0) {
            debit = Math.abs(amount);
        } else {
            credit = amount;
        }
    }

    return {
        date: dateVal,
        description: (descIdx !== -1 ? row[descIdx] : '')?.toString().trim() || 'תנועה',
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
        case 'excel_statement':
            return parseExcelStatementRow(row, headers);
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
        excel_statement: 'דוח אקסל',
        unknown: 'לא מזוהה'
    };
    return names[bankType] || 'לא מזוהה';
};