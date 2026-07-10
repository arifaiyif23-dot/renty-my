import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface ValidationResult {
  isValid: boolean;
  detectedKeywords: string[];
  detectedPatterns: string[];
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

function validateContent(title: string, description: string): ValidationResult {
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
      reason = 'Listing contains contact information or links which are not allowed.';
    } else {
      reason = 'Listing appears to be advertising a service rather than a rental item.';
    }
  }
  
  return {
    isValid: !isBlocked,
    detectedKeywords: [...new Set(detectedKeywords)],
    detectedPatterns: [...new Set(detectedPatterns)],
    reason,
    severity,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is suspended
    const { error: suspendError } = await supabase.rpc('check_user_not_suspended', {
      p_user_id: user.id
    });
    if (suspendError) {
      return new Response(
        JSON.stringify({ error: 'Your account has been suspended. Contact support for assistance.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { title, description } = await req.json();
    
    if (!title || !description) {
      return new Response(
        JSON.stringify({ error: 'Title and description are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Validating content for user ${user.id}`);
    
    const result = validateContent(title, description);
    
    // Log blocked attempts
    if (!result.isValid) {
      console.log(`Content blocked for user ${user.id}:`, {
        detectedKeywords: result.detectedKeywords,
        detectedPatterns: result.detectedPatterns,
        severity: result.severity
      });

      await supabase.from('content_moderation_log').insert({
        user_id: user.id,
        content_type: 'listing',
        blocked_content: `Title: ${title.substring(0, 100)}... Description: ${description.substring(0, 200)}...`,
        detected_keywords: [...result.detectedKeywords, ...result.detectedPatterns],
        action_taken: 'blocked',
      });
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error validating content:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
