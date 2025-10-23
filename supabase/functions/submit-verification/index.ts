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
        documentType: verification.document_type
      })
    });

    if (!aiResult.ok) {
      const errorText = await aiResult.text();
      console.error('AI verification failed:', aiResult.status, errorText);
      throw new Error("AI verification failed");
    }

    const aiData = await aiResult.json();

    if (!aiData.success) {
      throw new Error(aiData.error || "AI verification failed");
    }

    console.log('AI verification successful, updating database...');

    // Update verification with AI results
    const updateData = {
      document_quality_score: aiData.extractedInfo.qualityScore,
      face_match_score: aiData.faceMatchResult.faceMatchScore,
      liveness_score: aiData.faceMatchResult.livenessScore,
      overall_confidence_score: aiData.overallConfidence,
      ai_analysis_result: aiData,
      full_name_on_document: aiData.extractedInfo.fullName,
      ic_number: aiData.extractedInfo.documentNumber,
      date_of_birth: aiData.extractedInfo.dateOfBirth,
      status: aiData.autoApprove ? 'approved' : 'pending',
      verified_at: aiData.autoApprove ? new Date().toISOString() : null
    };

    const { error: finalUpdateError } = await supabase
      .from('verification_requests')
      .update(updateData)
      .eq('id', verificationId);

    if (finalUpdateError) {
      console.error('Final update error:', finalUpdateError);
      throw new Error("Failed to save verification results");
    }

    // Create notification
    console.log('Creating notification...');
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: aiData.autoApprove ? 'verification_approved' : 'verification_pending',
      title: aiData.autoApprove ? 'Verification Approved!' : 'Verification Under Review',
      message: aiData.autoApprove 
        ? 'Your identity has been verified successfully.' 
        : 'Your verification is being reviewed by our team.',
      link: '/profile'
    });

    console.log('Verification submission complete');

    return new Response(
      JSON.stringify({
        success: true,
        status: updateData.status,
        confidence: aiData.overallConfidence,
        autoApproved: aiData.autoApprove
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
