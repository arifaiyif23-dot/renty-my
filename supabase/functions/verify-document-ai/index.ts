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
    const { 
      documentFrontUrl, 
      documentBackUrl, 
      selfieUrl, 
      documentType 
    } = await req.json();

    console.log('Starting AI verification for document type:', documentType);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Download images from storage
    console.log('Downloading images from storage...');
    const [frontResponse, selfieResponse] = await Promise.all([
      fetch(documentFrontUrl),
      fetch(selfieUrl)
    ]);

    if (!frontResponse.ok || !selfieResponse.ok) {
      throw new Error("Failed to download images from storage");
    }

    const [frontImage, selfieImage] = await Promise.all([
      frontResponse.arrayBuffer(),
      selfieResponse.arrayBuffer()
    ]);

    // Convert to base64
    const frontBase64 = btoa(String.fromCharCode(...new Uint8Array(frontImage)));
    const selfieBase64 = btoa(String.fromCharCode(...new Uint8Array(selfieImage)));

    console.log('Images downloaded and converted to base64');

    // Step 1: Extract data from document using AI
    const extractionPrompt = `You are an expert document verification system. Analyze this ${documentType} and extract:
1. Full name (exactly as shown on document)
2. IC/Passport number
3. Date of birth (format: YYYY-MM-DD)
4. Document quality score (0-100) - check for blur, glare, cropping issues, completeness
5. Any signs of tampering or forgery

Return ONLY valid JSON with this structure:
{
  "fullName": "string",
  "documentNumber": "string",
  "dateOfBirth": "YYYY-MM-DD",
  "qualityScore": number,
  "tamperingDetected": boolean,
  "qualityIssues": ["issue1", "issue2"]
}`;

    console.log('Calling AI for document extraction...');
    const extractionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: extractionPrompt },
              { 
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${frontBase64}`
                }
              }
            ]
          }
        ]
      }),
    });

    if (!extractionResponse.ok) {
      const errorText = await extractionResponse.text();
      console.error("AI extraction failed:", extractionResponse.status, errorText);
      
      if (extractionResponse.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (extractionResponse.status === 402) {
        throw new Error("AI credits exhausted. Please contact support.");
      }
      throw new Error("AI extraction failed");
    }

    const extractionData = await extractionResponse.json();
    console.log('Document extraction complete');
    
    const extractedContent = extractionData.choices[0].message.content;
    const extractedInfo = JSON.parse(extractedContent);

    // Step 2: Face matching between document and selfie
    const faceMatchPrompt = `Compare the face in these two images:
1. First image: Official document photo (IC/Passport)
2. Second image: Live selfie

Analyze and return ONLY valid JSON:
{
  "faceMatchScore": number (0-100, confidence that same person),
  "livenessScore": number (0-100, confidence selfie is live not photo of photo),
  "analysis": "brief explanation",
  "suspiciousIndicators": ["indicator1", "indicator2"]
}

Look for:
- Facial features match (eyes, nose, mouth structure)
- Age consistency
- Selfie shows signs of liveness (natural lighting, slight motion blur, not a printed photo)
- Selfie is not a photo of a photo (check for screen glare, frame edges)`;

    console.log('Calling AI for face matching...');
    const faceMatchResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: faceMatchPrompt },
              { 
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${frontBase64}` }
              },
              { 
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${selfieBase64}` }
              }
            ]
          }
        ]
      }),
    });

    if (!faceMatchResponse.ok) {
      const errorText = await faceMatchResponse.text();
      console.error("AI face matching failed:", faceMatchResponse.status, errorText);
      
      if (faceMatchResponse.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (faceMatchResponse.status === 402) {
        throw new Error("AI credits exhausted. Please contact support.");
      }
      throw new Error("AI face matching failed");
    }

    const faceMatchData = await faceMatchResponse.json();
    console.log('Face matching complete');
    
    const faceMatchContent = faceMatchData.choices[0].message.content;
    const faceMatchResult = JSON.parse(faceMatchContent);

    // Calculate overall confidence
    const overallConfidence = Math.round(
      (extractedInfo.qualityScore * 0.3) + 
      (faceMatchResult.faceMatchScore * 0.5) + 
      (faceMatchResult.livenessScore * 0.2)
    );

    // Determine auto-approval threshold
    const autoApprove = overallConfidence >= 85 && 
                       !extractedInfo.tamperingDetected &&
                       faceMatchResult.faceMatchScore >= 80 &&
                       faceMatchResult.livenessScore >= 70;

    console.log('Verification complete. Overall confidence:', overallConfidence, 'Auto-approve:', autoApprove);

    return new Response(
      JSON.stringify({
        success: true,
        extractedInfo,
        faceMatchResult,
        overallConfidence,
        autoApprove,
        recommendation: autoApprove ? "approve" : "manual_review"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Verification error:", error);
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
