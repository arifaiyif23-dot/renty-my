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
    const billCode = formData.get('billcode');
    const status = formData.get('status_id'); // 1 = successful, 3 = failed
    const amount = formData.get('amount');
    const transactionId = formData.get('transaction_id');

    console.log('ToyyibPay webhook received:', {
      billCode,
      status,
      amount,
      transactionId
    });

    if (!billCode || !status) {
      throw new Error('Missing required webhook data');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find the wallet transaction
    const { data: transaction } = await supabaseClient
      .from('wallet_transactions')
      .select('*, wallet:wallets(user_id, balance)')
      .eq('toyyibpay_transaction_id', billCode)
      .single();

    if (!transaction) {
      console.error('Transaction not found for bill code:', billCode);
      return new Response('OK', { status: 200 }); // Still return OK to avoid retries
    }

    // Payment successful
    if (status === '1') {
      // Update wallet balance
      const newBalance = Number(transaction.wallet.balance) + Number(transaction.amount);
      
      await supabaseClient
        .from('wallets')
        .update({ balance: newBalance })
        .eq('user_id', transaction.wallet.user_id);

      // Create notification
      await supabaseClient
        .from('notifications')
        .insert({
          user_id: transaction.wallet.user_id,
          type: 'payment',
          title: 'Payment Successful',
          message: `Your wallet has been topped up with RM ${transaction.amount}`,
          link: '/wallet'
        });

      console.log('Wallet topped up successfully:', {
        userId: transaction.wallet.user_id,
        amount: transaction.amount,
        newBalance
      });
    } else {
      // Payment failed
      await supabaseClient
        .from('notifications')
        .insert({
          user_id: transaction.wallet.user_id,
          type: 'payment',
          title: 'Payment Failed',
          message: 'Your payment could not be processed. Please try again.',
          link: '/wallet'
        });

      console.log('Payment failed for bill code:', billCode);
    }

    return new Response('OK', { 
      headers: corsHeaders,
      status: 200 
    });
  } catch (error: any) {
    console.error('Error processing ToyyibPay webhook:', error);
    return new Response('OK', { 
      headers: corsHeaders,
      status: 200 
    }); // Return OK to avoid retries
  }
});