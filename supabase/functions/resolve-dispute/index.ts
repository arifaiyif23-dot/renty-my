import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resolutionSchema = z.object({
  disputeId: z.string().uuid(),
  resolutionType: z.enum(['full_refund', 'full_release', 'partial_split', 'custom']),
  resolutionNotes: z.string().min(10),
  ownerPercentage: z.number().min(0).max(100).optional(),
  renterPercentage: z.number().min(0).max(100).optional(),
  customAmount: z.number().optional()
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

    // Verify admin access
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: adminCheck } = await supabase.functions.invoke('verify-admin');
    if (!adminCheck?.isAdmin) {
      throw new Error('Admin access required');
    }

    const body = await req.json();
    const validatedData = resolutionSchema.parse(body);

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

    console.log('Resolving dispute:', validatedData.disputeId);

    // Get dispute details
    const { data: dispute, error: disputeError } = await supabaseAdmin
      .from('disputes')
      .select(`
        *,
        rental:rentals!inner(
          id, owner_id, renter_id, total_price
        )
      `)
      .eq('id', validatedData.disputeId)
      .single();

    if (disputeError || !dispute) {
      throw new Error('Dispute not found');
    }

    if (dispute.status === 'resolved') {
      throw new Error('Dispute already resolved');
    }

    // Get escrow account
    const { data: escrowAccount, error: escrowError } = await supabaseAdmin
      .from('escrow_accounts')
      .select('*')
      .eq('rental_id', dispute.rental_id)
      .single();

    if (escrowError || !escrowAccount) {
      throw new Error('Escrow account not found');
    }

    if (escrowAccount.status !== 'disputed') {
      throw new Error('Escrow is not in disputed state');
    }

    // Get wallets
    const { data: ownerWallet } = await supabaseAdmin
      .from('wallets')
      .select('id')
      .eq('user_id', dispute.rental.owner_id)
      .single();

    const { data: renterWallet } = await supabaseAdmin
      .from('wallets')
      .select('id')
      .eq('user_id', dispute.rental.renter_id)
      .single();

    if (!ownerWallet || !renterWallet) {
      throw new Error('Wallets not found');
    }

    let ownerAmount = 0;
    let renterAmount = 0;
    let resolutionSplit = {};

    // Calculate amounts based on resolution type
    switch (validatedData.resolutionType) {
      case 'full_refund':
        renterAmount = escrowAccount.total_amount;
        resolutionSplit = { owner: 0, renter: 1 };
        break;
      
      case 'full_release':
        ownerAmount = escrowAccount.owner_payout;
        resolutionSplit = { owner: 1, renter: 0 };
        break;
      
      case 'partial_split':
        if (!validatedData.ownerPercentage || !validatedData.renterPercentage) {
          throw new Error('Percentages required for partial split');
        }
        if (validatedData.ownerPercentage + validatedData.renterPercentage !== 100) {
          throw new Error('Percentages must sum to 100');
        }
        ownerAmount = (escrowAccount.total_amount * validatedData.ownerPercentage) / 100;
        renterAmount = (escrowAccount.total_amount * validatedData.renterPercentage) / 100;
        resolutionSplit = {
          owner: validatedData.ownerPercentage / 100,
          renter: validatedData.renterPercentage / 100
        };
        break;
      
      case 'custom':
        if (!validatedData.customAmount) {
          throw new Error('Custom amount required');
        }
        // Custom amount goes to renter, rest to owner
        renterAmount = validatedData.customAmount;
        ownerAmount = escrowAccount.total_amount - validatedData.customAmount;
        if (ownerAmount < 0) {
          throw new Error('Custom amount exceeds total escrow');
        }
        resolutionSplit = {
          owner: ownerAmount / escrowAccount.total_amount,
          renter: renterAmount / escrowAccount.total_amount
        };
        break;
    }

    console.log('Resolution amounts:', { ownerAmount, renterAmount });

    // Transfer funds
    if (ownerAmount > 0) {
      await supabaseAdmin.rpc('increment_wallet_balance', {
        p_user_id: dispute.rental.owner_id,
        p_amount: ownerAmount
      });

      await supabaseAdmin.from('escrow_transactions').insert({
        escrow_account_id: escrowAccount.id,
        transaction_type: 'partial_release',
        amount: ownerAmount,
        to_wallet_id: ownerWallet.id,
        executed_by: user.id,
        notes: `Dispute resolution: ${validatedData.resolutionType}`
      });

      await supabaseAdmin.from('wallet_transactions').insert({
        wallet_id: ownerWallet.id,
        type: 'rental_earning',
        amount: ownerAmount,
        description: `Dispute resolved - ${validatedData.resolutionType}`,
        status: 'completed',
        reference_id: dispute.rental_id,
        completed_at: new Date().toISOString()
      });
    }

    if (renterAmount > 0) {
      await supabaseAdmin.rpc('increment_wallet_balance', {
        p_user_id: dispute.rental.renter_id,
        p_amount: renterAmount
      });

      await supabaseAdmin.from('escrow_transactions').insert({
        escrow_account_id: escrowAccount.id,
        transaction_type: 'refund',
        amount: renterAmount,
        to_wallet_id: renterWallet.id,
        executed_by: user.id,
        notes: `Dispute resolution: ${validatedData.resolutionType}`
      });

      await supabaseAdmin.from('wallet_transactions').insert({
        wallet_id: renterWallet.id,
        type: 'refund',
        amount: renterAmount,
        description: `Dispute resolved - refund`,
        status: 'completed',
        reference_id: dispute.rental_id,
        completed_at: new Date().toISOString()
      });
    }

    // Update dispute
    await supabaseAdmin
      .from('disputes')
      .update({
        status: 'resolved',
        resolution_notes: validatedData.resolutionNotes,
        resolution_amount: renterAmount,
        resolution_split: resolutionSplit,
        resolved_by: user.id,
        resolved_at: new Date().toISOString()
      })
      .eq('id', validatedData.disputeId);

    // Update escrow
    await supabaseAdmin
      .from('escrow_accounts')
      .update({
        status: 'released',
        released_at: new Date().toISOString()
      })
      .eq('id', escrowAccount.id);

    // Send notifications
    await supabaseAdmin.from('notifications').insert([
      {
        user_id: dispute.rental.owner_id,
        type: 'rental_approved',
        title: 'Dispute Resolved',
        message: ownerAmount > 0 
          ? `Dispute resolved. RM ${ownerAmount.toFixed(2)} released to your wallet.`
          : 'Dispute resolved in favor of renter.',
        link: `/rentals/${dispute.rental_id}`
      },
      {
        user_id: dispute.rental.renter_id,
        type: 'rental_approved',
        title: 'Dispute Resolved',
        message: renterAmount > 0
          ? `Dispute resolved. RM ${renterAmount.toFixed(2)} refunded to your wallet.`
          : 'Dispute resolved in favor of owner.',
        link: `/rentals/${dispute.rental_id}`
      }
    ]);

    console.log('Dispute resolved successfully');

    return new Response(
      JSON.stringify({
        success: true,
        resolution: {
          disputeId: validatedData.disputeId,
          ownerAmount,
          renterAmount,
          resolutionType: validatedData.resolutionType
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Resolve dispute error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});