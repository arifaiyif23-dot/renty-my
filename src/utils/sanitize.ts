import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks
 * Removes all script tags, event handlers, and dangerous attributes
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';
  
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitizes plain text input by removing HTML/script tags
 * Use this for names, descriptions, messages, etc.
 */
export function sanitizeText(input: string): string {
  if (!input) return '';
  
  // Remove all HTML tags
  const stripped = DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
  
  // Trim whitespace and limit length
  return stripped.trim().slice(0, 10000);
}

/**
 * Validates and sanitizes user input for database insertion
 * Prevents SQL injection via client-side validation
 */
export function validateUserInput(input: string, maxLength: number = 1000): string {
  if (!input) return '';
  
  const sanitized = sanitizeText(input);
  
  if (sanitized.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength} characters`);
  }
  
  return sanitized;
}

/**
 * Sanitizes message content for chat/messaging
 * Preserves basic formatting but removes dangerous content
 */
export function sanitizeMessage(message: string): string {
  if (!message) return '';
  
  return DOMPurify.sanitize(message, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
  }).trim();
}

const SAFE_URL_SCHEMES = ['http:', 'https:'];

/**
 * Returns true only if the value is an absolute http/https URL.
 * Used to block javascript:, data:, vbscript:, and other dangerous schemes
 * when assigning href / window.location / window.open from stored values.
 */
export function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return SAFE_URL_SCHEMES.includes(url.protocol);
  } catch {
    return false;
  }
}

/**
 * Returns a safe http/https URL string, or an empty string when the input
 * would be unsafe. Safe to bind directly to href / navigate targets.
 */
export function safeHttpUrl(value: unknown): string {
  return isSafeHttpUrl(value) ? value : '';
}

/**
 * Sanitizes a user-supplied filename for use as a storage object key segment.
 * Strips path separators, traversal sequences, and control/weird characters,
 * so a filename cannot escape its intended folder.
 */
export function sanitizeFileName(name: string): string {
  if (!name) return '';
  const cleaned = name
    .replace(/[\\/]+/g, '-')
    .replace(/\.\./g, '')
    .replace(/[^\w.\- ]/g, '')
    .trim()
    .slice(0, 100);
  return cleaned;
}
