import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const rentalPaymentSchema = z.object({
  rentalId: z.string().uuid(),
});

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

    const body = await req.json();
    const validationResult = rentalPaymentSchema.safeParse(body);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid input parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { rentalId } = validationResult.data;

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
      throw new Error('Payment is already being processed');
    }

    // Initialize state tracking flags
    let walletUpdated = false;
    let transactionRecorded = false;
    let rentalUpdated = false;

    // Helper function to log payment processing steps
    const logPaymentStep = async (action: string, details?: any) => {
      try {
        await supabaseServiceClient.from('payment_processing_log').insert({
          rental_id: rentalId,
          user_id: user.id,
          action,
          details: details ? { ...details, timestamp: new Date().toISOString() } : null,
        });
      } catch (err) {
        console.error('Failed to log payment step:', err);
      }
    };

    try {
      await logPaymentStep('started');

      // Get rental details
      const { data: rental, error: rentalError } = await supabaseServiceClient
        .from('rentals')
        .select('*, item:items(title, owner_id)')
        .eq('id', rentalId)
        .single();

      if (rentalError || !rental) throw new Error('Rental not found');

      // Verify user is authorized (owner or renter)
      if (user.id !== rental.owner_id && user.id !== rental.renter_id) {
        throw new Error("Unauthorized to complete this rental");
      }

      // Idempotency check
      if (rental.status === 'completed' || rental.payment_status === 'paid') {
        await logPaymentStep('completed', { note: 'Already completed - idempotency check' });
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

      await logPaymentStep('lock_acquired', { 
        total_price: totalPrice, 
        platform_fee: platformFee, 
        owner_amount: ownerAmount 
      });

      // Update owner's wallet balance atomically
      const { error: updateError } = await supabaseServiceClient.rpc("increment_wallet_balance", {
        p_user_id: rental.item.owner_id,
        p_amount: ownerAmount,
      });

      if (updateError) {
        throw new Error("Failed to update owner wallet");
      }
      
      walletUpdated = true;
      await logPaymentStep('wallet_updated', { 
        owner_id: rental.item.owner_id, 
        amount: ownerAmount 
      });

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
        throw new Error('Failed to record transaction');
      }
      
      transactionRecorded = true;
      await logPaymentStep('transaction_recorded', { 
        wallet_id: ownerWallet.id, 
        transaction_type: 'rental_earning' 
      });

      // Update rental status
      const { error: rentalUpdateError } = await supabaseServiceClient
        .from('rentals')
        .update({ 
          status: 'completed',
          payment_status: 'paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', rentalId);

      if (rentalUpdateError) {
        throw new Error('Failed to update rental status');
      }
      
      rentalUpdated = true;
      await logPaymentStep('rental_updated', { 
        rental_id: rentalId, 
        new_status: 'completed' 
      });

      // Create notifications (non-critical - log errors but don't fail)
      try {
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
        await logPaymentStep('notifications_sent');
      } catch (notifErr) {
        console.error('Failed to send notifications:', notifErr);
      }

      // Release payment lock
      await supabaseServiceClient.rpc('release_payment_lock', { p_rental_id: rentalId });
      await logPaymentStep('completed', { success: true });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Payment processed successfully',
          ownerAmount,
          platformFee
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (innerError: any) {
      // Rollback logic based on what steps completed
      console.error('Payment processing error:', innerError);
      
      await logPaymentStep('failed', { 
        error: innerError.message,
        wallet_updated: walletUpdated,
        transaction_recorded: transactionRecorded,
        rental_updated: rentalUpdated
      });

      // If wallet was updated but transaction recording or rental update failed, rollback
      if (walletUpdated && (!transactionRecorded || !rentalUpdated)) {
        console.log('Attempting rollback: wallet updated but process incomplete');
        
        try {
          const { data: rental } = await supabaseServiceClient
            .from('rentals')
            .select('*, item:items(owner_id)')
            .eq('id', rentalId)
            .single();

          if (rental) {
            const platformFeeRate = 0.10;
            const totalPrice = Number(rental.total_price);
            const platformFee = totalPrice * platformFeeRate;
            const ownerAmount = totalPrice - platformFee;

            await supabaseServiceClient.rpc('refund_wallet_balance', {
              p_user_id: rental.item.owner_id,
              p_amount: ownerAmount,
              p_reason: `Payment processing failed - automatic rollback for rental ${rentalId}`
            });

            await logPaymentStep('rolled_back', { 
              refunded_amount: ownerAmount,
              reason: 'Payment processing incomplete'
            });
            
            console.log('Rollback successful');
          }
        } catch (rollbackError: any) {
          console.error('CRITICAL: Rollback failed:', rollbackError);
          await logPaymentStep('failed', { 
            error: 'Rollback failed',
            rollback_error: rollbackError.message
          });
        }
      }

      // Release lock on error
      await supabaseServiceClient.rpc('release_payment_lock', { p_rental_id: rentalId });
      throw innerError;
    }

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Payment processing failed'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
