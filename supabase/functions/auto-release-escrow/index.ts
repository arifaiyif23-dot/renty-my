import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's auth token for verification
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            authorization: authHeader
          }
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify user authentication
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.error('Authentication failed:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify admin role
    const { data: isAdmin, error: roleError } = await supabaseAdmin
      .rpc('has_role', { 
        _user_id: user.id, 
        _role: 'admin' 
      });

    if (roleError) {
      console.error('Role check error:', roleError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to verify permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isAdmin) {
      console.error('Access denied: User is not admin');
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting auto-release escrow check by admin: ${user.id}`);

    // Check if auto-release is enabled
    const { data: autoReleaseSetting } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', 'enable_auto_escrow_release')
      .single();

    if (!autoReleaseSetting || autoReleaseSetting.value !== 'true') {
      console.log('Auto-release is disabled');
      return new Response(
        JSON.stringify({ success: true, message: 'Auto-release disabled', released: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get eligible escrows for auto-release
    const { data: eligibleEscrows, error: checkError } = await supabaseAdmin
      .rpc('check_escrow_auto_release');

    if (checkError) {
      console.error('Error checking eligible escrows:', checkError);
      throw checkError;
    }

    console.log(`Found ${eligibleEscrows?.length || 0} eligible escrows for auto-release`);

    let releasedCount = 0;
    const errors = [];

    for (const escrow of eligibleEscrows || []) {
      try {
        console.log(`Processing escrow ${escrow.escrow_id} for rental ${escrow.rental_id}`);

        // Get escrow details
        const { data: escrowAccount, error: escrowError } = await supabaseAdmin
          .from('escrow_accounts')
          .select('*, rental:rentals!inner(owner_id, renter_id)')
          .eq('id', escrow.escrow_id)
          .single();

        if (escrowError || !escrowAccount) {
          throw new Error(`Failed to get escrow account: ${escrowError?.message}`);
        }

        // Get owner wallet
        const { data: ownerWallet } = await supabaseAdmin
          .from('wallets')
          .select('id')
          .eq('user_id', escrowAccount.rental.owner_id)
          .single();

        if (!ownerWallet) {
          throw new Error('Owner wallet not found');
        }

        // Release payment to owner
        const { data: newBalance, error: releaseError } = await supabaseAdmin
          .rpc('increment_wallet_balance', {
            p_user_id: escrowAccount.rental.owner_id,
            p_amount: escrowAccount.owner_payout
          });

        if (releaseError) {
          throw new Error(`Failed to release payment: ${releaseError.message}`);
        }

        // Record escrow transaction
        await supabaseAdmin
          .from('escrow_transactions')
          .insert({
            escrow_account_id: escrowAccount.id,
            transaction_type: 'release',
            amount: escrowAccount.owner_payout,
            to_wallet_id: ownerWallet.id,
            notes: 'Automatic release after grace period'
          });

        // Update escrow status
        await supabaseAdmin
          .from('escrow_accounts')
          .update({
            status: 'released',
            released_at: new Date().toISOString()
          })
          .eq('id', escrowAccount.id);

        // Create wallet transaction record
        await supabaseAdmin
          .from('wallet_transactions')
          .insert({
            wallet_id: ownerWallet.id,
            type: 'rental_earning',
            amount: escrowAccount.owner_payout,
            description: `Auto-released earnings from rental`,
            status: 'completed',
            reference_id: escrow.rental_id,
            completed_at: new Date().toISOString()
          });

        // Notify owner
        await supabaseAdmin
          .from('notifications')
          .insert({
            user_id: escrowAccount.rental.owner_id,
            type: 'payment_received',
            title: 'Payment Released!',
            message: `RM ${escrowAccount.owner_payout.toFixed(2)} has been released to your wallet`,
            link: '/wallet'
          });

        releasedCount++;
        console.log(`Successfully released escrow ${escrow.escrow_id}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing escrow ${escrow.escrow_id}:`, error);
        errors.push({
          escrow_id: escrow.escrow_id,
          error: errorMessage
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        released: releasedCount,
        total_checked: eligibleEscrows?.length || 0,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Auto-release escrow error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});