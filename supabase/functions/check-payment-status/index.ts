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
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { billCode } = await req.json();
    if (!billCode) throw new Error("Bill code required");

    console.log('Checking payment status for bill:', billCode);

    // Get transaction
    const { data: transaction, error: txError } = await supabase
      .from("wallet_transactions")
      .select("*, wallet:wallets(user_id)")
      .eq("toyyibpay_transaction_id", billCode)
      .eq("wallet.user_id", user.id)
      .single();

    if (txError || !transaction) {
      throw new Error("Transaction not found");
    }

    // If already completed, return success
    if (transaction.status === 'completed') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: 'completed',
          message: 'Payment already processed'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Query ToyyibPay API for bill status
    const toyyibpaySecretKey = Deno.env.get("TOYYIBPAY_SECRET_KEY");
    const params = new URLSearchParams({
      billCode: billCode,
    });

    const response = await fetch(
      `https://toyyibpay.com/index.php/api/getBillTransactions?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${toyyibpaySecretKey}`,
        }
      }
    );

    const billStatus = await response.json();
    console.log('Bill status from ToyyibPay:', billStatus);

    // Check if payment was successful
    if (Array.isArray(billStatus) && billStatus.length > 0) {
      const latestTransaction = billStatus[0];
      
      if (latestTransaction.billpaymentStatus === '1') {
        // Payment successful but webhook might have failed
        console.log('Payment successful, processing manually');

        // Credit wallet atomically
        const { error: walletError } = await supabase.rpc(
          "increment_wallet_balance",
          {
            p_user_id: transaction.wallet.user_id,
            p_amount: Number(transaction.amount),
          }
        );

        if (walletError) throw walletError;

        // Update transaction
        await supabase
          .from("wallet_transactions")
          .update({ status: "completed" })
          .eq("id", transaction.id);

        // Create notification
        await supabase.from("notifications").insert({
          user_id: transaction.wallet.user_id,
          type: "payment_success",
          title: "Top Up Successful",
          message: `Your wallet has been topped up with RM ${transaction.amount}`,
          link: "/wallet",
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            status: 'completed',
            message: 'Payment processed successfully'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Still pending
    return new Response(
      JSON.stringify({ 
        success: true, 
        status: 'pending',
        message: 'Payment is still pending'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error checking payment status:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
