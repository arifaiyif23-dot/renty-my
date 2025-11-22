import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { rentalId } = await req.json();

    console.log('Creating payment for rental:', rentalId);

    // Get rental details
    const { data: rental, error: rentalError } = await supabase
      .from('rentals')
      .select(`
        *,
        item:items(
          id,
          title,
          price_per_day,
          owner_id
        )
      `)
      .eq('id', rentalId)
      .single();

    if (rentalError || !rental) {
      throw new Error('Rental not found');
    }

    if (rental.renter_id !== user.id) {
      throw new Error('Unauthorized - not the renter');
    }

    // Get platform fee percentage
    const { data: feeSettings } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'platform_fee_percentage')
      .single();

    const platformFeePercent = feeSettings?.value ? Number(feeSettings.value) : 10;
    const totalPrice = rental.total_price;
    const platformFee = (totalPrice * platformFeePercent) / 100;
    const ownerEarnings = totalPrice - platformFee;

    // Create payment record using service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        rental_id: rentalId,
        payer_id: user.id,
        amount: totalPrice,
        platform_fee: platformFee,
        owner_earnings: ownerEarnings,
        status: 'pending'
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Payment creation error:', paymentError);
      throw new Error('Failed to create payment record');
    }

    console.log('Payment record created:', payment.id);

    // Create ToyyibPay bill
    const toyyibpaySecretKey = Deno.env.get('TOYYIBPAY_SECRET_KEY');
    const toyyibpayCategoryCode = Deno.env.get('TOYYIBPAY_CATEGORY_CODE');
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:8080';

    if (!toyyibpaySecretKey || !toyyibpayCategoryCode) {
      throw new Error('ToyyibPay credentials not configured');
    }

    const billData = {
      userSecretKey: toyyibpaySecretKey,
      categoryCode: toyyibpayCategoryCode,
      billName: `Rental: ${rental.item.title}`,
      billDescription: `Payment for rental from ${rental.start_date} to ${rental.end_date}`,
      billPriceSetting: 1,
      billPayorInfo: 1,
      billAmount: (totalPrice * 100).toFixed(0), // Convert to cents
      billReturnUrl: `${frontendUrl}/dashboard`,
      billCallbackUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-webhook`,
      billExternalReferenceNo: payment.id,
      billTo: user.email || '',
      billEmail: user.email || '',
    };

    console.log('Creating ToyyibPay bill...');

    const billResponse = await fetch('https://toyyibpay.com/index.php/api/createBill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(billData),
    });

    const billResult = await billResponse.json();

    if (billResult[0]?.BillCode) {
      const billCode = billResult[0].BillCode;
      
      // Update payment with bill code
      await supabaseAdmin
        .from('payments')
        .update({ toyyibpay_bill_code: billCode })
        .eq('id', payment.id);

      const paymentUrl = `https://toyyibpay.com/${billCode}`;
      
      console.log('ToyyibPay bill created:', billCode);

      return new Response(
        JSON.stringify({ 
          success: true, 
          paymentUrl,
          paymentId: payment.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.error('ToyyibPay error:', billResult);
      throw new Error('Failed to create ToyyibPay bill');
    }

  } catch (error: any) {
    console.error('Error in create-rental-payment:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
