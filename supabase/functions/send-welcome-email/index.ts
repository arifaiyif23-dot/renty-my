/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://renty.my';

const corsHeaders = {
  'Access-Control-Allow-Origin': FRONTEND_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const getFromEmail = () => {
  const customFrom = Deno.env.get('RESEND_FROM_EMAIL');
  if (customFrom) {
    return customFrom.includes('<') ? customFrom : `Renty <${customFrom}>`;
  }
  return 'Renty <onboarding@resend.dev>';
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = getFromEmail();

    const { userId, email, fullName } = await req.json();
    console.log('Sending welcome email to user:', userId);

    if (!email) {
      throw new Error('Email is required');
    }
    if (userId !== user.id) {
      throw new Error('userId does not match authenticated user');
    }

    const subject = 'Welcome to Renty! 🎉';
    const templateType = 'welcome';
    
    const emailResult = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
              <h1 style="color: #18181b; font-size: 28px; margin-bottom: 16px;">Welcome to Renty${fullName ? `, ${fullName}` : ''}! 🎉</h1>
              
              <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                We're thrilled to have you join our community of renters and lenders. Renty makes it easy to rent items you need or earn money from things you own.
              </p>
              
              <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="color: #92400e; font-size: 14px; margin: 0 0 8px 0; font-weight: 600;">🎁 Welcome Offer!</p>
                <p style="color: #78350f; font-size: 18px; margin: 0; font-weight: bold;">Use code <span style="background-color: #fde68a; padding: 2px 8px; border-radius: 4px;">WELCOME50</span> for 50% off your first rental!</p>
              </div>
              
              <h2 style="color: #18181b; font-size: 18px; margin-bottom: 16px;">Get Started:</h2>
              
              <div style="margin-bottom: 24px;">
                <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
                  <span style="background-color: #10b981; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; margin-right: 12px; flex-shrink: 0;">1</span>
                  <span style="color: #52525b; font-size: 15px;"><strong>Complete Your Profile</strong> - Add a photo and verify your identity for faster approvals</span>
                </div>
                <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
                  <span style="background-color: #10b981; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; margin-right: 12px; flex-shrink: 0;">2</span>
                  <span style="color: #52525b; font-size: 15px;"><strong>Browse Items</strong> - Discover cameras, tools, sports gear, and more near you</span>
                </div>
                <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
                  <span style="background-color: #10b981; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; margin-right: 12px; flex-shrink: 0;">3</span>
                  <span style="color: #52525b; font-size: 15px;"><strong>List Your Items</strong> - Turn your unused stuff into extra income</span>
                </div>
              </div>
              
              <a href="${frontendUrl}/search" style="display: inline-block; background-color: #10b981; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">Start Exploring</a>
              
              <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
              
              <p style="color: #a1a1aa; font-size: 13px; margin: 0;">
                Questions? Just reply to this email - we're here to help!<br>
                The Renty Team
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    
    console.log('Welcome email sent:', emailResult);

    // Log email to database
    try {
      await supabase.from('email_logs').insert({
        resend_email_id: emailResult.data?.id || null,
        to_email: email,
        subject: subject,
        template_type: templateType,
        status: 'sent',
        metadata: { user_id: userId, full_name: fullName }
      });
    } catch (logError) {
      console.error('Failed to log email:', logError);
    }

    return new Response(
      JSON.stringify({ success: true, emailId: emailResult.data?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Welcome email error:', error);
    const message = error.message || 'Failed to send welcome email';
    const isExpected = message.startsWith('Missing') || message.startsWith('Unauthorized');
    return new Response(
      JSON.stringify({ error: isExpected ? message : 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
