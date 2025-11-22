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
    let renterWalletDeducted = false;
    let escrowCreated = false;

    // Helper function to log payment processing steps
    const logPaymentStep = async (action: string, details?: any) => {
      try {
        await supabaseServiceClient.from('payment_processing_log').insert({
          rental_id: rentalId,
          user_id: user.id,
          action,
          details: details ? { ...details, timestamp: new Date().toISOString() } : null,
        });
        console.log(`[${rentalId}] ${action}:`, details || '');
      } catch (err) {
        console.error('Failed to log payment step:', err);
      }
    };

    try {
      await logPaymentStep('escrow_payment_started');

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

      // Idempotency check - check if escrow already exists
      const { data: existingEscrow } = await supabaseServiceClient
        .from('escrow_accounts')
        .select('*')
        .eq('rental_id', rentalId)
        .single();

      if (existingEscrow) {
        await logPaymentStep('escrow_already_exists', { 
          escrow_status: existingEscrow.status,
          note: 'Idempotency check - escrow already created' 
        });
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Escrow already created',
            escrowStatus: existingEscrow.status
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get renter's wallet for deduction
      const { data: renterWallet, error: renterWalletError } = await supabaseServiceClient
        .from('wallets')
        .select('id, balance')
        .eq('user_id', rental.renter_id)
        .single();

      if (renterWalletError || !renterWallet) throw new Error('Renter wallet not found');

      // Get owner's wallet (create if doesn't exist)
      let { data: ownerWallet, error: ownerWalletError } = await supabaseServiceClient
        .from('wallets')
        .select('id, balance')
        .eq('user_id', rental.item.owner_id)
        .single();

      if (ownerWalletError || !ownerWallet) {
        const { data: newWallet, error: createError } = await supabaseServiceClient
          .from('wallets')
          .insert({ user_id: rental.item.owner_id, balance: 0 })
          .select()
          .single();
        
        if (createError) throw new Error('Failed to create owner wallet');
        ownerWallet = newWallet;
      }

      // Get dynamic platform fee rate
      const { data: platformFeeRateData } = await supabaseServiceClient
        .rpc('get_platform_setting', { setting_key: 'platform_fee_rate' });
      
      // NEW FEE MODEL: Platform fee is already included in total_price (charged to renter)
      const platformFeeRate = platformFeeRateData || 0.10; // 10%
      const totalPrice = Number(rental.total_price); // This includes the 10% platform fee
      const baseRentalAmount = totalPrice / (1 + platformFeeRate); // Extract base price
      const platformFee = totalPrice - baseRentalAmount; // Calculate platform fee
      const ownerAmount = baseRentalAmount; // Owner gets 100% of base price

      await logPaymentStep('escrow_calculation', { 
        total_price: totalPrice, 
        platform_fee: platformFee,
        platform_fee_rate: platformFeeRate,
        owner_payout: ownerAmount 
      });

      // Check renter has sufficient balance
      if (renterWallet.balance < totalPrice) {
        throw new Error(`Insufficient balance. Required: RM${totalPrice}, Available: RM${renterWallet.balance}`);
      }

      // Deduct from renter's wallet
      const { data: deductResult, error: deductError } = await supabaseServiceClient
        .rpc('deduct_wallet_balance', {
          p_user_id: rental.renter_id,
          p_amount: totalPrice,
          p_idempotency_key: `rental_payment_${rentalId}`
        });

      if (deductError || !deductResult?.success) {
        throw new Error(deductResult?.error || 'Failed to deduct from renter wallet');
      }

      renterWalletDeducted = true;
      await logPaymentStep('renter_wallet_deducted', { 
        renter_id: rental.renter_id,
        amount: totalPrice,
        new_balance: deductResult.new_balance
      });

      // Record renter's payment transaction
      await supabaseServiceClient
        .from('wallet_transactions')
        .insert({
          wallet_id: renterWallet.id,
          type: 'rental_payment',
          amount: -totalPrice,
          description: `Payment for ${rental.item.title} - held in escrow`,
          reference_id: rentalId,
          status: 'completed',
          idempotency_key: `rental_payment_${rentalId}`
        });

      // Create escrow account
      const { data: escrowAccount, error: escrowError } = await supabaseServiceClient
        .from('escrow_accounts')
        .insert({
          rental_id: rentalId,
          total_amount: totalPrice,
          platform_fee: platformFee,
          owner_payout: ownerAmount,
          status: 'held',
          held_at: new Date().toISOString(),
          // Auto-release will be set by trigger when rental completes
        })
        .select()
        .single();

      if (escrowError) {
        throw new Error('Failed to create escrow account');
      }

      escrowCreated = true;
      await logPaymentStep('escrow_account_created', { 
        escrow_id: escrowAccount.id,
        status: 'held',
        total_amount: totalPrice
      });

      // Record escrow transaction
      await supabaseServiceClient
        .from('escrow_transactions')
        .insert({
          escrow_account_id: escrowAccount.id,
          transaction_type: 'deposit',
          amount: totalPrice,
          from_wallet_id: renterWallet.id,
          notes: `Payment received from renter - held in escrow pending rental completion`
        });

      await logPaymentStep('escrow_transaction_recorded', {
        transaction_type: 'deposit'
      });

      // Update rental status to indicate payment is in escrow
      const { error: rentalUpdateError } = await supabaseServiceClient
        .from('rentals')
        .update({ 
          payment_status: 'escrowed',
          updated_at: new Date().toISOString()
        })
        .eq('id', rentalId);

      if (rentalUpdateError) {
        throw new Error('Failed to update rental payment status');
      }

      await logPaymentStep('rental_payment_status_updated', { 
        payment_status: 'escrowed'
      });

      // Create notifications
      try {
        await supabaseServiceClient
          .from('notifications')
          .insert([
            {
              user_id: rental.owner_id,
              type: 'rental_confirmed',
              title: 'Payment Received in Escrow',
              message: `RM ${ownerAmount.toFixed(2)} for ${rental.item.title} is held safely in escrow. It will be released after rental completion.`,
              link: `/dashboard`,
            },
            {
              user_id: rental.renter_id,
              type: 'rental_confirmed',
              title: 'Payment Secured',
              message: `Your payment of RM ${totalPrice.toFixed(2)} for ${rental.item.title} is held safely in escrow`,
              link: `/dashboard`,
            }
          ]);
        await logPaymentStep('notifications_sent');
      } catch (notifErr) {
        console.error('Failed to send notifications:', notifErr);
      }

      // Release payment lock
      await supabaseServiceClient.rpc('release_payment_lock', { p_rental_id: rentalId });
      await logPaymentStep('escrow_payment_completed', { 
        success: true,
        escrow_id: escrowAccount.id
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Payment secured in escrow',
          escrowId: escrowAccount.id,
          ownerPayout: ownerAmount,
          platformFee,
          status: 'escrowed'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (innerError: any) {
      // Rollback logic
      console.error('Escrow payment error:', innerError);
      
      await logPaymentStep('escrow_payment_failed', { 
        error: innerError.message,
        renter_wallet_deducted: renterWalletDeducted,
        escrow_created: escrowCreated
      });

      // If renter wallet was deducted but escrow creation failed, refund
      if (renterWalletDeducted && !escrowCreated) {
        console.log('Rolling back: refunding renter wallet');
        
        try {
          const { data: rental } = await supabaseServiceClient
            .from('rentals')
            .select('*, item:items(owner_id)')
            .eq('id', rentalId)
            .single();

          if (rental) {
            const totalPrice = Number(rental.total_price);

            // Log rollback in audit
            await supabaseServiceClient
              .from('payment_audit_log')
              .insert({
                rental_id: rentalId,
                user_id: rental.renter_id,
                action: 'escrow_payment_rollback',
                status: 'failed',
                amount: totalPrice,
                details: {
                  reason: 'Escrow creation failed - automatic refund',
                  error: innerError.message
                }
              });

            await supabaseServiceClient.rpc('refund_wallet_balance', {
              p_user_id: rental.renter_id,
              p_amount: totalPrice,
              p_reason: `Escrow payment failed - automatic refund for rental ${rentalId}`
            });

            await logPaymentStep('rollback_completed', { 
              refunded_amount: totalPrice,
              reason: 'Escrow creation failed'
            });
            
            console.log('Rollback successful - renter refunded');
          }
        } catch (rollbackError: any) {
          console.error('CRITICAL: Rollback failed:', rollbackError);
          await logPaymentStep('rollback_failed', { 
            error: 'Rollback failed - MANUAL INTERVENTION REQUIRED',
            rollback_error: rollbackError.message
          });
        }
      }

      // Release lock on error
      await supabaseServiceClient.rpc('release_payment_lock', { p_rental_id: rentalId });
      throw innerError;
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Payment processing failed';
    console.error('Payment error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});