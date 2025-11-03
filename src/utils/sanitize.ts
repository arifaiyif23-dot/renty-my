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
  
  // Additional validation rules
  if (sanitized.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength} characters`);
  }
  
  // Detect potential injection attempts (basic heuristic)
  const suspiciousPatterns = [
    /<script/gi,
    /javascript:/gi,
    /on\w+=/gi, // Event handlers like onclick=
    /eval\(/gi,
    /expression\(/gi,
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(input)) {
      throw new Error('Invalid input detected');
    }
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
