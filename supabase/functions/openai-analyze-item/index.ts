import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrls, title, description, category } = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
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
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (response.status === 402) {
        throw new Error("OpenAI credits exhausted. Please contact support.");
      }
      throw new Error("OpenAI analysis failed");
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});