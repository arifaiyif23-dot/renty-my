import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const refundSchema = z.object({
  rentalId: z.string().uuid(),
  reason: z.enum(['user_cancellation', 'owner_cancellation', 'item_unavailable', 'dispute']),
  notes: z.string().optional()
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const body = await req.json();
    const validatedData = refundSchema.parse(body);

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

    console.log('Processing refund for rental:', validatedData.rentalId);

    // Get rental details
    const { data: rental, error: rentalError } = await supabaseAdmin
      .from('rentals')
      .select(`
        *,
        item:items!inner(id, owner_id)
      `)
      .eq('id', validatedData.rentalId)
      .single();

    if (rentalError || !rental) {
      throw new Error('Rental not found');
    }

    // Verify user is involved in rental
    if (rental.renter_id !== user.id && rental.owner_id !== user.id) {
      const { data: adminCheck } = await supabase.functions.invoke('verify-admin');
      if (!adminCheck?.isAdmin) {
        throw new Error('Not authorized to process this refund');
      }
    }

    // Get escrow account
    const { data: escrowAccount, error: escrowError } = await supabaseAdmin
      .from('escrow_accounts')
      .select('*')
      .eq('rental_id', validatedData.rentalId)
      .single();

    if (escrowError || !escrowAccount) {
      throw new Error('Escrow account not found');
    }

    if (escrowAccount.status === 'released') {
      throw new Error('Escrow already released - cannot refund');
    }

    // Get refund policy
    const { data: refundPolicy } = await supabaseAdmin
      .from('refund_policies')
      .select('*')
      .eq('item_id', rental.item_id)
      .eq('is_active', true)
      .single();

    // Calculate refund amount
    let refundPercentage = 100;
    let compensationPercentage = 0;
    let refundAmount = escrowAccount.total_amount;
    let compensationAmount = 0;

    const hoursUntilStart = (new Date(rental.start_date).getTime() - Date.now()) / (1000 * 60 * 60);

    switch (validatedData.reason) {
      case 'user_cancellation':
        if (refundPolicy) {
          if (hoursUntilStart > refundPolicy.cancellation_window_hours) {
            refundPercentage = refundPolicy.refund_percentage;
          } else if (hoursUntilStart > 24) {
            refundPercentage = 50;
          } else {
            refundPercentage = 0;
          }
        } else {
          // Default policy
          if (hoursUntilStart > 48) {
            refundPercentage = 95; // 5% processing fee
          } else if (hoursUntilStart > 24) {
            refundPercentage = 50;
          } else {
            refundPercentage = 0;
          }
        }
        refundAmount = (escrowAccount.total_amount * refundPercentage) / 100;
        break;

      case 'owner_cancellation':
        refundPercentage = 100;
        compensationPercentage = refundPolicy?.compensation_percentage || 10;
        refundAmount = escrowAccount.total_amount;
        compensationAmount = (escrowAccount.total_amount * compensationPercentage) / 100;
        break;

      case 'item_unavailable':
        refundPercentage = 100;
        compensationPercentage = refundPolicy?.compensation_percentage || 15;
        refundAmount = escrowAccount.total_amount;
        compensationAmount = (escrowAccount.total_amount * compensationPercentage) / 100;
        break;

      case 'dispute':
        // For disputes, amount is determined by dispute resolution
        // This should be called from resolve-dispute function
        refundAmount = escrowAccount.total_amount;
        break;
    }

    console.log('Refund calculation:', {
      reason: validatedData.reason,
      hoursUntilStart,
      refundPercentage,
      refundAmount,
      compensationAmount
    });

    // Get renter wallet
    const { data: renterWallet } = await supabaseAdmin
      .from('wallets')
      .select('id')
      .eq('user_id', rental.renter_id)
      .single();

    if (!renterWallet) {
      throw new Error('Renter wallet not found');
    }

    // Process refund
    const totalRefund = refundAmount + compensationAmount;
    
    await supabaseAdmin.rpc('increment_wallet_balance', {
      p_user_id: rental.renter_id,
      p_amount: totalRefund
    });

    // Record escrow transaction
    await supabaseAdmin.from('escrow_transactions').insert({
      escrow_account_id: escrowAccount.id,
      transaction_type: 'refund',
      amount: totalRefund,
      to_wallet_id: renterWallet.id,
      executed_by: user.id,
      notes: `Refund: ${validatedData.reason}${validatedData.notes ? ` - ${validatedData.notes}` : ''}`
    });

    // Update escrow status
    await supabaseAdmin
      .from('escrow_accounts')
      .update({
        status: 'refunded',
        released_at: new Date().toISOString()
      })
      .eq('id', escrowAccount.id);

    // Create wallet transaction
    await supabaseAdmin.from('wallet_transactions').insert({
      wallet_id: renterWallet.id,
      type: 'refund',
      amount: totalRefund,
      description: `Refund for cancelled rental (${refundPercentage}%${compensationAmount > 0 ? ` + RM${compensationAmount.toFixed(2)} compensation` : ''})`,
      status: 'completed',
      reference_id: validatedData.rentalId,
      completed_at: new Date().toISOString()
    });

    // Update rental status
    await supabaseAdmin
      .from('rentals')
      .update({
        status: 'cancelled',
        payment_status: 'refunded'
      })
      .eq('id', validatedData.rentalId);

    // Send notifications
    await supabaseAdmin.from('notifications').insert([
      {
        user_id: rental.renter_id,
        type: 'payment_received',
        title: 'Refund Processed',
        message: `RM ${totalRefund.toFixed(2)} has been refunded to your wallet${compensationAmount > 0 ? ` (including RM${compensationAmount.toFixed(2)} compensation)` : ''}.`,
        link: '/wallet'
      },
      {
        user_id: rental.owner_id,
        type: 'rental_rejected',
        title: 'Rental Cancelled',
        message: `Rental has been cancelled and refunded to renter.`,
        link: `/rentals/${validatedData.rentalId}`
      }
    ]);

    console.log('Refund processed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        refund: {
          rentalId: validatedData.rentalId,
          refundAmount,
          compensationAmount,
          totalRefund,
          refundPercentage
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Process refund error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});