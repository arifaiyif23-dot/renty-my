import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') || 'https://renty.my',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const bookingSchema = z.object({
  itemId: z.string().uuid(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  renterId: z.string().uuid(),
  ownerId: z.string().uuid(),
  totalPrice: z.number().positive(),
  originalTotalPrice: z.number().positive().optional(),
  discountAmount: z.number().min(0).optional(),
  promoCodeId: z.string().uuid().nullable().optional(),
  instantBook: z.boolean().optional().default(false),
});

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

    // Server-side promo code validation
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
    }

    // Determine rental status
    let rentalStatus = 'pending_approval';
    if (instantBook) {
      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .select('instant_book_enabled, owner_id')
        .eq('id', itemId)
        .single();

      if (itemError || !itemData) {
        throw new Error('Item not found');
      }

      if (!itemData.instant_book_enabled) {
        throw new Error('Instant booking is not available for this item');
      }

      if (itemData.owner_id !== ownerId) {
        throw new Error('Owner mismatch');
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
      p_total_price: totalPrice,
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
    const isExpected = message.startsWith('Unauthorized') || message.startsWith('Forbidden') || message.startsWith('Your account') || message.startsWith('Renter must') || message.startsWith('Item is not') || message.startsWith('Failed to check');
    return new Response(
      JSON.stringify({ error: isExpected ? message : 'An unexpected error occurred. Please try again.' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});