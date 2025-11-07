import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const validateInput = (input: any) => {
  if (!input.imageUrls || !Array.isArray(input.imageUrls)) {
    throw new Error('imageUrls must be an array');
  }
  if (input.imageUrls.length < 1 || input.imageUrls.length > 10) {
    throw new Error('imageUrls must contain 1-10 URLs');
  }
  
  const title = String(input.title || '').trim().slice(0, 200);
  const description = String(input.description || '').trim().slice(0, 2000);
  const category = String(input.category || '').trim().slice(0, 100);
  
  // Block prompt injection patterns
  const suspiciousPatterns = [
    /ignore.*(previous|above|system).*(instruction|prompt|rule)/gi,
    /repeat.*(prompt|instruction|system)/gi,
    /you are now/gi,
    /DAN mode/gi,
    /forget.*instead/gi,
  ];
  
  const textToCheck = `${title} ${description}`;
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(textToCheck)) {
      throw new Error('Invalid input detected');
    }
  }
  
  return { 
    imageUrls: input.imageUrls,
    title, 
    description, 
    category 
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    // Rate limiting: 5 analyses per hour
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const { data: allowed } = await supabaseClient.rpc('check_rate_limit', {
      p_user_id: user.id,
      p_ip_address: ipAddress,
      p_action: 'ai_item_analysis',
      p_max_attempts: 5,
      p_window_seconds: 3600
    });

    if (allowed === false) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Rate limit exceeded. Maximum 5 analyses per hour.' 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and sanitize input
    const rawInput = await req.json();
    const { imageUrls, title, description, category } = validateInput(rawInput);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    if (!OPENAI_API_KEY) {
      throw new Error("Service configuration error");
    }

    // Download and convert images to base64
    const imagePromises = imageUrls.slice(0, 4).map(async (url: string) => {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      return base64;
    });

    const base64Images = await Promise.all(imagePromises);

    const analysisPrompt = `You are an expert product analyst specializing in rental marketplaces. Analyze these product images in detail.

Current item info:
- Title: ${title || 'Not provided'}
- Description: ${description || 'Not provided'}
- Category: ${category || 'Not provided'}

COMPREHENSIVE ANALYSIS REQUIRED:

1. **Brand & Model Detection** (25% weight):
   - Identify exact brand, model, year if possible
   - Detect logos, brand markings, serial numbers
   - Differentiate genuine from replica/counterfeit

2. **Condition Assessment** (25% weight):
   - Overall condition: Excellent/Good/Fair/Poor
   - Visible damage: scratches, dents, discoloration, wear
   - Functional concerns: missing parts, broken components
   - Cleanliness and maintenance level

3. **Authenticity Check** (20% weight):
   - Is this a genuine product or counterfeit?
   - Check for authentic packaging, labels, materials
   - Flag luxury items that may be fake
   - Confidence score: 0-100

4. **Market Intelligence** (15% weight):
   - Estimated retail price (new)
   - Typical used/rental market value
   - Demand level: High/Medium/Low
   - Seasonal trends if applicable

5. **Category Optimization** (10% weight):
   - Is the current category accurate?
   - Suggest better category/subcategory
   - Multi-level categorization

6. **SEO & Marketing** (5% weight):
   - Generate 5-10 relevant keywords
   - Suggest improved title (under 60 chars)
   - Suggest compelling description highlights

7. **Safety & Compliance**:
   - Flag if item is prohibited (weapons, drugs, hazardous)
   - Note any safety concerns
   - Compliance issues (licenses needed, age restrictions)

Return ONLY valid JSON (no markdown, no extra text):
{
  "brandDetected": "string or null",
  "modelDetected": "string or null",
  "yearDetected": number or null,
  "condition": "excellent" | "good" | "fair" | "poor",
  "damageAssessment": {
    "hasVisibleDamage": boolean,
    "damageTypes": ["scratch", "dent", "discoloration", "wear"],
    "severity": "minor" | "moderate" | "severe",
    "details": "string description"
  },
  "authenticityScore": 0-100,
  "isLikelyCounterfeit": boolean,
  "marketIntelligence": {
    "estimatedRetailPrice": number or null,
    "estimatedUsedValue": number or null,
    "suggestedDailyRentalPrice": number or null,
    "demandLevel": "high" | "medium" | "low",
    "seasonalNotes": "string or null"
  },
  "categoryOptimization": {
    "currentCategoryAccurate": boolean,
    "suggestedCategory": "string",
    "suggestedSubcategory": "string or null",
    "confidence": 0-100
  },
  "seoKeywords": ["keyword1", "keyword2", "..."],
  "suggestedTitle": "string under 60 chars",
  "descriptionHighlights": ["highlight1", "highlight2", "..."],
  "safetyFlags": {
    "isProhibited": boolean,
    "prohibitionReason": "string or null",
    "safetyWarnings": ["warning1", "warning2", "..."],
    "requiresLicense": boolean,
    "ageRestriction": number or null
  },
  "overallScore": 0-100,
  "recommendation": "approve" | "needs_improvement" | "reject"
}`;

    console.log('Calling OpenAI for item analysis...');
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: analysisPrompt },
              ...base64Images.map((base64: string) => ({
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${base64}` }
              }))
            ]
          }
        ],
        max_completion_tokens: 2000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI analysis failed:", response.status, errorText);
      
      if (response.status === 429) {
        throw new Error("RATE_LIMIT");
      }
      if (response.status === 402) {
        throw new Error("CREDITS_EXHAUSTED");
      }
      throw new Error("SERVICE_ERROR");
    }

    const data = await response.json();
    const analysisContent = data.choices[0].message.content;
    const analysis = JSON.parse(analysisContent);

    console.log('Item analysis complete');

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        model: "gpt-5-mini"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Item analysis error:", error);
    
    // Generic error messages for security
    let userMessage = "An error occurred processing your request.";
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message === 'RATE_LIMIT' || error.message === 'CREDITS_EXHAUSTED') {
        userMessage = "Service temporarily unavailable. Please try again later.";
        statusCode = 503;
      } else if (error.message.includes('Authentication') || error.message.includes('Rate limit')) {
        userMessage = error.message;
        statusCode = error.message.includes('Rate limit') ? 429 : 401;
      } else if (error.message.includes('Invalid input')) {
        userMessage = "Invalid input provided.";
        statusCode = 400;
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: userMessage
      }),
      { 
        status: statusCode, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
