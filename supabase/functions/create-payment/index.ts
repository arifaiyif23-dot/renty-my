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
    const { itemId, startDate, endDate, renterId, ownerId, totalPrice } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Get current platform fee percentage
    const { data: feeSetting } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'platform_fee_percentage')
      .single();
    
    const feePercentage = parseFloat(feeSetting?.value || '10');
    const platformFee = (totalPrice * feePercentage) / 100;
    const totalAmount = totalPrice; // Renter pays rental amount only, platform fee deducted from owner's payout
    
    console.log('Creating payment:', { totalPrice, platformFee, totalAmount, feePercentage });
    
    // Create rental record
    const { data: rental, error: rentalError } = await supabase
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
    
    if (rentalError) throw rentalError;
    
    // Create payment record
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        rental_id: rental.id,
        rental_amount: totalPrice,
        platform_fee: platformFee,
        platform_fee_percentage: feePercentage,
        total_amount: totalAmount,
        status: 'pending',
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();
    
    if (paymentError) throw paymentError;
    
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
      billChargeToCustomer: '1'
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
