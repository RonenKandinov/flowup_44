// PII Sanitizer for FlowUp
// Strips potentially sensitive information from transaction descriptions

export const sanitizeText = (text) => {
    if (!text) return '';

    let sanitized = text;

    // Remove Israeli Phone Numbers (simple patterns)
    // 05X-XXXXXXX, 0X-XXXXXXX
    sanitized = sanitized.replace(/0\d{1,2}-?\d{7}/g, '[PHONE]');

    // Remove Email Addresses
    sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');

    // Remove Credit Card Numbers (16 digits or 4-4-4-4)
    sanitized = sanitized.replace(/\b(?:\d{4}[ -]?){3}\d{4}\b/g, '[CARD]');

    // Remove Teudat Zehut (9 digits sequence - aggressive)
    // sanitized = sanitized.replace(/\b\d{9}\b/g, '[ID]'); 
    // Commented out as it might catch legitimate invoice numbers. 

    return sanitized;
};

export const sanitizeTransaction = (transaction) => {
    return {
        ...transaction,
        description: sanitizeText(transaction.description)
    };
};