import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') || 'https://renty.my',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const createPaymentSchema = z.object({
  rentalId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  renterId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  totalPrice: z.number().positive().optional(),
  promoCodeId: z.string().uuid().nullable().optional(),
  discountAmount: z.number().min(0).optional(),
  originalAmount: z.number().positive().optional(),
  idempotencyKey: z.string().uuid().optional(),
}).refine(
  (data) => data.rentalId || (data.itemId && data.startDate && data.endDate && data.renterId && data.ownerId && data.totalPrice != null),
  { message: 'Provide either rentalId (for existing rental) or all fields: itemId, startDate, endDate, renterId, ownerId, totalPrice' }
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let rental: { id: string; total_price: number; start_date: string; end_date: string; promo_code_id?: string | null; discount_amount?: number | null; original_total_price?: number | null } | undefined;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Unauthorized: No authorization header');
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized: Invalid token');
    }

    const { error: suspendError } = await supabase.rpc('check_user_not_suspended', {
      p_user_id: user.id
    });
    if (suspendError) {
      throw new Error('Your account has been suspended. Contact support for assistance.');
    }
    
    const body = await req.json();
    const validationResult = createPaymentSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('Payment creation validation failed:', validationResult.error);
      return new Response(
        JSON.stringify({ error: 'Invalid input parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const { rentalId, itemId, startDate, endDate, renterId, ownerId, totalPrice, promoCodeId, discountAmount, originalAmount, idempotencyKey } = validationResult.data;
    
    // The legacy "create rental + payment in one call" flow trusted client-supplied
    // totalPrice/renterId/ownerId without verification. It has been removed; the
    // frontend always creates the rental via request-booking first, so a rentalId
    // is mandatory here.
    if (!rentalId) {
      return new Response(
        JSON.stringify({ error: 'rentalId is required. Create a booking first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing payment for existing approved rental:', rentalId);

    const { data: existingRental, error: fetchError } = await supabase
      .from('rentals')
      .select('*')
      .eq('id', rentalId)
      .single();

    if (fetchError || !existingRental) {
      throw new Error('Rental not found');
    }

    if (existingRental.status !== 'approved') {
      throw new Error(`Rental must be approved before payment. Current status: ${existingRental.status}`);
    }

    if (existingRental.renter_id !== user.id) {
      throw new Error('Forbidden: You can only create payments for your own rentals');
    }

    rental = existingRental;
    
    console.log('Creating payment for rental:', rental.id);

    // Server-side promo code re-validation
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

      const { data: existingUsage } = await supabase
        .from('user_promo_usage')
        .select('id')
        .eq('user_id', user.id)
        .eq('promo_code_id', promoCodeId)
        .maybeSingle();

      if (existingUsage) {
        throw new Error('You have already used this promo code');
      }
    }

    // Acquire payment lock to prevent race conditions
    const { data: acquired } = await supabase.rpc('acquire_payment_lock', {
      p_rental_id: rental.id,
      p_user_id: user.id
    });
    
    if (!acquired) {
      throw new Error('Payment is already being processed for this rental');
    }

    // Idempotency check: if idempotencyKey provided, return existing payment data
    if (idempotencyKey) {
      const { data: existingByIdempotency } = await supabase
        .from('payments')
        .select('id, status, toyyibpay_bill_url')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existingByIdempotency) {
        if (existingByIdempotency.status === 'paid') {
          // Already paid — release lock and return success
          await supabase.rpc('release_payment_lock', { p_rental_id: rental.id });
          return new Response(
            JSON.stringify({
              success: true,
              rentalId: rental.id,
              paymentId: existingByIdempotency.id,
              paymentUrl: existingByIdempotency.toyyibpay_bill_url,
              idempotent: true,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (existingByIdempotency.status === 'pending' && existingByIdempotency.toyyibpay_bill_url) {
          // Still pending with a bill URL — redirect user back to existing bill
          await supabase.rpc('release_payment_lock', { p_rental_id: rental.id });
          return new Response(
            JSON.stringify({
              success: true,
              rentalId: rental.id,
              paymentId: existingByIdempotency.id,
              paymentUrl: existingByIdempotency.toyyibpay_bill_url,
              idempotent: true,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        // Expired or failed — continue to create new payment
      }
    }

    const { data: feeSetting } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'platform_fee_percentage')
      .single();
    
    const feePercentage = parseFloat(feeSetting?.value || '10');
    // Round to cents so payout + fee always reconcile to the sen.
    const platformFee = Math.round(((rental.total_price * feePercentage) / 100) * 100) / 100;
    const totalAmount = rental.total_price; // Renter pays rental amount only, platform fee deducted from owner's payout

    console.log('Creating payment:', { totalPrice: rental.total_price, platformFee, totalAmount, feePercentage });

    // Guard against an existing OPEN payment (pending/paid). The partial unique
    // index (migration 20260726000005) also enforces this atomically.
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, status')
      .eq('rental_id', rental.id)
      .in('status', ['pending', 'paid'])
      .maybeSingle();

    if (existingPayment) {
      return new Response(
        JSON.stringify({ error: 'Payment already exists for this rental' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Insert as 'draft' first so a crash between bill creation and the update
    // can't leave an orphaned 'pending' payment blocking retries.
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        rental_id: rental.id,
        rental_amount: rental.total_price,
        platform_fee: platformFee,
        platform_fee_percentage: feePercentage,
        total_amount: totalAmount,
        status: 'draft',
        expires_at: expiresAt.toISOString(),
        promo_code_id: promoCodeId || rental.promo_code_id || null,
        discount_amount: discountAmount || rental.discount_amount || 0,
        original_amount: originalAmount || rental.original_total_price || rental.total_price,
        idempotency_key: idempotencyKey || null,
      })
      .select()
      .single();
    
    if (paymentError) {
      console.error('Payment creation error:', paymentError);
      
      await supabase.from('payment_flow_logs').insert({
        rental_id: rental.id,
        stage: 'payment_created',
        status: 'error',
        details: { error: paymentError.message }
      });
      
      throw paymentError;
    }
    
    console.log('Payment created:', payment.id);
    
    // Log payment creation
    await supabase.from('payment_flow_logs').insert({
      payment_id: payment.id,
      rental_id: rental.id,
      stage: 'payment_created',
      status: 'success',
      details: { totalAmount, platformFee, expiresAt: expiresAt.toISOString() }
    });
    
    const billAmount = (Math.round(totalAmount * 100) / 100).toFixed(2);
    
    const toyyibPayParams = new URLSearchParams({
      userSecretKey: Deno.env.get('TOYYIBPAY_SECRET_KEY')!,
      categoryCode: Deno.env.get('TOYYIBPAY_CATEGORY_CODE')!,
      billName: `Rental Payment`,
      billDescription: `Rental from ${rental.start_date} to ${rental.end_date}`,
      billPriceSetting: '1',
      billPayorInfo: '0',
      billAmount: billAmount,
      billReturnUrl: `${Deno.env.get('FRONTEND_URL')}/payment-success`,
      billCallbackUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-callback`,
      billExternalReferenceNo: payment.id,
      billTo: '',
      billEmail: '',
      billPhone: '',
      billSplitPayment: '0',
      billSplitPaymentArgs: '',
      billPaymentChannel: '0',
      billContentEmail: `Your rental payment of RM ${billAmount}`,
      billChargeToCustomer: '2' // Platform absorbs gateway fees - customer pays exact amount shown
    });
    
    console.log('Creating ToyyibPay bill with amount:', billAmount);
    
    // PRODUCTION: Use toyyibpay.com (not dev.toyyibpay.com)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    const toyyibPayResponse = await fetch('https://toyyibpay.com/index.php/api/createBill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: toyyibPayParams.toString(),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    const billData = await toyyibPayResponse.json();
    
    console.log('ToyyibPay bill created: code=' + billData[0]?.BillCode + ', status=' + billData[0]?.Status);
    
    if (!billData[0]?.BillCode) {
      console.error('ToyyibPay bill creation failed:', billData);
      
      await supabase.from('payment_flow_logs').insert({
        payment_id: payment.id,
        rental_id: rental.id,
        stage: 'bill_created',
        status: 'error',
        details: { error: 'No BillCode returned', response: billData }
      });
      
      throw new Error('Failed to create ToyyibPay bill');
    }
    
    // PRODUCTION: Use toyyibpay.com (not dev.toyyibpay.com)
    const billUrl = `https://toyyibpay.com/${billData[0].BillCode}`;
    
    // Promote draft -> pending and attach the bill details atomically.
    await supabase
      .from('payments')
      .update({
        status: 'pending',
        toyyibpay_bill_code: billData[0].BillCode,
        toyyibpay_bill_url: billUrl
      })
      .eq('id', payment.id)
      .eq('status', 'draft');
    
    console.log('ToyyibPay bill created:', billData[0].BillCode);
    
    // Log bill creation
    await supabase.from('payment_flow_logs').insert({
      payment_id: payment.id,
      rental_id: rental.id,
      stage: 'bill_created',
      status: 'success',
      details: { billCode: billData[0].BillCode, billUrl, amount: billAmount }
    });
    
    // Release payment lock on success
    await supabase.rpc('release_payment_lock', { p_rental_id: rental.id });
    
    return new Response(
      JSON.stringify({
        success: true,
        rentalId: rental.id,
        paymentId: payment.id,
        paymentUrl: billUrl,
        amount: totalAmount,
        platformFee: platformFee
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Payment creation error:', error);
    try {
      await supabase.rpc('release_payment_lock', { p_rental_id: rental?.id });
    } catch { /* ignore release errors */ }
    const message = error instanceof Error ? error.message : 'Payment processing failed';
    const isExpected = message.startsWith('Unauthorized') || message.startsWith('Rental') || message.startsWith('Your account');
    return new Response(
      JSON.stringify({ error: isExpected ? message : 'An unexpected error occurred. Please try again.' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
