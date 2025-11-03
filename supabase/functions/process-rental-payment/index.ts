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
    // Verify authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized - invalid token");

    const { rentalId } = await req.json();
    if (!rentalId) throw new Error('Rental ID is required');

    console.log('Processing rental payment completion for:', rentalId);

    // Log audit entry
    const logAudit = async (action: string, status: string, details: any) => {
      await supabaseServiceClient.from('payment_audit_log').insert({
        rental_id: rentalId,
        user_id: user.id,
        action,
        status,
        details,
        created_at: new Date().toISOString()
      });
    };

    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Acquire payment lock to prevent race conditions
    const { data: lockAcquired } = await supabaseServiceClient
      .rpc('acquire_payment_lock', { 
        p_rental_id: rentalId, 
        p_user_id: user.id 
      });

    if (!lockAcquired) {
      console.log('Payment already being processed:', rentalId);
      await logAudit('payment_attempt', 'failed', { reason: 'lock_acquisition_failed' });
      throw new Error('Payment is already being processed');
    }

    console.log('Payment lock acquired for:', rentalId);
    await logAudit('lock_acquired', 'success', { user_id: user.id });

    try {
      // Get rental details
    const { data: rental, error: rentalError } = await supabaseServiceClient
      .from('rentals')
      .select('*, item:items(title, owner_id)')
      .eq('id', rentalId)
      .single();

    if (rentalError || !rental) throw new Error('Rental not found');

    // Verify user is authorized (owner or renter)
    if (user.id !== rental.owner_id && user.id !== rental.renter_id) {
      console.error("Unauthorized access attempt:", { userId: user.id, rental });
      throw new Error("Unauthorized to complete this rental");
    }

    // Idempotency check
    if (rental.status === 'completed' || rental.payment_status === 'paid') {
      console.log('Rental already completed:', rentalId);
      return new Response(
        JSON.stringify({ success: true, message: 'Already completed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get owner's wallet
    const { data: ownerWallet, error: walletError } = await supabaseServiceClient
      .from('wallets')
      .select('id, balance')
      .eq('user_id', rental.item.owner_id)
      .single();

    if (walletError || !ownerWallet) throw new Error('Owner wallet not found');

    // Calculate platform fee (10%)
    const platformFeeRate = 0.10;
    const totalPrice = Number(rental.total_price);
    const platformFee = totalPrice * platformFeeRate;
    const ownerAmount = totalPrice - platformFee;

    console.log('Payment breakdown:', { totalPrice, platformFee, ownerAmount });

    // Update owner's wallet balance atomically
    const { error: updateError } = await supabaseServiceClient.rpc("increment_wallet_balance", {
      p_user_id: rental.item.owner_id,
      p_amount: ownerAmount,
    });

    if (updateError) {
      console.error('Failed to update owner wallet:', updateError);
      throw new Error("Failed to update owner wallet");
    }

    // Record transaction for owner
    const { error: txError } = await supabaseServiceClient
      .from('wallet_transactions')
      .insert({
        wallet_id: ownerWallet.id,
        type: 'rental_earning',
        amount: ownerAmount,
        description: `Rental payment for ${rental.item.title} (10% platform fee deducted)`,
        reference_id: rentalId,
        status: 'completed',
      });

    if (txError) {
      console.error('Failed to record transaction:', txError);
      throw new Error('Failed to record transaction');
    }

    // Update rental status
    const { error: rentalUpdateError } = await supabaseServiceClient
      .from('rentals')
      .update({ 
        status: 'confirmed',
        payment_status: 'paid',
        updated_at: new Date().toISOString()
      })
      .eq('id', rentalId);

    if (rentalUpdateError) {
      console.error('Failed to update rental:', rentalUpdateError);
      throw new Error('Failed to update rental status');
    }

    // Create notifications
    await supabaseServiceClient
      .from('notifications')
      .insert([
        {
          user_id: rental.owner_id,
          type: 'rental_confirmed',
          title: 'Rental Payment Received',
          message: `You've received RM ${ownerAmount.toFixed(2)} for ${rental.item.title}`,
          link: `/dashboard`,
        },
        {
          user_id: rental.renter_id,
          type: 'rental_confirmed',
          title: 'Booking Confirmed',
          message: `Your booking for ${rental.item.title} is confirmed`,
          link: `/dashboard`,
        }
      ]);

    console.log('Rental payment processed successfully:', rentalId);
    await logAudit('payment_completed', 'success', { ownerAmount, platformFee });

    // Release payment lock
    await supabaseServiceClient.rpc('release_payment_lock', { p_rental_id: rentalId });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Payment processed successfully',
        ownerAmount,
        platformFee
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

    } catch (innerError) {
      // Release lock on error
      await supabaseServiceClient.rpc('release_payment_lock', { p_rental_id: rentalId });
      throw innerError;
    }

  } catch (error) {
    console.error('Error processing rental payment:', error);
    
    // Log failed attempt
    try {
      const supabaseServiceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      await supabaseServiceClient.from('payment_audit_log').insert({
        rental_id: await req.json().then(body => body.rentalId).catch(() => null),
        action: 'payment_failed',
        status: 'error',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    } catch (auditError) {
      console.error('Failed to log audit:', auditError);
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
