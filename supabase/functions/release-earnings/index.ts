import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Running earnings release check...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const today = new Date().toISOString().split('T')[0];

    // Find earnings ready to release
    const { data: readyEarnings, error: fetchError } = await supabase
      .from('owner_earnings')
      .select(`
        *,
        rental:rentals(
          id,
          status,
          item:items(
            title
          )
        )
      `)
      .eq('status', 'held')
      .eq('payout_status', 'pending')
      .lte('held_until', today);

    if (fetchError) {
      console.error('Error fetching earnings:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${readyEarnings?.length || 0} earnings ready for release`);

    let releasedCount = 0;
    let skippedCount = 0;

    for (const earning of readyEarnings || []) {
      // Check if rental is completed
      if (earning.rental.status !== 'completed') {
        console.log(`Skipping earning ${earning.id} - rental not completed`);
        skippedCount++;
        continue;
      }

      // Check for active disputes
      const { data: disputes } = await supabase
        .from('disputes')
        .select('id')
        .eq('rental_id', earning.rental_id)
        .in('status', ['open', 'investigating'])
        .limit(1);

      if (disputes && disputes.length > 0) {
        console.log(`Skipping earning ${earning.id} - active dispute exists`);
        skippedCount++;
        continue;
      }

      // Release the earning
      const { error: updateError } = await supabase
        .from('owner_earnings')
        .update({
          status: 'released',
          released_at: new Date().toISOString()
        })
        .eq('id', earning.id);

      if (updateError) {
        console.error(`Error releasing earning ${earning.id}:`, updateError);
        continue;
      }

      // Notify owner
      await supabase
        .from('notifications')
        .insert({
          user_id: earning.owner_id,
          type: 'payment_received',
          title: 'Earnings Available!',
          message: `Your earnings of RM ${earning.amount.toFixed(2)} from "${earning.rental.item.title}" are now available for payout.`,
          link: '/earnings'
        });

      console.log(`Released earning ${earning.id}: RM ${earning.amount}`);
      releasedCount++;
    }

    console.log(`Release complete: ${releasedCount} released, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        released: releasedCount,
        skipped: skippedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in release-earnings:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
