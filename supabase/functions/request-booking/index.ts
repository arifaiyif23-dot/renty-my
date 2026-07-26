import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') || 'https://renty.my',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const bookingSchema = z.object({
  itemId: z.string().uuid(),
  startDate: z.string().regex(DATE_RE, 'startDate must be YYYY-MM-DD'),
  endDate: z.string().regex(DATE_RE, 'endDate must be YYYY-MM-DD'),
  renterId: z.string().uuid(),
  ownerId: z.string().uuid(),
  totalPrice: z.number().positive(),
  originalTotalPrice: z.number().positive().optional(),
  discountAmount: z.number().min(0).optional(),
  promoCodeId: z.string().uuid().nullable().optional(),
  instantBook: z.boolean().optional().default(false),
}).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: 'endDate must be on or after startDate' }
);

// Compute days inclusively (matches client: differenceInDays(to, from) + 1).
function rentalDays(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(ms / 86400000) + 1;
}

// Tiered discount must mirror the client (ItemDetail.getDiscountPercent).
function discountPercentForDays(days: number): number {
  if (days >= 30) return 20;
  if (days >= 7) return 10;
  return 0;
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
    const { itemId, startDate, endDate, renterId, ownerId, totalPrice, originalTotalPrice, discountAmount, promoCodeId, instantBook } = validationResult.data;
    
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
      .select('is_verified')
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
      .select('price_per_day, owner_id, instant_book_enabled, minimum_rental_days, maximum_rental_days')
      .eq('id', itemId)
      .single();

    if (itemError || !itemData) {
      throw new Error('Item not found');
    }

    if (itemData.owner_id !== ownerId) {
      throw new Error('Owner mismatch');
    }

    // Validate rental length constraints.
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

    // AUTHORITATIVE price recomputation (mirrors ItemDetail.getPriceBreakdown +
    // getTotalAfterPromo). Reject any client price that doesn't match.
    const subtotal = days * itemData.price_per_day;
    const discountPct = discountPercentForDays(days);
    const durationDiscount = (subtotal * discountPct) / 100;
    const baseTotal = subtotal - durationDiscount;
    const promoDiscount = promoRow
      ? (promoRow.discount_type === 'fixed'
        ? promoRow.discount_amount
        : (baseTotal * promoRow.discount_amount) / 100)
      : 0;
    const expectedTotal = Math.max(0, Math.round((baseTotal - promoDiscount) * 100) / 100);

    if (Math.abs(totalPrice - expectedTotal) > 0.02) {
      console.error('Price mismatch:', { clientPrice: totalPrice, expectedTotal, days, subtotal, discountPct, promoDiscount });
      throw new Error('Price mismatch. Please refresh and try again.');
    }

    // Determine rental status
    let rentalStatus = 'pending_approval';
    if (instantBook) {
      if (!itemData.instant_book_enabled) {
        throw new Error('Instant booking is not available for this item');
      }
      rentalStatus = 'approved';
    }

    // Atomically check overlap and create rental (prevents TOCTOU race condition)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_rental_with_overlap_check', {
      p_item_id: itemId,
      p_renter_id: renterId,
      p_owner_id: ownerId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_total_price: expectedTotal,
      p_status: rentalStatus,
    });

    if (rpcError) {
      console.error('Rental creation error:', rpcError);
      throw new Error('Failed to check availability');
    }

    if (!rpcResult.success) {
      throw new Error('Item is not available for the selected dates');
    }
    
    console.log('Rental request created:', rpcResult.rental_id);

    // Generate pickup code for instant bookings (regular bookings get it on owner approval)
    if (instantBook) {
      const pickupCode = Math.floor(1000 + Math.random() * 9000).toString();
      await supabase
        .from('rentals')
        .update({ pickup_code: pickupCode })
        .eq('id', rpcResult.rental_id);
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
      details: { itemId, renterId, ownerId, startDate, endDate, totalPrice, originalTotalPrice, discountAmount, promoCodeId, instantBook }
    });

    if (instantBook) {
      await supabase.from('notifications').insert({
        user_id: ownerId,
        type: 'rental_approved',
        title: 'New Instant Booking',
        message: 'A renter has instantly booked your item. Check your dashboard for details.',
        link: `/my-listings`
      });
    } else {
      await supabase.from('notifications').insert({
        user_id: ownerId,
        type: 'rental_request',
        title: 'New Booking Request',
        message: 'You have a new booking request for your item',
        link: `/my-listings`
      });
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        rentalId: rpcResult.rental_id,
        status: rentalStatus,
        message: instantBook ? 'Instant booking confirmed' : 'Booking request sent successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Booking request error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const isExpected = message.startsWith('Unauthorized') || message.startsWith('Forbidden') || message.startsWith('Your account') || message.startsWith('Renter must') || message.startsWith('Item is not') || message.startsWith('Failed to check') || message.startsWith('Price mismatch') || message.startsWith('Minimum rental') || message.startsWith('Maximum rental') || message.startsWith('Owner mismatch') || message.startsWith('Item not found') || message.startsWith('Instant booking') || message.startsWith('Invalid promo') || message.startsWith('Promo code') || message.startsWith('You have already');
    return new Response(
      JSON.stringify({ error: isExpected ? message : 'An unexpected error occurred. Please try again.' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});