import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
};

async function verifyWebhookSignature(
  payload: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
  const expectedSignatures = svixSignature.split(' ').map(s => s.trim());

  for (const sig of expectedSignatures) {
    try {
      const sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
      const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(signedContent));
      if (isValid) return true;
    } catch {
      continue;
    }
  }

  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Read body once (stream can only be consumed once)
    const rawBody = await req.text();

    // Verify webhook signature
    const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET');
    if (webhookSecret) {
      const svixId = req.headers.get('svix-id');
      const svixTimestamp = req.headers.get('svix-timestamp');
      const svixSignature = req.headers.get('svix-signature');

      if (!svixId || !svixTimestamp || !svixSignature) {
        console.error('Missing webhook signature headers');
        return new Response(
          JSON.stringify({ error: 'Missing webhook signature headers' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check timestamp is within 5 minutes to prevent replay attacks
      const timestamp = parseInt(svixTimestamp, 10);
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestamp) > 300) {
        console.error('Webhook timestamp outside tolerance');
        return new Response(
          JSON.stringify({ error: 'Webhook timestamp too old' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const isValid = await verifyWebhookSignature(
        rawBody, svixId, svixTimestamp, svixSignature, webhookSecret
      );

      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response(
          JSON.stringify({ error: 'Invalid webhook signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const payload = JSON.parse(rawBody);
    const { type, data } = payload;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('Resend webhook received: event_type=' + (data?.event_type || type) + ', email_id=' + (data?.email_id || 'unknown'));
    const emailId = data?.email_id;

    if (!emailId) {
      console.log('No email_id in webhook payload, skipping');
      return new Response(
        JSON.stringify({ success: true, skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the email log entry by resend_email_id
    const { data: emailLog, error: findError } = await supabase
      .from('email_logs')
      .select('*')
      .eq('resend_email_id', emailId)
      .maybeSingle();

    if (findError || !emailLog) {
      console.log(`Email log not found for id: ${emailId}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Email log not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update based on event type
    const updateData: Record<string, unknown> = {};

    switch (type) {
      case 'email.sent':
        updateData.status = 'sent';
        break;
      case 'email.delivered':
        updateData.status = 'delivered';
        break;
      case 'email.opened':
        updateData.status = 'opened';
        updateData.opened_at = new Date().toISOString();
        break;
      case 'email.clicked':
        updateData.status = 'clicked';
        updateData.clicked_at = new Date().toISOString();
        break;
      case 'email.bounced':
        updateData.status = 'bounced';
        updateData.bounced_at = new Date().toISOString();
        updateData.error_message = data?.bounce?.message || 'Email bounced';
        break;
      case 'email.complained':
        updateData.status = 'complained';
        updateData.error_message = 'Recipient marked as spam';
        break;
      case 'email.delivery_delayed':
        updateData.status = 'delayed';
        break;
      default:
        console.log(`Unknown event type: ${type}`);
        return new Response(
          JSON.stringify({ success: true, message: 'Unknown event type' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Update the email log
    const { error: updateError } = await supabase
      .from('email_logs')
      .update(updateData)
      .eq('resend_email_id', emailId);

    if (updateError) {
      console.error('Failed to update email log:', updateError);
      throw updateError;
    }

    console.log(`Email log updated: ${emailId} -> ${updateData.status}`);

    // Log bounce but avoid logging PII
    if (type === 'email.bounced') {
      console.warn('Email bounced for recipient');
    }

    return new Response(
      JSON.stringify({ success: true, status: updateData.status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Resend webhook error:', error);
    const message = error.message || 'Webhook processing failed';
    const isExpected = message.startsWith('Unauthorized') || message.includes('signature') || message.startsWith('Webhook');

    return new Response(
      JSON.stringify({ error: isExpected ? message : 'An unexpected error occurred. Please try again.' }),
      {
        status: message?.includes('signature') ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
