import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const billCode = url.searchParams.get('billcode');
    const status = url.searchParams.get('status_id');
    const transactionId = url.searchParams.get('transaction_id');
    const paymentId = url.searchParams.get('order_id');
    
    console.log('ToyyibPay callback:', { billCode, status, transactionId, paymentId });
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const { data: payment } = await supabase
      .from('payments')
      .select('*, rental:rentals(*)')
      .eq('id', paymentId)
      .single();
    
    if (!payment) {
      console.error('Payment not found:', paymentId);
      return new Response('Payment not found', { status: 404 });
    }
    
    if (status === '1') {
      // Payment successful
      await supabase
        .from('payments')
        .update({
          status: 'paid',
          toyyibpay_transaction_id: transactionId,
          paid_at: new Date().toISOString()
        })
        .eq('id', paymentId);
      
      await supabase
        .from('rentals')
        .update({ status: 'approved' })
        .eq('id', payment.rental_id);
      
      // Notifications
      await supabase.from('notifications').insert([
        {
          user_id: payment.rental.renter_id,
          type: 'rental_approved',
          title: 'Payment Successful',
          message: 'Your rental payment has been confirmed. The item is ready for pickup!',
          link: `/dashboard`
        },
        {
          user_id: payment.rental.owner_id,
          type: 'rental_request',
          title: 'New Rental (Paid)',
          message: 'A renter has paid for your item. Please prepare it for pickup.',
          link: `/dashboard`
        }
      ]);
      
      console.log('Payment successful:', paymentId);
      
    } else if (status === '3') {
      // Payment failed
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', paymentId);
      
      await supabase
        .from('rentals')
        .update({ status: 'cancelled' })
        .eq('id', payment.rental_id);
      
      console.log('Payment failed:', paymentId);
    }
    
    return new Response('OK', { status: 200 });
    
  } catch (error) {
    console.error('Callback error:', error);
    return new Response('Error', { status: 500 });
  }
});
