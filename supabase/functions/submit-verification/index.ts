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
    const authHeader = req.headers.get('authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error("Unauthorized");
    }

    console.log('Processing verification for user:', user.id);

    const { verificationId } = await req.json();

    if (!verificationId) {
      throw new Error("verificationId is required");
    }

    // Get verification request details
    const { data: verification, error: fetchError } = await supabase
      .from('verification_requests')
      .select('*')
      .eq('id', verificationId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !verification) {
      console.error('Verification fetch error:', fetchError);
      throw new Error("Verification not found");
    }

    console.log('Verification found, updating status to processing...');

    // Update status to processing
    const { error: updateError } = await supabase
      .from('verification_requests')
      .update({ status: 'processing' })
      .eq('id', verificationId);

    if (updateError) {
      console.error('Status update error:', updateError);
      throw new Error("Failed to update status");
    }

    // Call AI verification
    console.log('Calling verify-document-ai function...');
    const aiResult = await fetch(`${supabaseUrl}/functions/v1/verify-document-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        documentFrontUrl: verification.document_front_url,
        documentBackUrl: verification.document_back_url,
        selfieUrl: verification.selfie_url,
        documentType: verification.document_type,
        fullNameOnDocument: verification.full_name_on_document,
        livenessVideoUrl: verification.video_liveness_url,
        livenessVideoFrames: verification.liveness_video_frames
      })
    });

    if (!aiResult.ok) {
      const errorText = await aiResult.text();
      console.error('AI verification failed:', aiResult.status, errorText);
      
      // Revert status to pending on failure
      await supabase
        .from('verification_requests')
        .update({ status: 'pending' })
        .eq('id', verificationId);
      
      throw new Error(`AI verification failed: ${errorText}`);
    }

    const aiData = await aiResult.json();

    if (!aiData.success) {
      // Revert status to pending on failure
      await supabase
        .from('verification_requests')
        .update({ status: 'pending' })
        .eq('id', verificationId);
      
      throw new Error(aiData.error || "AI verification failed");
    }

    console.log('AI verification successful:', {
      confidence: aiData.overallConfidence,
      autoApprove: aiData.autoApprove,
      faceMatch: aiData.faceMatchResult?.faceMatchScore
    });

    // Determine final status
    const finalStatus = aiData.autoApprove ? 'approved' : 'pending';
    const isAutoApproved = aiData.autoApprove;

    // Update verification with AI results
    const updateData: Record<string, any> = {
      document_quality_score: aiData.extractedInfo?.qualityScore || 0,
      face_match_score: aiData.faceMatchResult?.faceMatchScore || 0,
      liveness_score: aiData.faceMatchResult?.livenessScore || 0,
      overall_confidence_score: aiData.overallConfidence || 0,
      fraud_risk_score: aiData.fraudIndicators?.riskScore || 0,
      ai_analysis_result: aiData,
      ai_processing_time_ms: aiData.processingTimeMs,
      openai_model: aiData.model,
      status: finalStatus,
    };

    // Only update extracted info if we got valid data
    if (aiData.extractedInfo?.fullName) {
      updateData.full_name_on_document = aiData.extractedInfo.fullName;
    }
    if (aiData.extractedInfo?.documentNumber) {
      updateData.ic_number = aiData.extractedInfo.documentNumber;
    }
    if (aiData.extractedInfo?.dateOfBirth) {
      updateData.date_of_birth = aiData.extractedInfo.dateOfBirth;
    }

    // Set verified_at if auto-approved
    if (isAutoApproved) {
      updateData.verified_at = new Date().toISOString();
    }

    const { error: finalUpdateError } = await supabase
      .from('verification_requests')
      .update(updateData)
      .eq('id', verificationId);

    if (finalUpdateError) {
      console.error('Final update error:', finalUpdateError);
      throw new Error("Failed to save verification results");
    }

    // Update user profile if auto-approved
    if (isAutoApproved) {
      console.log('Auto-approved - updating user profile verification status...');
      await supabase
        .from('profiles')
        .update({ is_verified: true })
        .eq('id', user.id);
    }

    // Create notification
    console.log('Creating notification...');
    const notificationType = isAutoApproved ? 'verification_approved' : 'verification_pending';
    const notificationTitle = isAutoApproved ? 'Verification Approved!' : 'Verification Under Review';
    const notificationMessage = isAutoApproved 
      ? 'Your identity has been verified successfully. You can now list items for rent.' 
      : `Your verification is being reviewed by our team. Confidence score: ${aiData.overallConfidence}%`;

    await supabase.from('notifications').insert({
      user_id: user.id,
      type: notificationType,
      title: notificationTitle,
      message: notificationMessage,
      link: '/profile'
    });

    // Create audit log entry
    await supabase.from('verification_audit_log').insert({
      verification_id: verificationId,
      action: isAutoApproved ? 'auto_approved' : 'ai_analyzed',
      performed_by: null, // System action
      details: {
        ai_model: aiData.model,
        confidence: aiData.overallConfidence,
        face_match: aiData.faceMatchResult?.faceMatchScore,
        fraud_risk: aiData.fraudIndicators?.riskScore,
        auto_approve_reason: isAutoApproved ? 'High confidence, no fraud flags' : null,
        processing_time_ms: aiData.processingTimeMs
      }
    });

    console.log('Verification submission complete:', {
      status: finalStatus,
      confidence: aiData.overallConfidence,
      autoApproved: isAutoApproved
    });

    return new Response(
      JSON.stringify({
        success: true,
        status: finalStatus,
        confidence: aiData.overallConfidence,
        autoApproved: isAutoApproved,
        faceMatchScore: aiData.faceMatchResult?.faceMatchScore,
        reasoning: aiData.reasoning
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Submit verification error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
