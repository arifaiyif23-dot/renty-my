import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') || 'https://renty.my',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resolutionSchema = z.object({
  rentalId: z.string().uuid(),
  resolutionType: z.enum(['full_refund', 'full_release', 'partial_split', 'custom']),
  resolutionNotes: z.string().min(10),
  ownerPercentage: z.number().min(0).max(100).optional(),
  renterPercentage: z.number().min(0).max(100).optional(),
  customAmount: z.number().positive().optional()
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

    // Verify admin access via direct DB query (avoids fragile functions.invoke call)
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

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'super_admin'])
      .maybeSingle();

    if (roleError || !roleData) {
      throw new Error('Admin access required');
    }

    const body = await req.json();
    const validatedData = resolutionSchema.parse(body);

    console.log('Resolving dispute for rental:', validatedData.rentalId);

    // Get rental details with dispute info and linked payment
    const { data: rental, error: rentalError } = await supabaseAdmin
      .from('rentals')
      .select(`
        id, owner_id, renter_id, total_price,
        dispute_reason, dispute_status, is_disputed,
        payment:payments(
          id, total_amount, rental_amount, platform_fee, status
        )
      `)
      .eq('id', validatedData.rentalId)
      .single();

    if (rentalError || !rental) {
      throw new Error('Dispute not found');
    }

    if (!rental.is_disputed || rental.dispute_status === 'resolved') {
      throw new Error('Dispute already resolved');
    }

    // payment is a one-to-many relation; use the first (paid) payment row.
    const payment = Array.isArray(rental.payment) ? rental.payment[0] : rental.payment;
    if (!payment) {
      throw new Error('No payment found for this dispute');
    }

    if (payment.status !== 'paid') {
      throw new Error('Payment is not in a resolvable state');
    }

    const totalAmount = payment.total_amount || rental.total_price || 0;

    let ownerAmount = 0;
    let renterAmount = 0;
    let resolutionSplit = {};

    // Calculate amounts based on resolution type
    switch (validatedData.resolutionType) {
      case 'full_refund':
        renterAmount = totalAmount;
        resolutionSplit = { owner: 0, renter: 1 };
        break;

      case 'full_release':
        ownerAmount = totalAmount;
        resolutionSplit = { owner: 1, renter: 0 };
        break;

      case 'partial_split':
        if (validatedData.ownerPercentage == null || validatedData.renterPercentage == null) {
          throw new Error('Percentages required for partial split');
        }
        if (validatedData.ownerPercentage + validatedData.renterPercentage !== 100) {
          throw new Error('Percentages must sum to 100');
        }
        // Round to cents and derive renter from owner to guarantee conservation.
        ownerAmount = Math.round((totalAmount * validatedData.ownerPercentage) / 100) / 100;
        renterAmount = Math.round((totalAmount - ownerAmount) * 100) / 100;
        resolutionSplit = {
          owner: validatedData.ownerPercentage / 100,
          renter: validatedData.renterPercentage / 100
        };
        break;

      case 'custom':
        if (validatedData.customAmount == null) {
          throw new Error('Custom amount required');
        }
        renterAmount = Math.round(validatedData.customAmount * 100) / 100;
        ownerAmount = Math.round((totalAmount - renterAmount) * 100) / 100;
        if (renterAmount > totalAmount) {
          throw new Error('Custom amount exceeds total payment');
        }
        if (ownerAmount < 0) {
          throw new Error('Custom amount exceeds total payment');
        }
        resolutionSplit = {
          owner: totalAmount > 0 ? ownerAmount / totalAmount : 0,
          renter: totalAmount > 0 ? renterAmount / totalAmount : 0
        };
        break;
    }

    console.log('Resolution amounts:', { ownerAmount, renterAmount });

    // Update payment status — guarded so a concurrent resolution can't regress it.
    const paymentStatus = renterAmount > 0 ? 'refunded' : 'released';
    const { data: updatedPayment, error: paymentUpdateError } = await supabaseAdmin
      .from('payments')
      .update({
        status: paymentStatus,
        refunded_at: renterAmount > 0 ? new Date().toISOString() : null,
      })
      .eq('id', payment.id)
      .eq('status', 'paid')
      .select('id')
      .maybeSingle();

    if (paymentUpdateError) {
      console.error('Payment update error:', paymentUpdateError);
      throw new Error('Failed to update payment');
    }
    if (!updatedPayment) {
      throw new Error('Dispute already resolved');
    }

    // Update rental resolution (using existing dispute columns on rentals table)
    await supabaseAdmin
      .from('rentals')
      .update({
        dispute_status: renterAmount > 0 ? 'resolved_refund' : 'resolved_payout',
        dispute_reason: `[Resolved by admin ${user.id}] ${validatedData.resolutionNotes}. Split: ${JSON.stringify(resolutionSplit)}`,
      })
      .eq('id', validatedData.rentalId);

    // Update rental status
    const rentalStatus = renterAmount > 0 ? 'cancelled' : 'completed';
    await supabaseAdmin
      .from('rentals')
      .update({ status: rentalStatus })
      .eq('id', validatedData.rentalId);

    // REFUND: there is no live ToyyibPay money movement here, so record a pending
    // refund payout for the renter. Ops processes it manually from AdminPayouts.
    // This makes the refund real and auditable instead of a DB-only flag.
    if (renterAmount > 0) {
      const { error: refundError } = await supabaseAdmin
        .from('payouts')
        .insert({
          owner_id: rental.renter_id, // recipient of the refund
          payment_id: payment.id,
          rental_id: rental.id,
          rental_amount: 0,
          platform_fee: 0,
          payout_amount: renterAmount,
          status: 'pending',
          held_reason: `Dispute refund (${validatedData.resolutionType})`,
        });

      if (refundError) {
        console.error('Refund payout insert error:', refundError);
        // Non-fatal: payment/rental already updated; log for ops to reconcile.
        await supabaseAdmin.from('payment_flow_logs').insert({
          payment_id: payment.id,
          rental_id: rental.id,
          stage: 'refund_payout_created',
          status: 'error',
          details: { error: refundError.message, renterAmount }
        });
      } else {
        await supabaseAdmin.from('payment_flow_logs').insert({
          payment_id: payment.id,
          rental_id: rental.id,
          stage: 'refund_payout_created',
          status: 'success',
          details: { renterAmount }
        });
      }
    }

    // Send notifications
    await supabaseAdmin.from('notifications').insert([
      {
        user_id: rental.owner_id,
        type: 'payment_received',
        title: 'Dispute Resolved',
        message: ownerAmount > 0
          ? `Dispute resolved. RM ${ownerAmount.toFixed(2)} released to you.`
          : 'Dispute resolved in favor of renter.',
        link: `/rentals/${rental.id}`
      },
      {
        user_id: rental.renter_id,
        type: 'payment_received',
        title: 'Dispute Resolved',
        message: renterAmount > 0
          ? `Dispute resolved. A refund of RM ${renterAmount.toFixed(2)} has been approved and will be processed within 3-5 business days.`
          : 'Dispute resolved in favor of owner.',
        link: `/rentals/${rental.id}`
      }
    ]);

    console.log('Dispute resolved successfully');

    return new Response(
      JSON.stringify({
        success: true,
        resolution: {
          rentalId: validatedData.rentalId,
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
    const isExpected = errorMessage === 'Unauthorized' || errorMessage === 'Admin access required' || errorMessage.includes('not found') || errorMessage.includes('already');
    const status = errorMessage === 'Unauthorized' ? 401
      : errorMessage === 'Admin access required' ? 403
      : errorMessage.includes('not found') ? 404
      : 400;
    return new Response(
      JSON.stringify({ success: false, error: isExpected ? errorMessage : 'An unexpected error occurred. Please try again.' }),
      {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
