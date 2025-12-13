import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const payload = await req.json();
    console.log('Resend webhook received:', JSON.stringify(payload, null, 2));

    const { type, data } = payload;
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
      .single();

    if (findError || !emailLog) {
      console.log(`Email log not found for id: ${emailId}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Email log not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update based on event type
    let updateData: any = {};

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

    // If email bounced, we might want to alert admins
    if (type === 'email.bounced') {
      console.warn(`ALERT: Email bounced for ${emailLog.to_email}`);
      // Could add notification to admins here
    }

    return new Response(
      JSON.stringify({ success: true, status: updateData.status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Resend webhook error:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});