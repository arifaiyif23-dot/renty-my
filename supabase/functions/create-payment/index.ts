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

  let lockAcquired = false;
  let supabase;
  let rental: { id: string; total_price: number; start_date: string; end_date: string; promo_code_id?: string | null; discount_amount?: number | null; original_total_price?: number | null } | undefined;
  let payment: { id: string } | undefined;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Unauthorized: No authorization header');
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    supabase = createClient(
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
    const { rentalId, promoCodeId, discountAmount, originalAmount, idempotencyKey } = validationResult.data;
    
    if (!rentalId) {
      return new Response(
        JSON.stringify({ error: 'rentalId is required. Create a booking first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing payment for existing rental:', rentalId);

    const { data: existingRental, error: fetchError } = await supabase
      .from('rentals')
      .select('*')
      .eq('id', rentalId)
      .single();

    if (fetchError || !existingRental) {
      throw new Error('Rental not found');
    }

    if (existingRental.status !== 'requested') {
      throw new Error(`Rental must be in 'requested' status for payment. Current status: ${existingRental.status}`);
    }

    if (existingRental.renter_id !== user.id) {
      throw new Error('Forbidden: You can only create payments for your own rentals');
    }

    rental = existingRental;
    
    console.log('Creating payment for rental:', rental.id);

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

    // Acquire payment lock
    const { data: acquired } = await supabase.rpc('acquire_payment_lock', {
      p_rental_id: rental.id,
      p_user_id: user.id
    });

    if (!acquired) {
      throw new Error('Payment is already being processed for this rental');
    }
    lockAcquired = true;

    // Idempotency check
    if (idempotencyKey) {
      const { data: existingByIdempotency } = await supabase
        .from('payments')
        .select('id, status, toyyibpay_bill_url')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existingByIdempotency) {
        if (existingByIdempotency.status === 'paid') {
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
      }
    }

    // Founder decision (2026-08-05): Renty bears the RM1 per-transaction cost.
    // NO platform fee is charged to renter (bill = total_price) or deducted
    // from the owner (payout = full total via create_payout_on_rental_complete,
    // which subtracts platform_fee — keep it 0).
    const feePercentage = 0;
    const platformFee = 0;
    const totalAmount = rental.total_price;

    console.log('Creating payment:', { totalPrice: rental.total_price, platformFee, totalAmount, feePercentage });

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

    const { data: paymentData, error: paymentError } = await supabase
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
    
    payment = paymentData;
    console.log('Payment created:', payment.id);
    
    await supabase.from('payment_flow_logs').insert({
      payment_id: paymentData.id,
      rental_id: rental.id,
      stage: 'payment_created',
      status: 'success',
      details: { totalAmount, platformFee, expiresAt: expiresAt.toISOString() }
    });
    
    const billAmount = String(Math.round(totalAmount * 100));
    
    const isSandbox = Deno.env.get('TOYYIBPAY_SANDBOX') === 'true';
    const toyyibPaySecretKey = isSandbox
      ? Deno.env.get('TOYYIBPAY_SANDBOX_SECRET_KEY')!
      : Deno.env.get('TOYYIBPAY_SECRET_KEY')!;
    const toyyibPayCategoryCode = isSandbox
      ? Deno.env.get('TOYYIBPAY_SANDBOX_CATEGORY_CODE')!
      : Deno.env.get('TOYYIBPAY_CATEGORY_CODE')!;
    const toyyibPayBaseUrl = isSandbox ? 'https://dev.toyyibpay.com' : 'https://toyyibpay.com';

    const toyyibPayParams = new URLSearchParams({
      userSecretKey: toyyibPaySecretKey,
      categoryCode: toyyibPayCategoryCode,
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
      billContentEmail: `Your rental payment of RM ${totalAmount.toFixed(2)}`
    });
    
    console.log('Creating ToyyibPay bill with amount:', billAmount, isSandbox ? '(sandbox)' : '(production)');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    const toyyibPayResponse = await fetch(`${toyyibPayBaseUrl}/index.php/api/createBill`, {
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
    
    const billUrl = `${toyyibPayBaseUrl}/${billData[0].BillCode}`;
    
    await supabase
      .from('payments')
      .update({
        status: 'pending',
        toyyibpay_bill_code: billData[0].BillCode,
        toyyibpay_bill_url: billUrl
      })
      .eq('id', payment.id)
      .eq('status', 'draft');

    // SOP: transition rental from requested → payment_pending
    await supabase
      .from('rentals')
      .update({ status: 'payment_pending' })
      .eq('id', rental.id)
      .eq('status', 'requested');
    
    console.log('ToyyibPay bill created:', billData[0].BillCode);
    
    await supabase.from('payment_flow_logs').insert({
      payment_id: payment.id,
      rental_id: rental.id,
      stage: 'bill_created',
      status: 'success',
      details: { billCode: billData[0].BillCode, billUrl, amount: billAmount }
    });
    
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
    const message = error instanceof Error ? error.message : 'Payment processing failed';

    try {
      await supabase.from('payment_flow_logs').insert({
        payment_id: payment?.id,
        rental_id: rental?.id,
        stage: 'catch_all',
        status: 'error',
        details: { error: message, name: error instanceof Error ? error.name : undefined }
      });
    } catch { /* ignore logging errors */ }

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } finally {
    if (lockAcquired && supabase) {
      try {
        await supabase.rpc('release_payment_lock', { p_rental_id: rental?.id });
      } catch { /* ignore release errors */ }
    }
  }
});
