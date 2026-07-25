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

    const payment = rental.payment;
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
        if (!validatedData.ownerPercentage || !validatedData.renterPercentage) {
          throw new Error('Percentages required for partial split');
        }
        if (validatedData.ownerPercentage + validatedData.renterPercentage !== 100) {
          throw new Error('Percentages must sum to 100');
        }
        ownerAmount = (totalAmount * validatedData.ownerPercentage) / 100;
        renterAmount = (totalAmount * validatedData.renterPercentage) / 100;
        resolutionSplit = {
          owner: validatedData.ownerPercentage / 100,
          renter: validatedData.renterPercentage / 100
        };
        break;

      case 'custom':
        if (!validatedData.customAmount) {
          throw new Error('Custom amount required');
        }
        renterAmount = validatedData.customAmount;
        ownerAmount = totalAmount - validatedData.customAmount;
        if (ownerAmount < 0) {
          throw new Error('Custom amount exceeds total payment');
        }
        resolutionSplit = {
          owner: ownerAmount / totalAmount,
          renter: renterAmount / totalAmount
        };
        break;
    }

    console.log('Resolution amounts:', { ownerAmount, renterAmount });

    // Update payment status
    const paymentStatus = renterAmount > 0 ? 'refunded' : 'released';
    await supabaseAdmin
      .from('payments')
      .update({
        status: paymentStatus,
        refunded_at: renterAmount > 0 ? new Date().toISOString() : null,
      })
      .eq('id', payment.id);

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
          ? `Dispute resolved. RM ${renterAmount.toFixed(2)} refunded.`
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
