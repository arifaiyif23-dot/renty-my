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
    // Toyyibpay callback takkan hantar authorization header, jadi kita bypass auth di sini
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const formData = await req.formData();
    const body = Object.fromEntries(formData.entries());

    console.log('Toyyibpay Callback Data:', body);

    const billCode = body.billcode;
    const status = body.status;
    const amount = Number(body.amount);
    const order_id = body.order_id;

    if (!billCode) throw new Error("Missing billCode in callback");

    // Cari transaksi dalam DB berdasarkan billcode
    const { data: transaction, error: txError } = await supabase
      .from("wallet_transactions")
      .select("*, wallet:wallets(user_id)")
      .eq("toyyibpay_transaction_id", billCode)
      .single();

    if (txError || !transaction) {
      console.error('Transaction not found:', txError);
      return new Response(JSON.stringify({ success: false, message: 'Transaction not found' }), { headers: corsHeaders });
    }

    if (status === '1') {
      console.log('✅ Payment success for', billCode);

      // Elak duplicate credit
      if (transaction.status !== 'completed') {
        const { error: walletError } = await supabase.rpc("increment_wallet_balance", {
          p_user_id: transaction.wallet.user_id,
          p_amount: amount,
        });

        if (walletError) throw walletError;

        await supabase
          .from("wallet_transactions")
          .update({ status: 'completed' })
          .eq("id", transaction.id);

        await supabase.from("notifications").insert({
          user_id: transaction.wallet.user_id,
          type: "payment_success",
          title: "Top Up Successful",
          message: `Your wallet has been topped up with RM ${amount}`,
          link: "/wallet",
        });

        return new Response(JSON.stringify({ success: true, message: 'Payment processed successfully' }), { headers: corsHeaders });
      }

      return new Response(JSON.stringify({ success: true, message: 'Already completed' }), { headers: corsHeaders });
    }

    console.log('⚠️ Payment not completed yet:', status);
    return new Response(JSON.stringify({ success: true, message: 'Pending or failed payment' }), { headers: corsHeaders });
  } catch (error) {
    console.error('Callback Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: corsHeaders, status: 400 });
  }
});
