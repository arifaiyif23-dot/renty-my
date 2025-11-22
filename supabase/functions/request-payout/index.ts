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
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { amount, bankDetails } = await req.json();

    console.log(`Payout request from user ${user.id} for RM ${amount}`);

    // Get payout limits
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: minSettings } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', 'min_payout_amount')
      .single();

    const { data: maxSettings } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', 'max_payout_amount')
      .single();

    const minAmount = minSettings?.value ? Number(minSettings.value) : 10;
    const maxAmount = maxSettings?.value ? Number(maxSettings.value) : 10000;

    if (amount < minAmount) {
      throw new Error(`Minimum payout amount is RM ${minAmount}`);
    }

    if (amount > maxAmount) {
      throw new Error(`Maximum payout amount is RM ${maxAmount}`);
    }

    // Get available earnings
    const { data: earnings, error: earningsError } = await supabaseAdmin
      .from('owner_earnings')
      .select('*')
      .eq('owner_id', user.id)
      .eq('status', 'released')
      .eq('payout_status', 'pending')
      .order('created_at', { ascending: true });

    if (earningsError) {
      console.error('Error fetching earnings:', earningsError);
      throw new Error('Failed to fetch available earnings');
    }

    const totalAvailable = earnings.reduce((sum, e) => sum + Number(e.amount), 0);

    console.log(`Available earnings: RM ${totalAvailable}`);

    if (amount > totalAvailable) {
      throw new Error(`Insufficient available earnings. Available: RM ${totalAvailable.toFixed(2)}`);
    }

    // Select earnings to include in payout (FIFO - oldest first)
    const earningsToInclude: string[] = [];
    let remaining = amount;

    for (const earning of earnings) {
      if (remaining <= 0) break;
      earningsToInclude.push(earning.id);
      remaining -= Number(earning.amount);
    }

    console.log(`Including ${earningsToInclude.length} earnings in payout`);

    // Create payout request
    const { data: payout, error: payoutError } = await supabaseAdmin
      .from('payouts')
      .insert({
        owner_id: user.id,
        amount: amount,
        earnings_included: earningsToInclude,
        bank_name: bankDetails.bankName,
        account_number: bankDetails.accountNumber,
        account_holder_name: bankDetails.accountHolderName,
        status: 'pending'
      })
      .select()
      .single();

    if (payoutError) {
      console.error('Error creating payout:', payoutError);
      throw new Error('Failed to create payout request');
    }

    // Mark earnings as processing
    await supabaseAdmin
      .from('owner_earnings')
      .update({ payout_status: 'processing', payout_id: payout.id })
      .in('id', earningsToInclude);

    console.log(`Payout request created: ${payout.id}`);

    // Notify user
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: user.id,
        type: 'payment_received',
        title: 'Payout Request Submitted',
        message: `Your payout request for RM ${amount.toFixed(2)} has been submitted and is being processed.`,
        link: '/earnings'
      });

    return new Response(
      JSON.stringify({
        success: true,
        payout: {
          id: payout.id,
          amount: payout.amount,
          status: payout.status
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in request-payout:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
