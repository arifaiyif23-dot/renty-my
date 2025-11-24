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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('Starting rental status transitions...');
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    let activatedCount = 0;
    let completedCount = 0;

    // TRANSITION 1: approved → active (start_date has arrived)
    const { data: toActivate, error: fetchActiveError } = await supabase
      .from('rentals')
      .select('id, renter_id, owner_id, item_id, start_date')
      .eq('status', 'approved')
      .lte('start_date', today);

    if (fetchActiveError) {
      console.error('Error fetching rentals to activate:', fetchActiveError);
      throw fetchActiveError;
    }

    if (toActivate && toActivate.length > 0) {
      console.log(`Found ${toActivate.length} rentals to activate`);

      const { error: activateError } = await supabase
        .from('rentals')
        .update({ 
          status: 'active',
          updated_at: now.toISOString()
        })
        .in('id', toActivate.map(r => r.id));

      if (activateError) {
        console.error('Error activating rentals:', activateError);
        throw activateError;
      }

      // Send notifications
      for (const rental of toActivate) {
        // Notify renter
        await supabase.from('notifications').insert({
          user_id: rental.renter_id,
          type: 'rental_approved',
          title: 'Rental Started',
          message: 'Your rental period has begun. Enjoy your item!',
          link: `/item/${rental.item_id}`
        });

        // Notify owner
        await supabase.from('notifications').insert({
          user_id: rental.owner_id,
          type: 'rental_approved',
          title: 'Rental Active',
          message: 'The rental period for your item has started.',
          link: `/dashboard`
        });
      }

      activatedCount = toActivate.length;
    }

    // TRANSITION 2: active → completed (end_date has passed)
    const { data: toComplete, error: fetchCompleteError } = await supabase
      .from('rentals')
      .select('id, renter_id, owner_id, item_id, end_date')
      .eq('status', 'active')
      .lt('end_date', today);

    if (fetchCompleteError) {
      console.error('Error fetching rentals to complete:', fetchCompleteError);
      throw fetchCompleteError;
    }

    if (toComplete && toComplete.length > 0) {
      console.log(`Found ${toComplete.length} rentals to complete`);

      const { error: completeError } = await supabase
        .from('rentals')
        .update({ 
          status: 'completed',
          updated_at: now.toISOString()
        })
        .in('id', toComplete.map(r => r.id));

      if (completeError) {
        console.error('Error completing rentals:', completeError);
        throw completeError;
      }

      // Send notifications
      for (const rental of toComplete) {
        // Notify renter
        await supabase.from('notifications').insert({
          user_id: rental.renter_id,
          type: 'rental_approved',
          title: 'Rental Completed',
          message: 'Your rental has ended. Please leave a review!',
          link: `/item/${rental.item_id}`
        });

        // Notify owner - payout is now being released
        await supabase.from('notifications').insert({
          user_id: rental.owner_id,
          type: 'payment_received',
          title: 'Rental Completed - Payout Processing',
          message: 'Your rental is complete and payout is being processed.',
          link: `/earnings`
        });
      }

      completedCount = toComplete.length;
    }

    const totalProcessed = activatedCount + completedCount;

    // Log execution
    await supabase.from('cron_job_logs').insert({
      job_name: 'process-rental-transitions',
      status: 'success',
      records_processed: totalProcessed,
      executed_at: now.toISOString()
    });

    console.log(`Transitions complete: ${activatedCount} activated, ${completedCount} completed`);

    return new Response(
      JSON.stringify({
        success: true,
        activated: activatedCount,
        completed: completedCount,
        total_processed: totalProcessed,
        timestamp: now.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Rental transition error:', error);
    
    // Log error
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      
      await supabase.from('cron_job_logs').insert({
        job_name: 'process-rental-transitions',
        status: 'error',
        error_message: error.message,
        executed_at: new Date().toISOString()
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
