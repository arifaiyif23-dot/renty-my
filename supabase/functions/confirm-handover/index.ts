import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceRateLimit, RateLimitError } from "../_shared/ratelimit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') || 'https://renty.my',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized: No authorization header');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized: Invalid token');

    const { error: suspendError } = await supabase.rpc('check_user_not_suspended', { p_user_id: user.id });
    if (suspendError) throw new Error('Your account has been suspended. Contact support for assistance.');

    await enforceRateLimit(supabase, {
      userId: user.id,
      action: 'confirm-handover',
      maxAttempts: 30,
      windowMinutes: 10,
    });

    const body = await req.json();
    const { action, rentalId } = body;

    if (!action || !rentalId) {
      return new Response(
        JSON.stringify({ error: 'action and rentalId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: rental, error: rentalError } = await supabase
      .from('rentals')
      .select('id, owner_id, renter_id, status, pickup_code, start_date')
      .eq('id', rentalId)
      .single();

    if (rentalError || !rental) throw new Error('Rental not found');

    // Action: confirm handover (owner only)
    if (action === 'confirm') {
      if (rental.owner_id !== user.id) {
        throw new Error('Forbidden: Only the item owner can confirm handover');
      }

      if (rental.status !== 'confirmed') {
        throw new Error(`Rental cannot be handed over. Current status: ${rental.status}`);
      }

      const { handoverPhotos, pickupCode } = body;
      if (!handoverPhotos || !Array.isArray(handoverPhotos) || handoverPhotos.length === 0) {
        return new Response(
          JSON.stringify({ error: 'At least 1 handover photo required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!pickupCode || typeof pickupCode !== 'string' || pickupCode.length !== 4) {
        return new Response(
          JSON.stringify({ error: 'Valid 4-digit pickup code required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (rental.pickup_code !== pickupCode) {
        return new Response(
          JSON.stringify({ error: 'Invalid pickup code' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: updated, error: updateError } = await supabase
        .from('rentals')
        .update({
          status: 'active',
          actual_start_at: new Date().toISOString(),
          handover_photos: handoverPhotos,
        })
        .eq('id', rentalId)
        .eq('status', 'confirmed')
        .select('id')
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updated) throw new Error('Rental status changed before update. Please refresh.');

      await supabase.from('notifications').insert({
        user_id: rental.renter_id,
        type: 'rental_approved',
        title: 'Rental Started',
        message: 'Your rental period has begun. Enjoy the item!',
        link: `/dashboard`,
      });

      return new Response(
        JSON.stringify({ success: true, status: 'active' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: report vendor no-show (renter only, after start_date passed)
    if (action === 'report_no_show') {
      if (rental.renter_id !== user.id) {
        throw new Error('Forbidden: Only the renter can report vendor no-show');
      }

      if (rental.status !== 'confirmed') {
        throw new Error(`Rental cannot be cancelled. Current status: ${rental.status}`);
      }

      if (new Date(rental.start_date) > new Date()) {
        throw new Error('Start date has not passed yet. Please wait until the rental start date.');
      }

      const { data: rpcResult, error: rpcError } = await supabase.rpc('report_vendor_no_show', {
        p_rental_id: rentalId,
        p_renter_id: user.id,
      });

      if (rpcError) throw rpcError;
      if (!rpcResult?.success) throw new Error(rpcResult?.error || 'Failed to report vendor no-show');

      await supabase.from('notifications').insert({
        user_id: rental.renter_id,
        type: 'rental_request',
        title: 'Rental Cancelled',
        message: 'The vendor did not show up for handover. Your rental has been cancelled and a full refund will be processed.',
        link: `/dashboard`,
      });

      await supabase.from('notifications').insert({
        user_id: rental.owner_id,
        type: 'rental_request',
        title: 'Vendor No-Show Reported',
        message: 'The renter reported that you did not show up for handover. This affects your trust score.',
        link: `/dashboard`,
      });

      return new Response(
        JSON.stringify({ success: true, status: 'cancelled', reason: 'vendor_no_show' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Supported: confirm, report_no_show' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('confirm-handover error:', error);
    if (error instanceof RateLimitError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const isExpected = message.startsWith('Unauthorized') || message.startsWith('Forbidden') || message.startsWith('Rental') || message.startsWith('Your account') || message.startsWith('Invalid');
    return new Response(
      JSON.stringify({ error: isExpected ? message : 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
