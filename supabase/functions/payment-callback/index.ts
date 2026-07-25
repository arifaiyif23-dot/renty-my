import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

// Verify ToyyibPay signature (optional - for enhanced security)
function verifyToyyibPaySignature(params: URLSearchParams, secretKey: string): boolean {
  const signature = params.get('signature');
  if (!signature) return false;

  const signatureParams = new URLSearchParams(params);
  signatureParams.delete('signature');
  
  const sortedParams = Array.from(signatureParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  
  const computedSignature = createHmac('sha256', secretKey)
    .update(sortedParams)
    .digest('hex');
  
  return computedSignature === signature;
}

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
    
    // SECURITY: Verify signature - REQUIRED for all callbacks
    const secretKey = Deno.env.get('TOYYIBPAY_SECRET_KEY')!;
    const signature = url.searchParams.get('signature');
    
    // Reject callbacks without signature or with invalid signature
    if (!signature || !verifyToyyibPaySignature(url.searchParams, secretKey)) {
      console.error('Missing or invalid ToyyibPay signature');
      
      // Log security incident
      await supabase.from('payment_flow_logs').insert({
        payment_id: paymentId,
        stage: 'callback_received',
        status: 'error',
        details: { 
          error: signature ? 'Invalid signature' : 'Missing signature', 
          billCode, 
          transactionId,
          ip: req.headers.get('x-forwarded-for') || 'unknown'
        }
      });
      
      return new Response('Unauthorized', { status: 401 });
    }
    
    const { data: payment } = await supabase
      .from('payments')
      .select('*, rental:rentals(*)')
      .eq('id', paymentId)
      .single();
    
    // Log callback received
    await supabase.from('payment_flow_logs').insert({
      payment_id: paymentId,
      stage: 'callback_received',
      status: 'info',
      details: { billCode, status, transactionId }
    });
    
    if (!payment) {
      console.error('Payment not found:', paymentId);
      
      await supabase.from('payment_flow_logs').insert({
        payment_id: paymentId,
        stage: 'callback_received',
        status: 'error',
        details: { error: 'Payment not found', paymentId }
      });
      
      return new Response('Payment not found', { status: 404 });
    }
    
    if (status === '1') {
      // Payment successful — atomic update with status guard (TOCTOU prevention)
      console.log('Processing successful payment:', paymentId);
      
      const { data: updatedPayment } = await supabase
        .from('payments')
        .update({
          status: 'paid',
          toyyibpay_transaction_id: transactionId,
          toyyibpay_signature: url.searchParams.get('signature'),
          payment_verified_at: new Date().toISOString(),
          paid_at: new Date().toISOString()
        })
        .eq('id', paymentId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();
      
      // Idempotency: another callback already processed this payment
      if (!updatedPayment) {
        console.log('Payment already processed, skipping:', paymentId);
        return new Response('OK', { status: 200 });
      }
      
      // Log payment verification
      await supabase.from('payment_flow_logs').insert({
        payment_id: paymentId,
        rental_id: payment.rental_id,
        stage: 'payment_verified',
        status: 'success',
        details: { transactionId, billCode, amount: payment.total_amount }
      });
      
      await supabase
        .from('rentals')
        .update({ status: 'paid' })
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
      
      // Trigger n8n workflow for receipt generation (fire-and-forget — non-blocking)
      const n8nWebhookUrl = Deno.env.get('N8N_RECEIPT_WEBHOOK_URL');
      if (n8nWebhookUrl) {
        const webhookPayload = {
          paymentId,
          rentalId: payment.rental_id,
          renterId: payment.rental.renter_id,
          ownerId: payment.rental.owner_id,
          amount: payment.total_amount,
          transactionId
        };
        
        // Create log entry (fire-and-forget, don't block callback response)
        supabase.from('workflow_logs').insert({
          workflow_name: 'payment-receipt-generation',
          payment_id: paymentId,
          trigger_data: webhookPayload,
          status: 'pending'
        }).then(() => {}).catch(() => {});
        
        // Fire and forget — n8n latency must not block ToyyibPay callback
        fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload)
        }).then(async (response) => {
          const responseText = await response.text();
          if (!response.ok) {
            console.error('n8n receipt workflow failed:', responseText);
          }
        }).catch((err) => {
          console.error('n8n receipt workflow error:', err);
        });
      }
      
    } else if (status === '3') {
      // Payment failed
      console.log('Processing failed payment:', paymentId);
      
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', paymentId);
      
      await supabase
        .from('rentals')
        .update({ status: 'cancelled' })
        .eq('id', payment.rental_id);
      
      // Log payment failure
      await supabase.from('payment_flow_logs').insert({
        payment_id: paymentId,
        rental_id: payment.rental_id,
        stage: 'payment_failed',
        status: 'error',
        details: { billCode, transactionId, reason: 'Payment failed by user or gateway' }
      });
      
      console.log('Payment failed:', paymentId);
    }
    
    return new Response('OK', { status: 200 });
    
  } catch (error) {
    console.error('Callback error:', error);
    return new Response('Error', { status: 500 });
  }
});
