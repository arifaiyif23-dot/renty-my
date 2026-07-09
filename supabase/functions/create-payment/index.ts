import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Unauthorized: No authorization header');
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Verify the user's identity
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized: Invalid token');
    }
    
    const { rentalId, itemId, startDate, endDate, renterId, ownerId, totalPrice } = await req.json();
    if (!rentalId && (!itemId || !renterId || !ownerId || !startDate || !endDate || totalPrice == null)) {
      throw new Error('Missing required fields');
    }
    
    let rental;
    let lockAcquired = false;
    
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
      
      // Verify rental is approved
      if (existingRental.status !== 'approved') {
        throw new Error(`Rental must be approved before payment. Current status: ${existingRental.status}`);
      }
      
      // Verify the authenticated user is the renter
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
    
    // Acquire payment lock to prevent race conditions
    const { data: acquired } = await supabase.rpc('acquire_payment_lock', {
      p_rental_id: rental.id,
      p_user_id: user.id
    });
    
    if (!acquired) {
      throw new Error('Payment is already being processed for this rental');
    }
    lockAcquired = true;
    
    // Get current platform fee percentage
    const { data: feeSetting } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'platform_fee_percentage')
      .single();
    
    const feePercentage = parseFloat(feeSetting?.value || '10');
    const platformFee = (rental.total_price * feePercentage) / 100;
    const totalAmount = rental.total_price; // Renter pays rental amount only, platform fee deducted from owner's payout
    
    console.log('Creating payment:', { totalPrice: rental.total_price, platformFee, totalAmount, feePercentage });
    
    // Check if payment already exists for this rental
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, status')
      .eq('rental_id', rental.id)
      .single();
    
    if (existingPayment && existingPayment.status !== 'expired') {
      throw new Error('Payment already exists for this rental');
    }
    
    // Create payment record
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
        expires_at: expiresAt.toISOString()
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
    
    // Create ToyyibPay bill
    const billAmount = (Math.round(totalAmount * 100) / 100).toFixed(2);
    
    const toyyibPayParams = new URLSearchParams({
      userSecretKey: Deno.env.get('TOYYIBPAY_SECRET_KEY')!,
      categoryCode: Deno.env.get('TOYYIBPAY_CATEGORY_CODE')!,
      billName: `Rental Payment`,
      billDescription: `Rental from ${startDate} to ${endDate}`,
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
    
    console.log('ToyyibPay response:', billData);
    
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
    
    // Update payment with ToyyibPay details
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
    lockAcquired = false;
    
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
    
  } catch (error: any) {
    console.error('Payment creation error:', error);
    if (lockAcquired) {
      try {
        await supabase.rpc('release_payment_lock', { p_rental_id: rental?.id });
      } catch { /* ignore release errors */ }
    }
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
