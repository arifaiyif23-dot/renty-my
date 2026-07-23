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
}).refine(
  (data) => data.rentalId || (data.itemId && data.startDate && data.endDate && data.renterId && data.ownerId && data.totalPrice != null),
  { message: 'Provide either rentalId (for existing rental) or all fields: itemId, startDate, endDate, renterId, ownerId, totalPrice' }
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
    const { rentalId, itemId, startDate, endDate, renterId, ownerId, totalPrice, promoCodeId, discountAmount, originalAmount } = validationResult.data;
    
    let rental;
    
    // NEW FLOW: Check if rental already exists (for approved rentals)
    if (rentalId) {
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
    } else {
      // OLD FLOW: Create new rental (for backward compatibility, but shouldn't be used)
      console.log('Creating new rental (legacy flow):', { itemId, renterId, ownerId });
      
      const { data: newRental, error: rentalError } = await supabase
        .from('rentals')
        .insert({
          item_id: itemId,
          renter_id: renterId,
          owner_id: ownerId,
          start_date: startDate,
          end_date: endDate,
          total_price: totalPrice,
          status: 'pending'
        })
        .select()
        .single();
      
      if (rentalError) {
        console.error('Rental creation error:', rentalError);
        throw rentalError;
      }
      
      rental = newRental;
      
      // Log rental creation
      await supabase.from('payment_flow_logs').insert({
        rental_id: rental.id,
        stage: 'rental_created',
        status: 'success',
        details: { itemId, renterId, ownerId, startDate, endDate, totalPrice }
      });
    }
    
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

    const { data: feeSetting } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'platform_fee_percentage')
      .single();
    
    const feePercentage = parseFloat(feeSetting?.value || '10');
    const platformFee = (rental.total_price * feePercentage) / 100;
    const totalAmount = rental.total_price; // Renter pays rental amount only, platform fee deducted from owner's payout
    
    console.log('Creating payment:', { totalPrice: rental.total_price, platformFee, totalAmount, feePercentage });
    
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, status')
      .eq('rental_id', rental.id)
      .maybeSingle();
    
    if (existingPayment && existingPayment.status !== 'expired') {
      throw new Error('Payment already exists for this rental');
    }
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        rental_id: rental.id,
        rental_amount: rental.total_price,
        platform_fee: platformFee,
        platform_fee_percentage: feePercentage,
        total_amount: totalAmount,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        promo_code_id: promoCodeId || rental.promo_code_id || null,
        discount_amount: discountAmount || rental.discount_amount || 0,
        original_amount: originalAmount || rental.original_total_price || rental.total_price,
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
    const toyyibPayResponse = await fetch('https://toyyibpay.com/index.php/api/createBill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: toyyibPayParams.toString()
    });
    
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
    
    await supabase
      .from('payments')
      .update({
        toyyibpay_bill_code: billData[0].BillCode,
        toyyibpay_bill_url: billUrl
      })
      .eq('id', payment.id);
    
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
