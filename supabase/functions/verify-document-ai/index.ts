/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') || 'https://renty.my',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerificationRequest {
  documentFrontUrl: string;
  documentBackUrl?: string;
  selfieUrl: string;
  documentType: string;
  fullNameOnDocument?: string;
  livenessVideoUrl?: string;
  livenessVideoFrames?: string[];
}

interface AIAnalysisResult {
  success: boolean;
  extractedInfo: {
    fullName: string | null;
    documentNumber: string | null;
    dateOfBirth: string | null;
    qualityScore: number;
    isDocumentLegible: boolean;
    documentTypeDetected: string;
    expiryDate: string | null;
  };
  faceMatchResult: {
    faceMatchScore: number;
    livenessScore: number;
    facesDetected: boolean;
    matchConfidence: 'high' | 'medium' | 'low' | 'no_match';
  };
  fraudIndicators: {
    riskScore: number;
    flags: string[];
    isHighRisk: boolean;
  };
  overallConfidence: number;
  autoApprove: boolean;
  processingTimeMs: number;
  model: string;
  reasoning: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const startTime = Date.now();

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const body: VerificationRequest = await req.json();
    const { documentFrontUrl, documentBackUrl, selfieUrl, documentType, fullNameOnDocument, livenessVideoUrl, livenessVideoFrames } = body;

    console.log('Starting AI verification for document type:', documentType);

    if (!documentFrontUrl || !selfieUrl) {
      throw new Error("Missing required document or selfie URL");
    }

    // Build the analysis prompt
    const analysisPrompt = buildAnalysisPrompt(documentType, fullNameOnDocument, !!documentBackUrl, !!livenessVideoUrl, !!livenessVideoFrames?.length);

    // Prepare images for the multimodal request
    const messageContent: any[] = [
      { type: "text", text: analysisPrompt }
    ];

    // Add document front image
    messageContent.push({
      type: "image_url",
      image_url: { url: documentFrontUrl }
    });

    // Add document back image if provided
    if (documentBackUrl) {
      messageContent.push({
        type: "image_url",
        image_url: { url: documentBackUrl }
      });
    }

    // Add selfie image
    messageContent.push({
      type: "image_url",
      image_url: { url: selfieUrl }
    });

    // Add liveness video frames if available (max 4 to stay within token limits)
    if (livenessVideoFrames?.length) {
      const frameCount = Math.min(livenessVideoFrames.length, 4);
      for (let i = 0; i < frameCount; i++) {
        messageContent.push({
          type: "image_url",
          image_url: { url: livenessVideoFrames[i] }
        });
      }
    }

    console.log('Calling Lovable AI Gateway for document analysis...');

    // Call Lovable AI Gateway with vision capabilities
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert identity document verification specialist. Your task is to analyze identity documents and selfies to verify user identity. You must:
1. Extract information from documents accurately
2. Assess document quality and authenticity
3. Compare the selfie photo to the document photo
4. Detect any potential fraud indicators
5. Provide confidence scores for your analysis

Always respond with valid JSON only, no markdown formatting or code blocks.`
          },
          {
            role: "user",
            content: messageContent
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "document_verification_result",
              description: "Return the document verification analysis results",
              parameters: {
                type: "object",
                properties: {
                  extractedInfo: {
                    type: "object",
                    properties: {
                      fullName: { type: "string", description: "Full name as shown on the document" },
                      documentNumber: { type: "string", description: "IC number, passport number, or license number" },
                      dateOfBirth: { type: "string", description: "Date of birth in YYYY-MM-DD format" },
                      qualityScore: { type: "number", description: "Document quality score from 0-100" },
                      isDocumentLegible: { type: "boolean", description: "Whether the document text is readable" },
                      documentTypeDetected: { type: "string", description: "Type of document detected (mykad, passport, driving_license)" },
                      expiryDate: { type: "string", description: "Document expiry date if visible, in YYYY-MM-DD format" }
                    },
                    required: ["fullName", "qualityScore", "isDocumentLegible", "documentTypeDetected"]
                  },
                  faceMatchResult: {
                    type: "object",
                    properties: {
                      faceMatchScore: { type: "number", description: "How well the selfie matches the document photo (0-100)" },
                      livenessScore: { type: "number", description: "Confidence that the selfie is of a live person (0-100)" },
                      facesDetected: { type: "boolean", description: "Whether faces were detected in both images" },
                      matchConfidence: { type: "string", enum: ["high", "medium", "low", "no_match"] }
                    },
                    required: ["faceMatchScore", "livenessScore", "facesDetected", "matchConfidence"]
                  },
                  fraudIndicators: {
                    type: "object",
                    properties: {
                      riskScore: { type: "number", description: "Overall fraud risk score (0-100, higher = more risky)" },
                      flags: { type: "array", items: { type: "string" }, description: "List of detected fraud indicators" },
                      isHighRisk: { type: "boolean", description: "Whether this verification is considered high risk" }
                    },
                    required: ["riskScore", "flags", "isHighRisk"]
                  },
                  overallConfidence: { type: "number", description: "Overall verification confidence (0-100)" },
                  autoApprove: { type: "boolean", description: "Whether to auto-approve this verification (true if confidence > 90 and no fraud flags)" },
                  reasoning: { type: "string", description: "Brief explanation of the verification decision" }
                },
                required: ["extractedInfo", "faceMatchResult", "fraudIndicators", "overallConfidence", "autoApprove", "reasoning"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "document_verification_result" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error("AI service rate limited. Please try again later.");
      }
      if (aiResponse.status === 402) {
        throw new Error("AI service quota exceeded.");
      }
      throw new Error(`AI analysis failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');

    // Extract the tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'document_verification_result') {
      console.error('Unexpected AI response format:', JSON.stringify(aiData));
      throw new Error("AI returned unexpected response format");
    }

    let analysisResult;
    try {
      analysisResult = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error('Failed to parse AI result:', toolCall.function.arguments);
      throw new Error("Failed to parse AI analysis result");
    }

    const processingTimeMs = Date.now() - startTime;

    // Build the final result
    const result: AIAnalysisResult = {
      success: true,
      extractedInfo: {
        fullName: analysisResult.extractedInfo?.fullName || null,
        documentNumber: analysisResult.extractedInfo?.documentNumber || null,
        dateOfBirth: analysisResult.extractedInfo?.dateOfBirth || null,
        qualityScore: analysisResult.extractedInfo?.qualityScore || 0,
        isDocumentLegible: analysisResult.extractedInfo?.isDocumentLegible ?? true,
        documentTypeDetected: analysisResult.extractedInfo?.documentTypeDetected || documentType,
        expiryDate: analysisResult.extractedInfo?.expiryDate || null,
      },
      faceMatchResult: {
        faceMatchScore: analysisResult.faceMatchResult?.faceMatchScore || 0,
        livenessScore: analysisResult.faceMatchResult?.livenessScore || 0,
        facesDetected: analysisResult.faceMatchResult?.facesDetected ?? false,
        matchConfidence: analysisResult.faceMatchResult?.matchConfidence || 'no_match',
      },
      fraudIndicators: {
        riskScore: analysisResult.fraudIndicators?.riskScore || 0,
        flags: analysisResult.fraudIndicators?.flags || [],
        isHighRisk: analysisResult.fraudIndicators?.isHighRisk ?? false,
      },
      overallConfidence: analysisResult.overallConfidence || 0,
      autoApprove: analysisResult.autoApprove && 
                   analysisResult.overallConfidence >= 90 && 
                   !analysisResult.fraudIndicators?.isHighRisk &&
                   analysisResult.faceMatchResult?.matchConfidence === 'high',
      processingTimeMs,
      model: "google/gemini-2.5-flash",
      reasoning: analysisResult.reasoning || "Analysis completed",
    };

    console.log('Verification result:', {
      overallConfidence: result.overallConfidence,
      autoApprove: result.autoApprove,
      faceMatchScore: result.faceMatchResult.faceMatchScore,
      processingTimeMs: result.processingTimeMs
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    console.error("Document verification error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    const isExpected = errorMessage.startsWith("Unauthorized") || errorMessage.startsWith("Missing") || errorMessage.startsWith("Invalid") || errorMessage.startsWith("Document");
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: isExpected ? errorMessage : "An unexpected error occurred. Please try again.",
        processingTimeMs 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildAnalysisPrompt(documentType: string, fullNameOnDocument?: string, hasBackImage?: boolean, hasLivenessVideo?: boolean, hasLivenessFrames?: boolean): string {
  const docTypeLabels: Record<string, string> = {
    'mykad': 'Malaysian MyKad (identity card)',
    'passport': 'Passport',
    'driving_license': 'Driving License'
  };

  const docLabel = docTypeLabels[documentType] || 'identity document';

  const prompt = `Please analyze the following identity verification submission. CRITICAL: You MUST respond with valid JSON only using the document_verification_result tool. Do NOT include markdown, code blocks, or any text outside the JSON tool call.

**Document Type:** ${docLabel}
${fullNameOnDocument ? `**Expected Name:** ${fullNameOnDocument}` : ''}

**Images provided:**
1. Document front image
${hasBackImage ? '2. Document back image\n3. Selfie photo' : '2. Selfie photo'}

**Your tasks:**

1. **Document Quality Assessment:**
   - Is the document image clear and readable?
   - Can you identify the document type?
   - Is there any visible tampering, editing, or suspicious elements?
   - Rate the overall quality from 0-100

2. **Information Extraction:**
   - Extract the full name from the document
   - Extract the document number (IC/Passport/License number)
   - Extract the date of birth if visible
   - Extract expiry date if visible

3. **Face Matching & Liveness Detection:**
   - Compare the photo on the document with the selfie
   - Rate the similarity from 0-100
   - Assess if the selfie appears to be a live person (not a printed photo or screen)
   - Rate liveness confidence from 0-100
   ${hasLivenessFrames ? '- Additional liveness video frames are provided as extra images. Analyze these frames for depth, motion, and lighting consistency to verify liveness. Check for signs of replayed video or static images.\n   - Use the multiple frames to detect if the person blinked, moved naturally, or if it appears to be a static image.' : ''}
   ${hasLivenessVideo ? '- A liveness video URL is available for reference.' : ''}

4. **Fraud Detection:**
   - Check for signs of document manipulation
   - Check for mismatched information
   - Check if selfie appears to be taken from a screen/photo
   - List any concerning flags
   - Rate overall fraud risk from 0-100 (higher = more suspicious)

5. **Final Verdict:**
   - Calculate overall confidence (0-100)
   - Determine if this should be auto-approved (confidence > 90, no fraud flags, high face match)
   - Provide brief reasoning for your decision

Please be thorough but fair in your assessment. The goal is to verify legitimate users while catching potential fraud.`;

  return prompt;
}
