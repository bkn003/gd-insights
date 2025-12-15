// Security utility functions for input sanitization

/**
 * Sanitize text input to prevent XSS attacks
 * Removes potential script tags and dangerous HTML
 */
export const sanitizeText = (input: string): string => {
    if (!input || typeof input !== 'string') return '';

    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')
        .trim();
};

/**
 * Validate and sanitize notes/comments input
 */
export const sanitizeNotes = (notes: string, maxLength: number = 1000): string => {
    if (!notes || typeof notes !== 'string') return '';

    // Trim and limit length
    const trimmed = notes.trim().substring(0, maxLength);

    // Remove script tags and event handlers
    return trimmed
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/javascript:/gi, '');
};

/**
 * Validate UUID format
 */
export const isValidUUID = (id: string): boolean => {
    if (!id || typeof id !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
};

/**
 * Validate required fields before Supabase operations
 */
export const validateGDEntry = (entry: {
    category_id?: string;
    size_id?: string;
    shop_id?: string;
    notes?: string;
}): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!entry.category_id || !isValidUUID(entry.category_id)) {
        errors.push('Invalid category');
    }
    if (!entry.size_id || !isValidUUID(entry.size_id)) {
        errors.push('Invalid size');
    }
    if (!entry.shop_id || !isValidUUID(entry.shop_id)) {
        errors.push('Invalid shop');
    }

    return { valid: errors.length === 0, errors };
};
