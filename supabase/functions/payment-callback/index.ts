import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Verify payment authoritatively via ToyyibPay's getBillTransactions API.
// The previous HMAC-SHA256 "signature" scheme did not match ToyyibPay's real
// (md5-based) scheme and rejected every legitimate callback. Querying the API
// server-side is the authoritative source of truth for bill status.
interface ToyyibPayTransaction {
  billCode: string;
  billpaymentStatus: string; // '1' = successful, '2' = pending, '3' = failed
  billpaymentAmount?: string;
  billpaymentInvoiceNo?: string;
  billpaymentTransactionId?: string;
}

async function fetchBillStatus(billCode: string, secretKey: string): Promise<{ status: string | null; transactionId: string | null; raw: unknown }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const body = new URLSearchParams({ userSecretKey: secretKey, billCode });
    const res = await fetch('https://toyyibpay.com/index.php/api/getBillTransactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller.signal,
    });
    const data = await res.json();
    // ToyyibPay returns an array of transactions for the bill (may be empty).
    const tx: ToyyibPayTransaction | undefined = Array.isArray(data) ? data[0] : undefined;
    return {
      status: tx?.billpaymentStatus ?? null,
      transactionId: tx?.billpaymentTransactionId ?? null,
      raw: data,
    };
  } finally {
    clearTimeout(timeoutId);
  }
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
    
    const secretKey = Deno.env.get('TOYYIBPAY_SECRET_KEY')!;
    const signature = url.searchParams.get('signature');

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

    // SECURITY: Authoritative verification via ToyyibPay getBillTransactions API.
    // Never trust the URL query params — they are trivially forgeable. Use the
    // billCode stored on the payment (fall back to the callback's billcode) and
    // confirm the real status from ToyyibPay before mutating any state.
    const billCodeToVerify = payment.toyyibpay_bill_code || billCode;
    let verifiedStatus: string | null = null;
    let verifiedTransactionId: string | null = transactionId;
    try {
      const verified = await fetchBillStatus(billCodeToVerify, secretKey);
      verifiedStatus = verified.status;
      verifiedTransactionId = verified.transactionId || transactionId;
      console.log('ToyyibPay verified status:', { billCode: billCodeToVerify, verifiedStatus, callbackStatus: status });
    } catch (verifyErr) {
      console.error('ToyyibPay verification request failed:', verifyErr);
      await supabase.from('payment_flow_logs').insert({
        payment_id: paymentId,
        stage: 'callback_received',
        status: 'error',
        details: { error: 'Verification request failed', billCode: billCodeToVerify }
      });
      // Fail closed: do not mutate payment/rental state if we cannot verify.
      return new Response('Verification unavailable', { status: 503 });
    }

    // Use the verified status from ToyyibPay, not the callback's claimed status.
    if (verifiedStatus === '1') {
      // Payment successful — atomic update with status guard (TOCTOU prevention)
      console.log('Processing successful payment:', paymentId);
      
      const { data: updatedPayment } = await supabase
        .from('payments')
        .update({
          status: 'paid',
          toyyibpay_transaction_id: verifiedTransactionId,
          toyyibpay_signature: signature,
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
      
    } else if (verifiedStatus === '3') {
      // Payment failed
      console.log('Processing failed payment:', paymentId);

      // Guard: only transition a still-pending payment. If a success callback was
      // already processed, do NOT regress it to failed or cancel the rental.
      const { data: failedPayment } = await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', paymentId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (!failedPayment) {
        console.log('Payment not in pending state, skipping failure handling:', paymentId);
        return new Response('OK', { status: 200 });
      }

      await supabase
        .from('rentals')
        .update({ status: 'cancelled' })
        .eq('id', payment.rental_id)
        .in('status', ['pending', 'pending_approval', 'approved']);

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
