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
    const { rentalId } = await req.json();

    if (!rentalId) {
      throw new Error('Rental ID is required');
    }

    console.log('Processing rental payment completion for:', rentalId);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get rental details
    const { data: rental, error: rentalError } = await supabaseClient
      .from('rentals')
      .select('*, item:items(title, owner_id)')
      .eq('id', rentalId)
      .single();

    if (rentalError || !rental) {
      throw new Error('Rental not found');
    }

    // Check if rental is already completed
    if (rental.status === 'completed') {
      console.log('Rental already completed:', rentalId);
      return new Response(
        JSON.stringify({ success: true, message: 'Already completed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get owner's wallet
    const { data: ownerWallet, error: walletError } = await supabaseClient
      .from('wallets')
      .select('id, balance')
      .eq('user_id', rental.item.owner_id)
      .single();

    if (walletError || !ownerWallet) {
      throw new Error('Owner wallet not found');
    }

    // Calculate platform fee (10%)
    const platformFeeRate = 0.10;
    const platformFee = Number(rental.total_price) * platformFeeRate;
    const ownerAmount = Number(rental.total_price) - platformFee;

    // Update owner's wallet balance
    const newBalance = Number(ownerWallet.balance) + ownerAmount;
    const { error: updateError } = await supabaseClient
      .from('wallets')
      .update({ balance: newBalance })
      .eq('id', ownerWallet.id);

    if (updateError) {
      throw new Error('Failed to update owner wallet');
    }

    // Record transaction for owner
    await supabaseClient
      .from('wallet_transactions')
      .insert({
        wallet_id: ownerWallet.id,
        type: 'rental_income',
        amount: ownerAmount,
        description: `Payment received for "${rental.item.title}" (Platform fee: RM${platformFee.toFixed(2)})`,
        reference_id: rentalId,
      });

    // Update rental status to completed
    await supabaseClient
      .from('rentals')
      .update({ 
        status: 'completed',
        payment_status: 'paid'
      })
      .eq('id', rentalId);

    // Send notification to owner
    await supabaseClient
      .from('notifications')
      .insert({
        user_id: rental.item.owner_id,
        type: 'rental',
        title: 'Payment Received',
        message: `You received RM${ownerAmount.toFixed(2)} for renting out "${rental.item.title}"`,
        link: '/wallet'
      });

    // Send notification to renter
    await supabaseClient
      .from('notifications')
      .insert({
        user_id: rental.renter_id,
        type: 'rental',
        title: 'Rental Completed',
        message: `Your rental of "${rental.item.title}" has been completed`,
        link: `/items/${rental.item_id}`
      });

    console.log('Rental payment processed successfully:', {
      rentalId,
      ownerAmount,
      platformFee,
      newBalance
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        ownerAmount,
        platformFee
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: any) {
    console.error('Error processing rental payment:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
