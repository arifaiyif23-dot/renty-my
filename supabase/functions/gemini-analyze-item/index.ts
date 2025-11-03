import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrls, userInput } = await req.json();
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Download images and convert to base64
    const imageParts = await Promise.all(
      imageUrls.map(async (url: string) => {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        return {
          inline_data: {
            mime_type: 'image/jpeg',
            data: base64
          }
        };
      })
    );

    const prompt = `Analyze these images of an item that will be listed for rent. ${userInput ? `User notes: ${userInput}` : ''}

Generate a comprehensive listing with:
1. Catchy title (max 60 chars)
2. Detailed description (150-300 words) highlighting key features, condition, and rental benefits
3. Category (choose from: electronics, sports, tools, furniture, vehicles, fashion, books, toys, other)
4. Suggested price per day in MYR (competitive market rate)
5. Estimated condition (excellent, good, fair, poor)
6. Key tags (5-8 relevant keywords)

Return ONLY a JSON object with this exact structure:
{
  "title": "...",
  "description": "...",
  "category": "...",
  "suggestedPrice": 50,
  "condition": "good",
  "tags": ["tag1", "tag2"],
  "confidence": 0.95
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              ...imageParts
            ]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Gemini API error:', error);
      throw new Error(`Gemini API failed: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    
    // Extract JSON from potential markdown code blocks
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse Gemini response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in gemini-analyze-item:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
