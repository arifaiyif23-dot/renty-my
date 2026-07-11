import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const getFromEmail = () => {
  const customFrom = Deno.env.get('RESEND_FROM_EMAIL');
  if (!customFrom) return 'Renty <onboarding@resend.dev>';
  const trimmed = customFrom.trim();
  // If secret already includes display-name format ("Name <email>"), use as-is.
  if (trimmed.includes('<') && trimmed.includes('>')) return trimmed;
  // Basic email validation before wrapping
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    console.warn(`Invalid RESEND_FROM_EMAIL value; falling back to default. Got: ${trimmed}`);
    return 'Renty <onboarding@resend.dev>';
  }
  return `Renty <${trimmed}>`;
};

// Helper function to log email to database
async function logEmail(
  supabase: any,
  resendEmailId: string | null,
  toEmail: string,
  subject: string,
  templateType: string,
  metadata: any = {},
  errorMessage: string | null = null
) {
  try {
    await supabase.from('email_logs').insert({
      resend_email_id: resendEmailId,
      to_email: toEmail,
      subject: subject,
      template_type: templateType,
      status: errorMessage ? 'failed' : 'sent',
      error_message: errorMessage,
      metadata: metadata
    });
    console.log(`Email logged: ${templateType} to ${toEmail}`);
  } catch (logError) {
    console.error('Failed to log email:', logError);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const resend = new Resend(resendApiKey);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const fromEmail = getFromEmail();
    const { userId, status, rejectionReason } = await req.json();

    console.log(`Sending verification email for user ${userId}, status: ${status}`);

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !userData?.user?.email) {
      throw new Error(`Failed to get user email: ${userError?.message || 'User not found'}`);
    }

    const userEmail = userData.user.email;

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();

    const userName = profile?.full_name || 'User';
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://renty.my';

    let emailContent: { subject: string; html: string };
    let templateType: string;

    if (status === 'approved') {
      templateType = 'verification_approved';
      emailContent = {
        subject: '🎉 Your Renty Identity Verification is Approved!',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">✓ Verification Approved!</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
              <p style="font-size: 16px; margin-bottom: 20px;">Hi ${userName},</p>
              <p style="font-size: 16px; margin-bottom: 20px;">Great news! Your identity verification has been successfully approved. You now have full access to all Renty features.</p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #10b981;">What's unlocked:</h3>
                <ul style="padding-left: 20px;">
                  <li>✓ List items for rent</li>
                  <li>✓ Verified badge on your profile</li>
                  <li>✓ Higher trust with renters and owners</li>
                  <li>✓ Access to all rental features</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${frontendUrl}/profile" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">View Your Profile</a>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">Thank you for being part of the Renty community!</p>
            </div>
            <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
              <p>© ${new Date().getFullYear()} Renty. All rights reserved.</p>
            </div>
          </body>
          </html>
        `,
      };
    } else if (status === 'rejected') {
      templateType = 'verification_rejected';
      const reasonMap: Record<string, string> = {
        'poor_quality': 'The uploaded document image was not clear enough. Please upload a clearer photo.',
        'face_mismatch': 'The selfie did not match the photo on the document. Please ensure you take a clear selfie matching your ID photo.',
        'suspected_fake': 'The document could not be verified as authentic. Please submit genuine documents.',
        'unclear_selfie': 'The selfie was not clear enough. Please take a well-lit, clear photo of your face.',
        'expired_document': 'The document has expired. Please submit a valid, non-expired document.',
        'other': rejectionReason || 'Your verification did not meet our requirements.',
      };

      const friendlyReason = reasonMap[rejectionReason] || rejectionReason || 'Your verification did not meet our requirements.';

      emailContent = {
        subject: 'Action Required: Your Renty Verification Needs Attention',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Verification Update</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
              <p style="font-size: 16px; margin-bottom: 20px;">Hi ${userName},</p>
              <p style="font-size: 16px; margin-bottom: 20px;">We reviewed your identity verification submission, but unfortunately we were unable to approve it at this time.</p>
              
              <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #b45309;">Reason:</h3>
                <p style="margin-bottom: 0; color: #92400e;">${friendlyReason}</p>
              </div>
              
              <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #374151;">Tips for successful verification:</h3>
                <ul style="padding-left: 20px; color: #4b5563;">
                  <li>Ensure good lighting when taking photos</li>
                  <li>Make sure all text on the document is readable</li>
                  <li>Take a clear selfie looking directly at the camera</li>
                  <li>Use a valid, non-expired document</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${frontendUrl}/verification" style="display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">Try Again</a>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">If you have questions, feel free to contact our support team.</p>
            </div>
            <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
              <p>© ${new Date().getFullYear()} Renty. All rights reserved.</p>
            </div>
          </body>
          </html>
        `,
      };
    } else {
      console.log(`Unknown status: ${status}, skipping email`);
      return new Response(
        JSON.stringify({ success: true, skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const emailResult = await resend.emails.send({
        from: fromEmail,
        to: [userEmail],
        subject: emailContent.subject,
        html: emailContent.html,
      });

      console.log('Verification email sent:', emailResult);
      
      await logEmail(supabase, emailResult.data?.id || null, userEmail, emailContent.subject, templateType, {
        user_id: userId,
        rejection_reason: rejectionReason
      });

      return new Response(
        JSON.stringify({ success: true, emailId: emailResult.data?.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (emailError: any) {
      await logEmail(supabase, null, userEmail, emailContent.subject, templateType, { user_id: userId }, emailError.message);
      throw emailError;
    }

  } catch (error: any) {
    console.error('Verification email error:', error);
    const message = error.message || 'Failed to send verification email';
    const isExpected = message.startsWith('Missing') || message.startsWith('Unauthorized') || message.startsWith('Verification');
    return new Response(
      JSON.stringify({ error: isExpected ? message : 'An unexpected error occurred. Please try again.' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});