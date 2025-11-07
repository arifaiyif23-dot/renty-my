import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    const startTime = Date.now();
    const { 
      documentFrontUrl, 
      documentBackUrl, 
      selfieUrl,
      livenessVideoFrames, 
      documentType 
    } = await req.json();

    console.log('Starting OpenAI verification for document type:', documentType);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Download images from storage
    console.log('Downloading images from storage...');
    const downloadPromises = [
      fetch(documentFrontUrl).then(r => r.arrayBuffer()),
      fetch(selfieUrl).then(r => r.arrayBuffer())
    ];
    
    if (documentBackUrl) {
      downloadPromises.push(fetch(documentBackUrl).then(r => r.arrayBuffer()));
    }
    
    if (livenessVideoFrames && livenessVideoFrames.length > 0) {
      livenessVideoFrames.forEach((url: string) => {
        downloadPromises.push(fetch(url).then(r => r.arrayBuffer()));
      });
    }

    const downloadedImages = await Promise.all(downloadPromises);

    // Convert to base64 (chunked to avoid stack overflow)
    const toBase64 = (buffer: ArrayBuffer): string => {
      const bytes = new Uint8Array(buffer);
      const CHUNK_SIZE = 8192;
      let binary = '';
      
      for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.slice(i, i + CHUNK_SIZE);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      return btoa(binary);
    };

    let imageIndex = 0;
    const frontBase64 = toBase64(downloadedImages[imageIndex++]);
    const selfieBase64 = toBase64(downloadedImages[imageIndex++]);
    const backBase64 = documentBackUrl ? toBase64(downloadedImages[imageIndex++]) : null;
    const frameBase64s = livenessVideoFrames?.length > 0 
      ? downloadedImages.slice(imageIndex).map(toBase64) 
      : [];

    console.log('Images downloaded and converted to base64');

    // Step 1: Advanced Document Extraction
    const extractionPrompt = `You are an expert forensic document examiner. Analyze this ${documentType} with extreme precision.

CRITICAL CHECKS:
1. Document Authenticity:
   - Holographic security features visible?
   - Microprint text legible?
   - Embossing depth analysis
   - Font consistency check
   
2. Tampering Detection:
   - Clone stamp artifacts?
   - Color inconsistencies?
   - Resolution mismatches?
   - Signs of digital manipulation?
   
3. Data Extraction:
   - Full name (handle multi-word Malaysian/Chinese names)
   - IC/Passport number (validate format)
   - Date of birth (validate age >= 18)
   - Address (if visible)
   - Expiry date (reject if expired)
   
4. Quality Assessment:
   - Image resolution adequate?
   - Lighting uniformity
   - Document completeness (all corners visible?)
   - Glare/shadow interference
   
5. Cross-Validation:
   - IC number format: YYMMDD-PB-TGGG (validate date logic)
   - Passport number format: [A-Z][0-9]{8}
   - Birth date consistency with IC number
   
Return ONLY valid JSON (no markdown, no extra text):
{
  "isAuthentic": boolean,
  "tamperingConfidence": 0-100,
  "qualityScore": 0-100,
  "extractedData": {
    "fullName": "string",
    "documentNumber": "string",
    "dateOfBirth": "YYYY-MM-DD",
    "address": "string or null",
    "expiryDate": "YYYY-MM-DD or null",
    "age": number
  },
  "securityFeatures": {
    "hologramVisible": boolean,
    "microprintDetected": boolean,
    "embossingPresent": boolean
  },
  "warnings": ["array of warning strings"],
  "recommendation": "approve" | "reject" | "manual_review"
}`;

    console.log('Calling OpenAI for document extraction...');
    const extractionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: extractionPrompt },
              { 
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${frontBase64}` }
              },
              ...(backBase64 ? [{ 
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${backBase64}` }
              }] : [])
            ]
          }
        ],
        max_completion_tokens: 1000
      }),
    });

    if (!extractionResponse.ok) {
      const errorText = await extractionResponse.text();
      console.error("OpenAI extraction failed:", extractionResponse.status, errorText);
      
      if (extractionResponse.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (extractionResponse.status === 402) {
        throw new Error("OpenAI credits exhausted. Please contact support.");
      }
      throw new Error("OpenAI extraction failed");
    }

    const extractionData = await extractionResponse.json();
    console.log('Document extraction complete');
    
    const extractedContent = extractionData.choices[0].message.content;
    const extractedInfo = JSON.parse(extractedContent);

    // Step 2: Advanced Face Matching with Liveness Detection
    const faceMatchPrompt = `Compare these images with forensic precision:
1. Document photo (IC/Passport)
2. Selfie image
${frameBase64s.length > 0 ? `3-${3 + frameBase64s.length}. Video frames (${frameBase64s.length} frames showing different angles)` : ''}

ANALYSIS:
1. Face Match (50% weight):
   - Facial landmarks: Eyes, nose, mouth, jawline
   - Ear shape (unique biometric)
   - Skin tone consistency
   - Age progression acceptable
   - Facial hair changes acceptable
   
2. Liveness Detection (30% weight):
   ${frameBase64s.length > 0 ? `
   - Blinking detected in video?
   - Head movement natural?
   - Facial expressions change?
   - Eye reflection analysis
   - Motion blur consistent with real movement?
   ` : `
   - Photo appears to be live capture?
   - Not a printed photo or screen display?
   `}
   
3. Anti-Spoofing (20% weight):
   - Not a printed photo (check for paper texture, edges)
   - Not a screen photo (check for pixel grid, refresh lines)
   - Not a 3D mask (check for skin texture, pores)
   - Not a deepfake (check for AI artifacts)
   
Return ONLY valid JSON (no markdown, no extra text):
{
  "faceMatchScore": 0-100,
  "livenessScore": 0-100,
  "antiSpoofingScore": 0-100,
  "overallConfidence": 0-100,
  "detectedIssues": ["array of issue strings"],
  "recommendation": "approve" | "reject" | "manual_review",
  "reasoning": "string explanation"
}`;

    console.log('Calling OpenAI for face matching...');
    const faceMatchResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5",
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
              },
              ...frameBase64s.map((frame: string) => ({
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${frame}` }
              }))
            ]
          }
        ],
        max_completion_tokens: 1000
      }),
    });

    if (!faceMatchResponse.ok) {
      const errorText = await faceMatchResponse.text();
      console.error("OpenAI face matching failed:", faceMatchResponse.status, errorText);
      
      if (faceMatchResponse.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (faceMatchResponse.status === 402) {
        throw new Error("OpenAI credits exhausted. Please contact support.");
      }
      throw new Error("OpenAI face matching failed");
    }

    const faceMatchData = await faceMatchResponse.json();
    console.log('Face matching complete');
    
    const faceMatchContent = faceMatchData.choices[0].message.content;
    const faceMatchResult = JSON.parse(faceMatchContent);

    // Calculate overall confidence and fraud risk
    const overallConfidence = Math.round(
      (extractedInfo.qualityScore * 0.3) + 
      (faceMatchResult.faceMatchScore * 0.5) + 
      (faceMatchResult.livenessScore * 0.2)
    );

    const fraudRiskScore = 100 - overallConfidence;

    // Determine auto-approval threshold
    const autoApprove = overallConfidence >= 85 && 
                       extractedInfo.isAuthentic &&
                       faceMatchResult.faceMatchScore >= 80 &&
                       faceMatchResult.antiSpoofingScore >= 70;

    const processingTime = Date.now() - startTime;

    console.log('Verification complete. Overall confidence:', overallConfidence, 'Auto-approve:', autoApprove);

    return new Response(
      JSON.stringify({
        success: true,
        extractedInfo,
        faceMatchResult,
        overallConfidence,
        fraudRiskScore,
        autoApprove,
        recommendation: autoApprove ? "approve" : overallConfidence >= 60 ? "manual_review" : "reject",
        processingTimeMs: processingTime,
        openaiModel: "gpt-5"
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