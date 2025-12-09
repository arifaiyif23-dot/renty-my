/**
 * Content Moderation Utility
 * Detects banned keywords related to services masquerading as rental items
 */

// Banned keywords in Malay
const BANNED_KEYWORDS_MALAY = [
  'servis', 'perkhidmatan', 'hubungi', 'telefon', 'panggil',
  'urut', 'urutan', 'massage', 'refleksi', 'spa',
  'baiki', 'repair', 'cuci', 'cleaning', 'bersih',
  'hantar', 'delivery', 'penghantaran',
  'upah', 'bayaran', 'caj', 'fee',
  'freelance', 'kerja', 'job', 'part time',
  'driver', 'pemandu', 'runner',
  'tukang', 'contractor', 'kontraktor',
  'tutor', 'tuition', 'kelas', 'belajar',
  'photoshoot', 'photographer', 'jurugambar',
  'makeup', 'mekap', 'bridal', 'pengantin',
  'catering', 'katering', 'masak',
  'escort', 'teman', 'companion',
];

// Banned keywords in English
const BANNED_KEYWORDS_ENGLISH = [
  'service', 'services', 'serving', 
  'contact me', 'call me', 'message me', 'text me',
  'dm me', 'pm me', 'inbox me',
  'whatsapp me', 'telegram me',
  'hire me', 'available for hire', 'for hire',
  'booking available', 'slot available',
  'massage service', 'home service', 'outcall', 'incall',
  'repair service', 'cleaning service', 'delivery service',
  'freelancer', 'freelance work',
  'tutor available', 'tuition class',
  'photographer available', 'photo service',
  'makeup artist', 'mua available',
  'catering service', 'food service',
  'driver available', 'grab driver',
  'looking for customer', 'need customer',
];

// Patterns that indicate service listings
const BANNED_PATTERNS = [
  /\+?6?01\d[\s-]?\d{3,4}[\s-]?\d{4}/g,  // Malaysian phone numbers
  /wa\.me\/\d+/gi,                        // WhatsApp links
  /t\.me\/\w+/gi,                         // Telegram links
  /bit\.ly\/\w+/gi,                       // Shortened URLs
  /tinyurl\.com\/\w+/gi,
  /@\w+\s*(whatsapp|telegram|wa|tg)/gi,  // Social handles with messaging apps
  /whatsapp\s*:?\s*\d+/gi,               // WhatsApp with number
  /telegram\s*:?\s*@?\w+/gi,             // Telegram handle
  /call\s*(now|me|us)\s*:?\s*\d*/gi,     // Call to action with number
  /dm\s*(for|to)\s*(price|booking|more|detail)/gi, // DM for pricing
  /pm\s*(for|to)\s*(price|booking|more|detail)/gi, // PM for pricing
];

// Phrases that strongly indicate services
const BANNED_PHRASES = [
  'hubungi saya',
  'hubungi kami', 
  'call for booking',
  'whatsapp for booking',
  'slot available',
  'accepting booking',
  'open for booking',
  'taking order',
  'terima tempahan',
  'available 24 jam',
  'available 24 hours',
  'area covered',
  'kawasan liputan',
  'home visit',
  'rumah ke rumah',
  'door to door',
];

export interface ModerationResult {
  isBlocked: boolean;
  detectedKeywords: string[];
  detectedPatterns: string[];
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Detects banned content in title and description
 */
export function detectBannedContent(title: string, description: string): ModerationResult {
  const combinedText = `${title} ${description}`.toLowerCase();
  const detectedKeywords: string[] = [];
  const detectedPatterns: string[] = [];
  
  // Check for banned keywords (Malay)
  for (const keyword of BANNED_KEYWORDS_MALAY) {
    const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'gi');
    if (regex.test(combinedText)) {
      detectedKeywords.push(keyword);
    }
  }
  
  // Check for banned keywords (English)
  for (const keyword of BANNED_KEYWORDS_ENGLISH) {
    const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'gi');
    if (regex.test(combinedText)) {
      detectedKeywords.push(keyword);
    }
  }
  
  // Check for banned phrases
  for (const phrase of BANNED_PHRASES) {
    if (combinedText.includes(phrase.toLowerCase())) {
      detectedKeywords.push(phrase);
    }
  }
  
  // Check for banned patterns (phone numbers, links, etc.)
  for (const pattern of BANNED_PATTERNS) {
    const matches = combinedText.match(pattern);
    if (matches) {
      detectedPatterns.push(...matches);
    }
  }
  
  // Determine if content should be blocked
  const hasKeywords = detectedKeywords.length > 0;
  const hasPatterns = detectedPatterns.length > 0;
  const isBlocked = hasPatterns || detectedKeywords.length >= 2;
  
  // Determine severity
  let severity: 'low' | 'medium' | 'high' = 'low';
  if (hasPatterns && hasKeywords) {
    severity = 'high';
  } else if (hasPatterns || detectedKeywords.length >= 3) {
    severity = 'high';
  } else if (detectedKeywords.length >= 2) {
    severity = 'medium';
  }
  
  // Generate reason message
  let reason = '';
  if (isBlocked) {
    if (hasPatterns) {
      reason = 'Listing contains contact information or links which are not allowed. Please list only physical items for rent.';
    } else {
      reason = 'Listing appears to be advertising a service rather than a rental item. Only physical items can be listed for rent.';
    }
  }
  
  return {
    isBlocked,
    detectedKeywords: [...new Set(detectedKeywords)], // Remove duplicates
    detectedPatterns: [...new Set(detectedPatterns)],
    reason,
    severity,
  };
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlights detected keywords in text for UI display
 */
export function highlightBannedWords(text: string, keywords: string[]): string {
  let highlightedText = text;
  for (const keyword of keywords) {
    const regex = new RegExp(`\\b(${escapeRegex(keyword)})\\b`, 'gi');
    highlightedText = highlightedText.replace(regex, '**$1**');
  }
  return highlightedText;
}
