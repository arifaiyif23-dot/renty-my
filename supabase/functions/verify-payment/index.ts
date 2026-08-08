import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') || 'https://renty.my',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Tx {
  billpaymentStatus?: string;
  billpaymentTransactionId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized: No authorization header');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized: Invalid token');

    const { error: suspendError } = await supabase.rpc('check_user_not_suspended', { p_user_id: user.id });
    if (suspendError) throw new Error('Your account has been suspended. Contact support for assistance.');

    const { billCode, paymentId } = await req.json();
    if (!billCode || !paymentId) {
      return new Response(
        JSON.stringify({ error: 'billCode and paymentId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isSandbox = Deno.env.get('TOYYIBPAY_SANDBOX') === 'true';
    const secretKey = isSandbox
      ? Deno.env.get('TOYYIBPAY_SANDBOX_SECRET_KEY')!
      : Deno.env.get('TOYYIBPAY_SECRET_KEY')!;
    const baseUrl = isSandbox ? 'https://dev.toyyibpay.com' : 'https://toyyibpay.com';

    const params = new URLSearchParams({ userSecretKey: secretKey, billCode });
    const res = await fetch(`${baseUrl}/index.php/api/getBillTransactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json();
    const tx: Tx | undefined = Array.isArray(data) ? data[0] : undefined;

    if (tx?.billpaymentStatus !== '1') {
      return new Response(
        JSON.stringify({ verified: false, status: tx?.billpaymentStatus || 'unknown' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: payment } = await supabase
      .from('payments')
      .select('*, rental:rentals(*)')
      .eq('id', paymentId)
      .single();

    if (!payment || payment.status === 'paid') {
      return new Response(
        JSON.stringify({ verified: true, alreadyPaid: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase
      .from('payments')
      .update({
        status: 'paid',
        toyyibpay_transaction_id: tx?.billpaymentTransactionId || null,
        payment_verified_at: new Date().toISOString(),
        paid_at: new Date().toISOString()
      })
      .eq('id', paymentId)
      .eq('status', 'pending');

    await supabase
      .from('rentals')
      .update({ status: 'paid' })
      .eq('id', payment.rental_id)
      .in('status', ['payment_pending']);

    await supabase.from('payment_flow_logs').insert({
      payment_id: paymentId,
      rental_id: payment.rental_id,
      stage: 'payment_verified',
      status: 'success',
      details: { billCode, transactionId: tx?.billpaymentTransactionId, method: 'verify-payment' }
    });

    return new Response(
      JSON.stringify({ verified: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('verify-payment error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Verification failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
