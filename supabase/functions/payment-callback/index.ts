import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface Tx {
  billpaymentStatus?: string;
  billpaymentTransactionId?: string;
}

serve(async (req) => {
  try {
    // Try reading POST body first, then URL query params
    const bodyText = await req.text();
    const params = bodyText ? new URLSearchParams(bodyText) : new URL(req.url).searchParams;

    const billCode = params.get('billcode') || params.get('billCode') || '';
    const status = params.get('status') || params.get('status_id') || '';
    const transactionId = params.get('refno') || params.get('transaction_id') || '';
    const paymentId = params.get('order_id') || '';

    if (!paymentId) {
      return new Response('Missing order_id', { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabase.from('payment_flow_logs').insert({
      payment_id: paymentId,
      stage: 'callback_received',
      status: 'info',
      details: { billCode, status, transactionId }
    });

    const { data: payment } = await supabase
      .from('payments')
      .select('*, rental:rentals(*)')
      .eq('id', paymentId)
      .maybeSingle();

    if (!payment) {
      return new Response('Payment not found', { status: 404 });
    }

    if (payment.status !== 'pending') {
      return new Response('OK', { status: 200 });
    }

    const isSandbox = Deno.env.get('TOYYIBPAY_SANDBOX') === 'true';
    const secretKey = isSandbox
      ? Deno.env.get('TOYYIBPAY_SANDBOX_SECRET_KEY')!
      : Deno.env.get('TOYYIBPAY_SECRET_KEY')!;
    const baseUrl = isSandbox ? 'https://dev.toyyibpay.com' : 'https://toyyibpay.com';

    // Authoritative verification
    let verifiedStatus: string | null = null;
    let verifiedTxId: string | null = null;
    try {
      const apiParams = new URLSearchParams({ userSecretKey: secretKey, billCode: payment.toyyibpay_bill_code || billCode });
      const res = await fetch(`${baseUrl}/index.php/api/getBillTransactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: apiParams.toString(),
      });
      const data = await res.json();
      const tx: Tx | undefined = Array.isArray(data) ? data[0] : undefined;
      verifiedStatus = tx?.billpaymentStatus ?? null;
      verifiedTxId = tx?.billpaymentTransactionId || null;
    } catch (e) {
      console.error('Verification request failed:', e);
      return new Response('Verification unavailable', { status: 503 });
    }

    if (verifiedStatus === '1') {
      await supabase.from('payments').update({
        status: 'paid',
        toyyibpay_transaction_id: verifiedTxId || transactionId,
        payment_verified_at: new Date().toISOString(),
        paid_at: new Date().toISOString()
      }).eq('id', paymentId).eq('status', 'pending');

      await supabase.from('rentals').update({ status: 'reserved' }).eq('id', payment.rental_id).in('status', ['payment_pending']);

      await supabase.from('notifications').insert({
        user_id: payment.rental?.owner_id,
        type: 'rental_request',
        title: 'Payment Received',
        message: 'Payment has been received for your item. Please confirm the booking to proceed.',
        link: '/my-listings',
      });

      await supabase.from('notifications').insert({
        user_id: payment.rental?.renter_id,
        type: 'rental_request',
        title: 'Payment Verified',
        message: 'Your payment has been verified. Waiting for the owner to confirm your booking.',
        link: '/dashboard',
      });
    } else if (verifiedStatus === '3') {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', paymentId).eq('status', 'pending');
      await supabase.from('rentals').update({ status: 'cancelled' }).eq('id', payment.rental_id).in('status', ['payment_pending']);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Callback error:', error);
    return new Response('Error', { status: 500 });
  }
});
