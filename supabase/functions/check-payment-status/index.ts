import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Always return 200 OK to ToyyibPay to prevent retries
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== TOYYIBPAY WEBHOOK RECEIVED ===');
    console.log('Method:', req.method);
    console.log('Headers:', Object.fromEntries(req.headers.entries()));

    // ToyyibPay can send either formData or JSON
    let body: any = {};
    const contentType = req.headers.get('content-type') || '';
    
    try {
      if (contentType.includes('application/json')) {
        body = await req.json();
        console.log('Parsed as JSON:', body);
      } else {
        const formData = await req.formData();
        body = Object.fromEntries(formData.entries());
        console.log('Parsed as FormData:', body);
      }
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Invalid request format' 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Still return 200 to prevent retries
      });
    }

    // Extract payment details (ToyyibPay uses different field names)
    const billCode = body.billcode || body.billCode || body.BillCode;
    const status = body.status || body.status_id;
    const amount = body.amount || body.billpaymentAmount;
    const transactionId = body.transaction_id || body.fpx_fpxTxnId;
    
    console.log('Payment Details:', {
      billCode,
      status,
      amount,
      transactionId,
      rawBody: body
    });

    if (!billCode) {
      console.error('Missing billCode in callback');
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Missing billCode' 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find transaction - ToyyibPay billCode is stored in toyyibpay_transaction_id
    console.log('Looking up transaction with billCode:', billCode);
    const { data: transaction, error: txError } = await supabase
      .from("wallet_transactions")
      .select("*, wallet:wallets(user_id)")
      .eq("toyyibpay_transaction_id", billCode)
      .single();

    if (txError || !transaction) {
      console.error('Transaction not found:', txError);
      console.log('Attempting alternate lookup with status=pending');
      
      // Try to find by pending status and matching amount (last resort)
      const amountNum = parseFloat(amount) / 100; // ToyyibPay sends in cents
      const { data: pendingTx } = await supabase
        .from("wallet_transactions")
        .select("*, wallet:wallets(user_id)")
        .eq("status", "pending")
        .eq("amount", amountNum)
        .eq("type", "top_up")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!pendingTx) {
        console.error('No matching transaction found for billCode:', billCode);
        return new Response(JSON.stringify({ 
          success: false, 
          message: 'Transaction not found' 
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }
      
      // Use the found pending transaction
      console.log('Found pending transaction:', pendingTx.id);
    }

    const tx = transaction || (await supabase
      .from("wallet_transactions")
      .select("*, wallet:wallets(user_id)")
      .eq("status", "pending")
      .eq("amount", parseFloat(amount) / 100)
      .eq("type", "top_up")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()).data;

    if (!tx) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Transaction not found' 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Handle payment status
    // ToyyibPay status: 1=success, 2=pending, 3=failed
    if (status === '1') {
      console.log('✅ Payment successful for billCode:', billCode);

      // Check if already processed
      if (tx.status === 'completed') {
        console.log('Transaction already completed, skipping');
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Already processed' 
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      // Convert amount (ToyyibPay sends in cents: amount * 100)
      const amountInRM = parseFloat(amount) / 100;
      
      console.log('Crediting wallet:', {
        userId: tx.wallet.user_id,
        amount: amountInRM,
        transactionId: tx.id
      });

      // Credit wallet balance
      const { error: walletError } = await supabase.rpc("increment_wallet_balance", {
        p_user_id: tx.wallet.user_id,
        p_amount: amountInRM,
      });

      if (walletError) {
        console.error('Failed to credit wallet:', walletError);
        throw walletError;
      }

      // Mark transaction as completed
      await supabase
        .from("wallet_transactions")
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq("id", tx.id);

      // Send notification
      await supabase.from("notifications").insert({
        user_id: tx.wallet.user_id,
        type: "payment_success",
        title: "Top Up Successful",
        message: `Your wallet has been topped up with RM ${amountInRM.toFixed(2)}`,
        link: "/wallet",
      });

      console.log('✅ Payment processed successfully');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Payment processed' 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    } else if (status === '3') {
      // Payment failed
      console.log('❌ Payment failed for billCode:', billCode);
      
      await supabase
        .from("wallet_transactions")
        .update({ status: 'failed' })
        .eq("id", tx.id);

      await supabase.from("notifications").insert({
        user_id: tx.wallet.user_id,
        type: "payment_failed",
        title: "Top Up Failed",
        message: `Your wallet top up of RM ${tx.amount} failed. Please try again.`,
        link: "/wallet",
      });

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Payment failed' 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Status 2 or other = pending
    console.log('⚠️ Payment pending, status:', status);
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Payment pending' 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    // Always return 200 to prevent retries from ToyyibPay
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }
});
