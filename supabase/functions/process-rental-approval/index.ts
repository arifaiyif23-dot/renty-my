/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') || 'https://renty.my',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rentalId, action } = await req.json(); // action: 'approve' or 'reject'
    
    console.log('Processing rental approval:', { rentalId, action });
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header for user verification
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      throw new Error('Unauthorized: No authorization header');
    }

    // Extract token from Bearer header
    const token = authHeader.replace('Bearer ', '');
    
    // Verify user from token using service role client
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    console.log('User verification result:', { userId: user?.id, error: userError?.message });
    
    if (userError || !user) {
      console.error('User verification failed:', userError);
      throw new Error('Unauthorized: Invalid user token');
    }

    // Check if user is suspended
    const { error: suspendError } = await supabase.rpc('check_user_not_suspended', {
      p_user_id: user.id
    });
    if (suspendError) {
      throw new Error('Your account has been suspended. Contact support for assistance.');
    }

    // Get rental details
    const { data: rental, error: rentalError } = await supabase
      .from('rentals')
      .select('*, item:items(title), renter:profiles!rentals_renter_id_fkey(full_name), owner:profiles!rentals_owner_id_fkey(full_name), payments:payments(id, total_amount, rental_amount, platform_fee, status)')
      .eq('id', rentalId)
      .single();

    if (rentalError || !rental) {
      console.error('Rental fetch error:', rentalError);
      throw new Error('Rental not found');
    }

    console.log('Rental found:', { id: rental.id, owner_id: rental.owner_id, status: rental.status });

    // Verify user is the owner
    if (rental.owner_id !== user.id) {
      console.error('Owner mismatch:', { rentalOwner: rental.owner_id, currentUser: user.id });
      throw new Error('Unauthorized: Only the owner can approve/reject rentals');
    }

    // Verify rental is in reserved status (payment complete, awaiting owner confirmation)
    if (rental.status !== 'reserved') {
      throw new Error(`Rental cannot be ${action}ed. Current status: ${rental.status}`);
    }

    // CRITICAL: Re-validate availability before confirming. Another overlapping
    // booking may have been confirmed after this one's payment was verified.
    if (action === 'approve') {
      const { data: conflicts, error: conflictError } = await supabase
        .from('rentals')
        .select('id')
        .eq('item_id', rental.item_id)
        .neq('id', rentalId)
        .in('status', ['confirmed', 'reserved', 'active'])
        .lte('start_date', rental.end_date)
        .gte('end_date', rental.start_date)
        .limit(1);

      if (conflictError) {
        console.error('Overlap re-check error:', conflictError);
        throw new Error('Failed to verify availability');
      }

      if (conflicts && conflicts.length > 0) {
        throw new Error('Another booking already occupies these dates. Please reject this request.');
      }
    }

    const newStatus = action === 'approve' ? 'confirmed' : 'cancelled';

    // LEGAL: the owner can only approve a rental whose agreement exists (renter already
    // accepted at booking). Approving is the owner's acceptance of the agreement.
    if (action === 'approve') {
      const { data: agreement, error: agreementError } = await supabase
        .from('rental_agreements')
        .select('id')
        .eq('rental_id', rentalId)
        .maybeSingle();

      if (agreementError) {
        throw new Error('Failed to verify agreement');
      }
      if (!agreement) {
        throw new Error('Rental agreement not found. Cannot approve without a signed agreement.');
      }
    }

    // Generate 4-digit pickup code if confirming
    let pickupCode = null;
    if (action === 'approve') {
      pickupCode = Math.floor(1000 + Math.random() * 9000).toString();
    }

    // Update rental status and pickup code — atomic with status guard (TOCTOU prevention)
    const updateData: any = { status: newStatus };
    if (pickupCode) {
      updateData.pickup_code = pickupCode;
    }

    const { data: updatedRental, error: updateError } = await supabase
      .from('rentals')
      .update(updateData)
      .eq('id', rentalId)
      .eq('status', 'reserved')
      .select('id, status')
      .maybeSingle();

    if (updateError) {
      console.error('Rental update error:', updateError);
      throw updateError;
    }

    if (!updatedRental) {
      throw new Error(`Rental status changed before update. Current status is no longer 'reserved'.`);
    }

    console.log(`Rental ${action}ed:`, rentalId);

    // LEGAL: record the owner's acceptance on the agreement (approval = acceptance).
    if (action === 'approve') {
      const { error: agreementUpdateError } = await supabase
        .from('rental_agreements')
        .update({
          owner_accepted_at: new Date().toISOString(),
          owner_full_name: rental.owner?.full_name || null,
        })
        .eq('rental_id', rentalId);

      if (agreementUpdateError) {
        console.error('Agreement owner acceptance error:', agreementUpdateError);
      }
    }

    // Log the approval/rejection
    await supabase.from('payment_flow_logs').insert({
      rental_id: rentalId,
      stage: `rental_${action}ed`,
      status: 'success',
      details: { ownerId: user.id, action, timestamp: new Date().toISOString() }
    });

    // If rejecting a reserved (paid) booking, create a refund payout for the renter
    if (action === 'reject') {
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
            held_reason: 'Owner rejected booking (reserved→cancelled)',
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

    // Create notification for renter
    const notificationMessage = action === 'approve' 
      ? `Your booking for "${rental.item.title}" has been confirmed! Show the pickup code at handover.`
      : `Your booking for "${rental.item.title}" has been declined by the owner. A refund will be processed.`;

    await supabase.from('notifications').insert({
      user_id: rental.renter_id,
      type: action === 'approve' ? 'rental_approved' : 'rental_rejected',
      title: action === 'approve' ? 'Booking Confirmed' : 'Booking Declined',
      message: notificationMessage,
      link: '/dashboard'
    });

    return new Response(
      JSON.stringify({
        success: true,
        rentalId,
        status: newStatus,
        pickupCode: pickupCode || undefined,
        message: action === 'approve' 
          ? 'Booking confirmed successfully. Pickup code generated.'
          : 'Booking declined. Refund will be processed.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Rental approval processing error:', error);
    const message = error instanceof Error ? error.message : 'An error occurred while processing the rental';
    const isExpected = message.startsWith('Unauthorized') || message.startsWith('Rental') || message.startsWith('Your account') || message.startsWith('Another approved');
    return new Response(
      JSON.stringify({ error: isExpected ? message : 'An unexpected error occurred. Please try again.' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
