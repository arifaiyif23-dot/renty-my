/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://renty.my';

const corsHeaders = {
  'Access-Control-Allow-Origin': FRONTEND_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cronSecret = Deno.env.get('CRON_SECRET');
    const requestSecret = req.headers.get('x-cron-secret');
    if (cronSecret && (!requestSecret || requestSecret !== cronSecret)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    console.log('Starting expired payment cleanup...');
    
    // Get expired payments
    const { data: expiredPayments, error: fetchError } = await supabase
      .from('payments')
      .select('id, rental_id, toyyibpay_bill_code')
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString());
    
    if (fetchError) {
      console.error('Error fetching expired payments:', fetchError);
      throw fetchError;
    }
    
    console.log(`Found ${expiredPayments?.length || 0} expired payments`);
    
    if (!expiredPayments || expiredPayments.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No expired payments found', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Mark payments as expired (TOCTOU guard: only if still pending)
    const { error: updateError } = await supabase
      .from('payments')
      .update({ 
        status: 'expired',
        updated_at: new Date().toISOString()
      })
      .in('id', expiredPayments.map(p => p.id))
      .eq('status', 'pending');
    
    if (updateError) {
      console.error('Error updating expired payments:', updateError);
      throw updateError;
    }
    
    // Cancel associated rentals (handle all rental statuses that can have pending payments)
    const { error: cancelError } = await supabase
      .from('rentals')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .in('id', expiredPayments.map(p => p.rental_id))
      .in('status', ['pending', 'pending_approval', 'approved']);
    
    if (cancelError) {
      console.error('Error cancelling rentals:', cancelError);
      throw cancelError;
    }
    
    // Send notifications to renters
    const { data: rentals } = await supabase
      .from('rentals')
      .select('renter_id, item_id')
      .in('id', expiredPayments.map(p => p.rental_id));
    
    if (rentals) {
      for (const rental of rentals) {
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: rental.renter_id,
            type: 'rental_rejected',
            title: 'Payment Expired',
            message: 'Your payment has expired. Please create a new booking to rent this item.',
            link: `/item/${rental.item_id}`
          });
        if (notifError) {
          console.error(`Failed to send notification to renter ${rental.renter_id}:`, notifError);
        }
      }
    }
    
    console.log(`Successfully cleaned up ${expiredPayments.length} expired payments`);
    
    // Log execution
    await supabase.from('cron_job_logs').insert({
      job_name: 'cleanup-expired-payments',
      status: 'success',
      records_processed: expiredPayments.length,
      executed_at: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Expired payments cleaned up successfully',
        count: expiredPayments.length,
        paymentIds: expiredPayments.map(p => p.id)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('Payment cleanup error:', error);
    
    // Log error
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      
      await supabase.from('cron_job_logs').insert({
        job_name: 'cleanup-expired-payments',
        status: 'error',
        error_message: error.message,
        executed_at: new Date().toISOString()
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
    const message = error.message || 'Cleanup failed';
    const isExpected = message.startsWith('Missing') || message.startsWith('Unauthorized');
    return new Response(
      JSON.stringify({ error: isExpected ? message : 'An unexpected error occurred. Please try again.' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
