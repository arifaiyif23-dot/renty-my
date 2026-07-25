/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') || 'https://renty.my',
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

    // Check if user is suspended
    const { error: suspendError } = await supabase.rpc('check_user_not_suspended', {
      p_user_id: user.id
    });
    if (suspendError) {
      throw new Error('Your account has been suspended. Contact support for assistance.');
    }

    console.log('Processing verification for user:', user.id);

    // Rate limit: max 3 submissions per hour per user
    const { count: recentCount, error: countError } = await supabase
      .from('verification_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 3600000).toISOString());

    if (!countError && recentCount && recentCount >= 3) {
      throw new Error('Too many verification submissions. Please wait before submitting again.');
    }

    const { verificationId } = await req.json();

    if (!verificationId) {
      throw new Error("verificationId is required");
    }

    // Get verification request details
    const { data: verification, error: fetchError } = await supabase
      .from('verification_requests')
      .select('id, user_id, document_type, document_front_url, document_back_url, selfie_url, full_name_on_document, video_liveness_url, liveness_video_frames, status')
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

    // Generate signed URLs for AI analysis (URLs must be accessible to the AI gateway)
    const signedUrlOptions = { expiresIn: 600 };
    const { data: signedFront } = await supabase.storage
      .from('verification-documents')
      .createSignedUrl(verification.document_front_url, signedUrlOptions);
    const signedSelfie = verification.selfie_url
      ? (await supabase.storage.from('verification-documents').createSignedUrl(verification.selfie_url, signedUrlOptions)).data
      : null;
    const signedBack = verification.document_back_url
      ? (await supabase.storage.from('verification-documents').createSignedUrl(verification.document_back_url, signedUrlOptions)).data
      : null;

    const signedLivenessFrames = verification.liveness_video_frames
      ? await Promise.all(
          (verification.liveness_video_frames as string[]).map(async (framePath: string) => {
            const { data } = await supabase.storage.from('verification-documents').createSignedUrl(framePath, signedUrlOptions);
            return data?.signedUrl || framePath;
          })
        )
      : [];

    // Call AI verification
    console.log('Calling verify-document-ai function...');
    const aiResult = await fetch(`${supabaseUrl}/functions/v1/verify-document-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        documentFrontUrl: signedFront?.signedUrl || verification.document_front_url,
        documentBackUrl: signedBack?.signedUrl || verification.document_back_url,
        selfieUrl: signedSelfie?.signedUrl || verification.selfie_url,
        documentType: verification.document_type,
        fullNameOnDocument: verification.full_name_on_document,
        livenessVideoUrl: verification.video_liveness_url,
        livenessVideoFrames: signedLivenessFrames.length > 0 ? signedLivenessFrames : verification.liveness_video_frames
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

    // Always manual review — no auto-approve
    const finalStatus = 'pending';

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
    if (aiData.extractedInfo?.dateOfBirth) {
      updateData.date_of_birth = aiData.extractedInfo.dateOfBirth;
    }

    const { error: finalUpdateError } = await supabase
      .from('verification_requests')
      .update(updateData)
      .eq('id', verificationId);

    if (finalUpdateError) {
      console.error('Final update error:', finalUpdateError);
      throw new Error("Failed to save verification results");
    }

    // Create notification (only after all updates succeed)
    console.log('Creating notification...');
    const { error: notifError } = await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'verification_pending',
      title: 'Verification Under Review',
      message: 'Your verification is being reviewed by our team. We will notify you once it is complete.',
      link: '/profile'
    });
    if (notifError) {
      console.error('Failed to create notification:', notifError);
    }

    // Create audit log entry
    await supabase.from('verification_audit_log').insert({
      verification_id: verificationId,
      action: 'ai_analyzed',
      performed_by: null,
      details: {
        ai_model: aiData.model,
        confidence: aiData.overallConfidence,
        face_match: aiData.faceMatchResult?.faceMatchScore,
        fraud_risk: aiData.fraudIndicators?.riskScore,
        processing_time_ms: aiData.processingTimeMs
      }
    });

    // Auto-create fraud alert if risk score exceeds threshold
    const riskScore = aiData.fraudIndicators?.riskScore || 0;
    if (riskScore > 50 || (aiData.fraudIndicators?.flags && aiData.fraudIndicators.flags.length > 0)) {
      await supabase.from('fraud_alerts').insert({
        user_id: user.id,
        alert_type: 'ai_detected_risk',
        risk_score: riskScore,
        status: 'pending',
        details: {
          verification_id: verificationId,
          flags: aiData.fraudIndicators?.flags || [],
          overall_confidence: aiData.overallConfidence,
          face_match_score: aiData.faceMatchResult?.faceMatchScore,
          document_type: verification.document_type,
        }
      }).then(({ error: alertError }) => {
        if (alertError) console.error('Failed to create fraud alert:', alertError);
      });
    }

    console.log('Verification submission complete:', {
      status: finalStatus,
      confidence: aiData.overallConfidence
    });

    return new Response(
      JSON.stringify({
        success: true,
        status: finalStatus
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Submit verification error:", error);
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    const isExpected = message.startsWith("Unauthorized") || message.startsWith("verificationId") || message.startsWith("Verification") || message.startsWith("Your account");
    return new Response(
      JSON.stringify({ success: false, error: isExpected ? message : "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
