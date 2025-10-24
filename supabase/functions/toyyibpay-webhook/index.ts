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
    const formData = await req.formData();
    const billCode = formData.get('billcode') || formData.get('billCode');
    const status = formData.get('status_id') || formData.get('statusId'); // 1 = success, 2 = pending, 3 = failed
    const amount = Number(formData.get('amount')) || 0;
    const transactionId = formData.get('transaction_id') || formData.get('transactionId');

    console.log('ToyyibPay webhook received:', Object.fromEntries(formData));

    if (!billCode || !status) {
      throw new Error('Missing required webhook data');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find the related wallet transaction
    const { data: transaction, error: txError } = await supabaseClient
      .from('wallet_transactions')
      .select('id, amount, status, wallet_id, toyyibpay_transaction_id, wallets(user_id, balance)')
      .eq('toyyibpay_transaction_id', billCode)
      .single();

    if (txError || !transaction) {
      console.error('Transaction not found for bill code:', billCode);
      return new Response('OK', { status: 200 });
    }

    const userId = transaction.wallets.user_id;
    const currentBalance = Number(transaction.wallets.balance) || 0;

    if (status === '1') {
      // Successful payment
      const newBalance = currentBalance + Number(transaction.amount);

      await supabaseClient.from('wallets').update({ balance: newBalance }).eq('user_id', userId);
      await supabaseClient.from('wallet_transactions').update({ status: 'completed' }).eq('id', transaction.id);

      await supabaseClient.from('notifications').insert({
        user_id: userId,
        type: 'payment',
        title: 'Top-up Successful',
        message: `RM${transaction.amount.toFixed(2)} has been added to your wallet.`,
        link: '/wallet',
      });

      console.log('Wallet top-up successful:', { userId, newBalance, billCode });
    } else if (status === '3') {
      // Failed payment
      await supabaseClient.from('wallet_transactions').update({ status: 'failed' }).eq('id', transaction.id);

      await supabaseClient.from('notifications').insert({
        user_id: userId,
        type: 'payment',
        title: 'Payment Failed',
        message: 'Your payment could not be processed. Please try again.',
        link: '/wallet',
      });

      console.log('Payment failed for bill code:', billCode);
    } else {
      console.log('Unhandled payment status:', status);
    }

    return new Response('OK', { headers: corsHeaders, status: 200 });
  } catch (error) {
    console.error('Error in ToyyibPay webhook:', error);
    return new Response('OK', { headers: corsHeaders, status: 200 }); // Always return OK to prevent retries
  }
});