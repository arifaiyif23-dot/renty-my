import { serve } from "std/http/server";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') || 'https://renty.my',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rentalId } = await req.json();
    console.log('Cancel booking:', { rentalId });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized: No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized: Invalid user token');

    const { error: suspendError } = await supabase.rpc('check_user_not_suspended', { p_user_id: user.id });
    if (suspendError) throw new Error('Your account has been suspended. Contact support for assistance.');

    const { data: rental, error: rentalError } = await supabase
      .from('rentals')
      .select('*, item:items(title), payments:payments(id, total_amount, status)')
      .eq('id', rentalId)
      .single();

    if (rentalError || !rental) throw new Error('Rental not found');

    if (rental.renter_id !== user.id) {
      throw new Error('Unauthorized: Only the renter can cancel this booking');
    }

    if (!['requested', 'payment_pending', 'reserved'].includes(rental.status)) {
      throw new Error(`Booking cannot be cancelled in its current status: ${rental.status}`);
    }

    const { data: updatedRental, error: updateError } = await supabase
      .from('rentals')
      .update({ status: 'cancelled' })
      .eq('id', rentalId)
      .in('status', ['requested', 'payment_pending', 'reserved'])
      .select('id, status')
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updatedRental) throw new Error('Booking status changed before update. Please try again.');

    console.log('Booking cancelled:', rentalId);

    await supabase.from('payment_flow_logs').insert({
      rental_id: rentalId,
      stage: 'rental_cancelled_by_renter',
      status: 'success',
      details: { renterId: user.id, timestamp: new Date().toISOString() }
    });

    // If payment was made (reserved), create refund payout
    if (rental.status === 'reserved') {
      const payments = Array.isArray(rental.payments) ? rental.payments : [];
      const paidPayment = payments.find((p: Record<string, unknown>) => p.status === 'paid');
      if (paidPayment) {
        const refundAmount = Math.round(Number(paidPayment.total_amount) * 100) / 100;
        const { error: refundError } = await supabase
          .from('payouts')
          .insert({
            owner_id: rental.renter_id,
            payment_id: paidPayment.id,
            rental_id: rental.id,
            rental_amount: 0,
            platform_fee: 0,
            payout_amount: refundAmount,
            status: 'pending',
            held_reason: 'Renter cancelled booking (reserved→cancelled)',
          });

        if (refundError) {
          console.error('Refund payout insert error:', refundError);
          await supabase.from('payment_flow_logs').insert({
            rental_id: rentalId,
            stage: 'refund_payout_created',
            status: 'error',
            details: { error: refundError.message, refundAmount }
          });
        } else {
          await supabase.from('payment_flow_logs').insert({
            rental_id: rentalId,
            stage: 'refund_payout_created',
            status: 'success',
            details: { refundAmount }
          });
        }
      }
    }

    await supabase.from('notifications').insert({
      user_id: rental.owner_id,
      type: 'rental_cancelled',
      title: 'Booking Cancelled',
      message: `Booking for "${rental.item.title}" has been cancelled by the renter.`,
      link: '/dashboard'
    });

    return new Response(
      JSON.stringify({ success: true, rentalId, status: 'cancelled' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Cancel booking error:', error);
    const message = error instanceof Error ? error.message : 'An error occurred while cancelling the booking';
    const isExpected = message.startsWith('Unauthorized') || message.startsWith('Booking') || message.startsWith('Your account');
    return new Response(
      JSON.stringify({ error: isExpected ? message : 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
