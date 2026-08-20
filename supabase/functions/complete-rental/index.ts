import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/ratelimit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') || 'https://renty.my',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Evidence entries are either legacy public URLs or `rental-evidence/<...>` storage paths.
const evidenceRef = z.string().refine(
  (v) => /^https?:\/\//.test(v) || v.startsWith('rental-evidence/'),
  'Photo must be a URL or rental-evidence storage path'
);

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('complete'),
    rentalId: z.string().uuid(),
    returnPhotos: z.array(evidenceRef).min(1, 'At least 1 return photo required'),
  }),
  z.object({
    action: z.literal('dispute'),
    rentalId: z.string().uuid(),
    returnPhotos: z.array(evidenceRef).min(1, 'At least 1 evidence photo required'),
    disputeReason: z.string().trim().min(10, 'Please describe the issue (min 10 characters)'),
  }),
]);

// State-machine-enforced rental completion / dispute. Replaces the previous
// client-side direct `rentals.update(...)` which let any party flip statuses
// arbitrarily, bypassing payout/dispute side-effects.
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
      action: 'complete-rental',
      maxAttempts: 30,
      windowMinutes: 10,
    });

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.errors[0]?.message || 'Invalid input' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const data = parsed.data;

    const { data: rental, error: rentalError } = await supabase
      .from('rentals')
      .select('id, owner_id, renter_id, status, item:items(title)')
      .eq('id', data.rentalId)
      .single();

    if (rentalError || !rental) throw new Error('Rental not found');

    // Only the owner processes the return.
    if (rental.owner_id !== user.id) {
      throw new Error('Forbidden: Only the owner can process the return');
    }

    // The rental must be in a returnable state.
    if (!['active', 'overdue'].includes(rental.status)) {
      throw new Error(`Rental cannot be processed. Current status: ${rental.status}`);
    }

    if (data.action === 'complete') {
      // Compute late penalty if applicable
      let penalty = 0;
      try {
        const { data: penaltyData } = await supabase.rpc('compute_late_penalty', {
          p_rental_id: data.rentalId,
          p_actual_return_date: new Date().toISOString(),
        });
        penalty = Number(penaltyData) || 0;
      } catch (err) {
        console.error('Late penalty computation error:', err);
      }

      const { data: updated, error: updateError } = await supabase
        .from('rentals')
        .update({ status: 'completed', return_photos: data.returnPhotos })
        .eq('id', data.rentalId)
        .in('status', ['active', 'overdue']) // TOCTOU guard
        .select('id')
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updated) throw new Error('Rental status changed before update. Please refresh.');

      // The create_payout_on_rental_complete trigger creates the owner's payout.

      await supabase.from('notifications').insert({
        user_id: rental.renter_id,
        type: 'rental_approved',
        title: 'Rental Completed',
        message: penalty > 0
          ? `The return of "${rental.item?.title ?? 'your item'}" was confirmed. A late return penalty of RM${penalty} has been applied.`
          : `The return of "${rental.item?.title ?? 'your item'}" was confirmed. Thanks for renting!`,
        link: '/dashboard',
      });

      return new Response(
        JSON.stringify({ success: true, status: 'completed', late_penalty: penalty }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // action === 'dispute'
    const { data: updated, error: updateError } = await supabase
      .from('rentals')
      .update({
        status: 'disputed',
        return_photos: data.returnPhotos,
        dispute_reason: data.disputeReason,
        dispute_status: 'open',
        is_disputed: true,
      })
      .eq('id', data.rentalId)
      .in('status', ['active', 'overdue']) // TOCTOU guard
      .select('id')
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updated) throw new Error('Rental status changed before update. Please refresh.');

    await supabase.from('notifications').insert({
      user_id: rental.renter_id,
      type: 'dispute_opened',
      title: 'Dispute Raised',
      message: `The owner has raised a dispute for "${rental.item?.title ?? 'your item'}". Reason: ${data.disputeReason}`,
      link: '/dashboard',
    });

    return new Response(
      JSON.stringify({ success: true, status: 'disputed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('complete-rental error:', error);
    if (error instanceof RateLimitError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const isExpected = message.startsWith('Unauthorized') || message.startsWith('Forbidden') || message.startsWith('Rental') || message.startsWith('Your account');
    return new Response(
      JSON.stringify({ error: isExpected ? message : 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
