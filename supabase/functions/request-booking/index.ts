import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') || 'https://renty.my',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const bookingSchema = z.object({
  itemId: z.string().uuid(),
  startDate: z.string().regex(DATE_RE, 'startDate must be YYYY-MM-DD'),
  endDate: z.string().regex(DATE_RE, 'endDate must be YYYY-MM-DD'),
  pickupTime: z.string().regex(TIME_RE, 'pickupTime must be HH:MM'),
  returnTime: z.string().regex(TIME_RE, 'returnTime must be HH:MM'),
  renterId: z.string().uuid(),
  ownerId: z.string().uuid(),
  totalPrice: z.number().positive(),
  originalTotalPrice: z.number().positive().optional(),
  discountAmount: z.number().min(0).optional(),
  promoCodeId: z.string().uuid().nullable().optional(),
  agreeToTerms: z.boolean().optional(),
}).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: 'endDate must be on or after startDate' }
).refine(
  (data) => {
    // Same-day rentals are allowed only when the return time is after the pickup time.
    if (data.endDate !== data.startDate) return true;
    const [sh, sm] = data.pickupTime.split(':').map(Number);
    const [eh, em] = data.returnTime.split(':').map(Number);
    return sh * 60 + sm < eh * 60 + em;
  },
  { message: 'returnTime must be later than pickupTime on the same day' }
);

// Calendar days spanned (inclusive) — used for min/max rental day checks and display.
function rentalDays(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(ms / 86400000) + 1;
}

// Exact hours between scheduled pickup and scheduled return (min 1).
function rentalHours(start: string, end: string, pickup: string, ret: string): number {
  const startTs = new Date(`${start}T${pickup}`).getTime();
  const endTs = new Date(`${end}T${ret}`).getTime();
  return Math.max(1, Math.round((endTs - startTs) / 3600000));
}

// Tiered discount must mirror the client (ItemDetail + src/lib/rentalTime.ts).
function discountPercentForHours(hours: number): number {
  if (hours >= 720) return 20; // >= 30 days
  if (hours >= 168) return 10; // >= 7 days
  return 0;
}

// Hybrid day+hour pricing — must mirror the client exactly.
function computeSubtotal(itemData: { price_per_day: number; price_per_hour: number | null }, hours: number): number {
  const fullDays = Math.floor(hours / 24);
  const remHours = hours % 24;
  const dayRate = Number(itemData.price_per_day) || 0;
  const hourRate = Number(itemData.price_per_hour) > 0 ? Number(itemData.price_per_hour) : dayRate / 24;
  return fullDays * dayRate + remHours * hourRate;
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const validationResult = bookingSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('Booking request validation failed:', validationResult.error);
      return new Response(
        JSON.stringify({ error: 'Invalid input parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const { itemId, startDate, endDate, pickupTime, returnTime, renterId, ownerId, totalPrice, originalTotalPrice, discountAmount, promoCodeId, agreeToTerms } = validationResult.data;

    // LEGAL: renter must explicitly accept the Rental Agreement before booking.
    if (!agreeToTerms) {
      throw new Error('You must accept the Rental Agreement to continue');
    }
    
    console.log('Creating rental request:', { itemId, renterId, ownerId, startDate, endDate, totalPrice, originalTotalPrice, discountAmount, promoCodeId });
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Verify user is authenticated AND matches renterId
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Unauthorized: No authorization header');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth verification failed:', authError);
      throw new Error('Unauthorized: Invalid token');
    }
    
    // SECURITY: Ensure the authenticated user matches the renterId
    if (user.id !== renterId) {
      console.error('User mismatch:', { authenticated: user.id, requested: renterId });
      throw new Error('Forbidden: Cannot create booking for another user');
    }

    const { error: suspendError } = await supabase.rpc('check_user_not_suspended', {
      p_user_id: user.id
    });
    if (suspendError) {
      throw new Error('Your account has been suspended. Contact support for assistance.');
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_verified, full_name, verification_level')
      .eq('id', renterId)
      .single();

    if (profileError || !profile?.is_verified) {
      console.error('Renter verification check failed:', profileError);
      throw new Error('Renter must be verified to create booking requests');
    }

    // Fetch the item ONCE: used for owner verification, instant-book check, and
    // authoritative server-side price recomputation (never trust the client's price).
    const { data: itemData, error: itemError } = await supabase
      .from('items')
      .select('price_per_day, price_per_hour, owner_id, minimum_rental_days, maximum_rental_days, title, deposit_amount, category')
      .eq('id', itemId)
      .single();

    if (itemError || !itemData) {
      throw new Error('Item not found');
    }

    if (itemData.owner_id !== ownerId) {
      throw new Error('Owner mismatch');
    }

    const { data: ownerProfile, error: ownerProfileError } = await supabase
      .from('profiles')
      .select('full_name, verification_level')
      .eq('id', ownerId)
      .single();

    if (ownerProfileError || !ownerProfile) {
      throw new Error('Owner not found');
    }

    // Validate rental length constraints (calendar days).
    const days = rentalDays(startDate, endDate);
    if (itemData.minimum_rental_days != null && days < itemData.minimum_rental_days) {
      throw new Error(`Minimum rental period is ${itemData.minimum_rental_days} day(s)`);
    }
    if (itemData.maximum_rental_days != null && days > itemData.maximum_rental_days) {
      throw new Error(`Maximum rental period is ${itemData.maximum_rental_days} day(s)`);
    }

    // Server-side promo code validation with atomic usage increment (prevents TOCTOU)
    let currentPromoUses = 0;
    let promoRow: { discount_amount: number; discount_type: string } | null = null;
    if (promoCodeId) {
      const { data: promoCode, error: promoError } = await supabase
        .from('promo_codes')
        .select('id, discount_amount, discount_type, max_uses, current_uses, valid_until, is_active')
        .eq('id', promoCodeId)
        .single();

      if (promoError || !promoCode) {
        throw new Error('Invalid promo code');
      }

      if (!promoCode.is_active) {
        throw new Error('Promo code is no longer active');
      }

      if (promoCode.valid_until && new Date(promoCode.valid_until) < new Date()) {
        throw new Error('Promo code has expired');
      }

      if (promoCode.max_uses && promoCode.current_uses >= promoCode.max_uses) {
        throw new Error('Promo code has reached maximum usage limit');
      }

      // Check if user has already used this promo code
      const { data: existingUsage } = await supabase
        .from('user_promo_usage')
        .select('id')
        .eq('user_id', renterId)
        .eq('promo_code_id', promoCodeId)
        .maybeSingle();

      if (existingUsage) {
        throw new Error('You have already used this promo code');
      }

      currentPromoUses = promoCode.current_uses;
      promoRow = { discount_amount: promoCode.discount_amount, discount_type: promoCode.discount_type };
    }

    // AUTHORITATIVE price recomputation (mirrors ItemDetail + src/lib/rentalTime.ts).
    // Hybrid pricing: full days at price_per_day, leftover hours at price_per_hour
    // (falls back to price_per_day / 24). Reject any client price that doesn't match.
    const hours = rentalHours(startDate, endDate, pickupTime, returnTime);
    const subtotal = computeSubtotal(itemData, hours);
    const discountPct = discountPercentForHours(hours);
    const durationDiscount = (subtotal * discountPct) / 100;
    const baseTotal = subtotal - durationDiscount;
    const promoDiscount = promoRow
      ? (promoRow.discount_type === 'fixed'
        ? promoRow.discount_amount
        : (baseTotal * promoRow.discount_amount) / 100)
      : 0;
    const expectedTotal = Math.max(0, Math.round((baseTotal - promoDiscount) * 100) / 100);

    if (Math.abs(totalPrice - expectedTotal) > 0.02) {
      console.error('Price mismatch:', { clientPrice: totalPrice, expectedTotal, hours, subtotal, discountPct, promoDiscount });
      throw new Error('Price mismatch. Please refresh and try again.');
    }

    // SOP flow: always create rental as 'requested'; payment happens before owner approval
    const rentalStatus = 'requested';

    // Atomically check overlap and create rental (prevents TOCTOU race condition)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_rental_with_overlap_check', {
      p_item_id: itemId,
      p_renter_id: renterId,
      p_owner_id: ownerId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_total_price: expectedTotal,
      p_status: rentalStatus,
      p_pickup_time: pickupTime,
      p_return_time: returnTime,
    });

    if (rpcError) {
      console.error('Rental creation error:', rpcError);
      throw new Error('Failed to check availability');
    }

    if (!rpcResult.success) {
      throw new Error('Item is not available for the selected dates');
    }
    
    console.log('Rental request created:', rpcResult.rental_id);

    // Gap #9: Enforce risk-based actions (risk_level set by BEFORE INSERT trigger)
    const { data: riskCheck } = await supabase
      .from('rentals')
      .select('risk_level')
      .eq('id', rpcResult.rental_id)
      .single();

    if (riskCheck?.risk_level === 'high') {
      await supabase.from('rentals').delete().eq('id', rpcResult.rental_id);
      if (promoCodeId) {
        await supabase.rpc('restore_promo_usage', { p_promo_id: promoCodeId });
      }
      throw new Error('This booking has been flagged for manual review due to risk assessment. Please contact support.');
    }

    if (riskCheck?.risk_level === 'medium') {
      await supabase.from('notifications').insert({
        user_id: ownerId,
        type: 'rental_request',
        title: 'Risk Review Required',
        message: 'This booking is flagged as medium risk. Additional verification may be required before payment.',
        link: '/my-listings'
      });
    }

    // Pickup code is generated on owner confirmation (after payment), not here.

    // LEGAL: record renter acceptance of the Rental Agreement (server-side snapshot,
    // name comes from the DB profile so the client cannot spoof who accepted).
    const { error: agreementError } = await supabase.from('rental_agreements').insert({
      rental_id: rpcResult.rental_id,
      terms_version: '1',
      content: {
        itemTitle: itemData.title,
        category: itemData.category,
        deposit: itemData.deposit_amount ?? 0,
        pricePerDay: Number(itemData.price_per_day),
        pricePerHour: Number(itemData.price_per_hour) > 0 ? Number(itemData.price_per_hour) : Number(itemData.price_per_day) / 24,
        ownerId,
        ownerName: ownerProfile.full_name,
        ownerVerificationLevel: ownerProfile.verification_level,
        renterId,
        renterName: profile.full_name,
        renterVerificationLevel: profile.verification_level,
        startDate,
        endDate,
        pickupTime,
        returnTime,
        days,
        totalHours: hours,
        totalPrice: expectedTotal,
        originalTotalPrice: originalTotalPrice ?? null,
        discountAmount: discountAmount ?? 0,
      },
      renter_accepted_at: new Date().toISOString(),
      renter_full_name: profile.full_name,
    });

    if (agreementError) {
      console.error('Rental agreement insert error:', agreementError);
      await supabase.from('rentals').delete().eq('id', rpcResult.rental_id);
      if (promoCodeId) {
        await supabase.rpc('restore_promo_usage', { p_promo_id: promoCodeId });
      }
      throw new Error('Failed to record agreement. Please try again.');
    }

    // Atomically increment promo code usage (compare-and-swap — TOCTOU prevention)
    if (promoCodeId) {
      const { data: updatedPromo } = await supabase
        .from('promo_codes')
        .update({ current_uses: currentPromoUses + 1 })
        .eq('id', promoCodeId)
        .eq('current_uses', currentPromoUses)
        .select('id')
        .maybeSingle();

      if (!updatedPromo) {
        await supabase.from('rentals').delete().eq('id', rpcResult.rental_id);
        throw new Error('Promo code usage limit reached. Please try again.');
      }
    }

    // Store promo info on the rental for payment flow
    if (promoCodeId || originalTotalPrice) {
      await supabase
        .from('rentals')
        .update({
          original_total_price: originalTotalPrice,
          discount_amount: discountAmount || 0,
          promo_code_id: promoCodeId,
        })
        .eq('id', rpcResult.rental_id);
    }

    await supabase.from('payment_flow_logs').insert({
      rental_id: rpcResult.rental_id,
      stage: 'rental_requested',
      status: 'success',
      details: { itemId, renterId, ownerId, startDate, endDate, totalPrice, originalTotalPrice, discountAmount, promoCodeId }
    });

    await supabase.from('notifications').insert({
      user_id: ownerId,
      type: 'rental_request',
      title: 'New Booking Request',
      message: 'You have a new booking request for your item. Awaiting payment from renter.',
      link: `/my-listings`
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        rentalId: rpcResult.rental_id,
        status: rentalStatus,
        message: 'Booking request sent successfully. Proceed to payment.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Booking request error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    
    let status = 500;
    if (message.startsWith('Unauthorized')) status = 401;
    else if (message.startsWith('Forbidden') || message.startsWith('Your account') || message.startsWith('Renter must')) status = 403;
    else if (message.startsWith('Item is not') || message.startsWith('Failed to check') || message.startsWith('Price mismatch')) status = 409;
    else if (message.startsWith('Owner mismatch') || message.startsWith('Item not found')) status = 404;
    else if (message.startsWith('Minimum rental') || message.startsWith('Maximum rental') || message.startsWith('Invalid promo') || message.startsWith('Promo code') || message.startsWith('You have already') || message.startsWith('You must accept')) status = 400;

    return new Response(
      JSON.stringify({ error: status === 500 ? 'An unexpected error occurred. Please try again.' : message }),
      { 
        status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});