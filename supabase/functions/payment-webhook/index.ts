import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createHash } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Verify ToyyibPay signature
function verifyToyyibPaySignature(payload: any, secretKey: string): boolean {
  const { billcode, order_id, status_id, transaction_id } = payload;
  const signatureString = `${secretKey}${billcode}${order_id}${status_id}`;
  const hash = createHash('md5').update(signatureString).digest('hex');
  return hash === payload.hash;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Payment webhook received');

    // Parse payload (can be JSON or form data)
    let payload: any;
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      payload = await req.json();
    } else {
      const formData = await req.formData();
      payload = Object.fromEntries(formData.entries());
    }

    console.log('Webhook payload:', JSON.stringify(payload, null, 2));

    const secretKey = Deno.env.get('TOYYIBPAY_SECRET_KEY');
    if (!secretKey) {
      throw new Error('ToyyibPay secret key not configured');
    }

    // Verify signature
    const isValid = verifyToyyibPaySignature(payload, secretKey);
    if (!isValid) {
      console.error('Invalid signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const billCode = payload.billcode || payload.billCode;
    const statusId = payload.status_id || payload.statusId || '0';
    const transactionId = payload.transaction_id || payload.transactionId;
    const amount = parseFloat(payload.amount || '0') / 100; // Convert from cents

    console.log(`Processing payment - Bill: ${billCode}, Status: ${statusId}, Amount: ${amount}`);

    // Find payment by bill code
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select(`
        *,
        rental:rentals(
          *,
          item:items(
            title,
            owner_id
          )
        )
      `)
      .eq('toyyibpay_bill_code', billCode)
      .single();

    if (paymentError || !payment) {
      console.error('Payment not found:', paymentError);
      throw new Error('Payment not found');
    }

    if (payment.status === 'completed') {
      console.log('Payment already processed');
      return new Response(
        JSON.stringify({ success: true, message: 'Already processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Status 1 = successful payment
    if (statusId === '1') {
      console.log('Payment successful, processing...');

      // Update payment status
      await supabase
        .from('payments')
        .update({
          status: 'completed',
          toyyibpay_transaction_id: transactionId,
          paid_at: new Date().toISOString()
        })
        .eq('id', payment.id);

      // Get earnings hold days
      const { data: holdSettings } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'earnings_hold_days')
        .single();

      const holdDays = holdSettings?.value ? Number(holdSettings.value) : 3;
      
      // Calculate release date (hold days after rental end date)
      const releaseDate = new Date(payment.rental.end_date);
      releaseDate.setDate(releaseDate.getDate() + holdDays);

      // Create owner earnings record
      await supabase
        .from('owner_earnings')
        .insert({
          owner_id: payment.rental.item.owner_id,
          payment_id: payment.id,
          rental_id: payment.rental_id,
          amount: payment.owner_earnings,
          status: 'held',
          held_until: releaseDate.toISOString().split('T')[0], // Date only
          payout_status: 'pending'
        });

      // Update rental payment status
      await supabase
        .from('rentals')
        .update({ payment_status: 'paid' })
        .eq('id', payment.rental_id);

      console.log('Owner earnings created, rental updated');

      // Send notifications
      await supabase
        .from('notifications')
        .insert([
          {
            user_id: payment.payer_id,
            type: 'payment_received',
            title: 'Payment Successful!',
            message: `Your payment of RM ${payment.amount.toFixed(2)} for "${payment.rental.item.title}" was successful.`,
            link: `/dashboard`
          },
          {
            user_id: payment.rental.item.owner_id,
            type: 'rental_approved',
            title: 'New Rental Booking!',
            message: `Your item "${payment.rental.item.title}" has been booked. Earnings: RM ${payment.owner_earnings.toFixed(2)}`,
            link: `/dashboard`
          }
        ]);

      console.log('Notifications sent');

    } else if (statusId === '3') {
      // Payment failed
      console.log('Payment failed');

      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', payment.id);

      await supabase
        .from('notifications')
        .insert({
          user_id: payment.payer_id,
          type: 'rental_rejected',
          title: 'Payment Failed',
          message: `Your payment for "${payment.rental.item.title}" failed. Please try again.`,
          link: `/items/${payment.rental.item_id}`
        });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in payment-webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
