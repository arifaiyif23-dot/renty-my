import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ToyyibPay webhook: handles payment confirmation
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const billCode = formData.get("billcode") || formData.get("billCode");
    const status = formData.get("status_id") || formData.get("statusId"); // 1=success, 2=pending, 3=failed
    const amount = Number(formData.get("amount")) || 0;
    const transactionId = formData.get("transaction_id") || formData.get("transactionId");
    const signature = formData.get("signature") || formData.get("hash");

    console.log("ToyyibPay webhook received:", {
      billCode,
      status,
      amount,
      transactionId,
    });

    if (!billCode || !status) {
      throw new Error("Missing required webhook data (billCode/status)");
    }

    // Create Supabase client early so it's available for all code paths
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // STATUS-BASED EARLY EXIT - only process successful payments
    if (status !== "1") {
      console.log(`Payment not successful (status: ${status}), handling accordingly`);
      
      // Still update failed payments
      if (status === "3") {
        const { data: failedTx } = await supabase
          .from("wallet_transactions")
          .select("id, wallet_id")
          .eq("toyyibpay_transaction_id", billCode)
          .single();
        
        if (failedTx) {
          await supabase.from("wallet_transactions").update({ status: "failed" }).eq("id", failedTx.id);
          
          const { data: wallet } = await supabase
            .from("wallets")
            .select("user_id")
            .eq("id", failedTx.wallet_id)
            .single();
          
          if (wallet) {
            await supabase.from("notifications").insert({
              user_id: wallet.user_id,
              type: "payment",
              title: "Payment Failed",
              message: "Your payment could not be processed. Please try again.",
              link: "/wallet",
            });
          }
        }
      }
      
      return new Response("OK", { headers: corsHeaders, status: 200 });
    }

    // SECURITY: Verify webhook signature
    const secretKey = Deno.env.get("TOYYIBPAY_SECRET_KEY");
    if (signature && secretKey) {
      const crypto = await import("https://deno.land/std@0.168.0/node/crypto.ts");
      const expectedSignature = crypto
        .createHmac("sha256", secretKey)
        .update(`${billCode}${amount}${status}`)
        .digest("hex");

      if (signature !== expectedSignature) {
        console.error("Invalid webhook signature");
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      console.log("✓ Webhook signature verified");
    }

    // Check if already processed using status column
    const { data: completedTx } = await supabase
      .from("wallet_transactions")
      .select("id, status")
      .eq("toyyibpay_transaction_id", billCode)
      .eq("status", "completed")
      .single();

    if (completedTx) {
      console.log("Duplicate webhook ignored (already completed):", billCode);
      return new Response("OK", { headers: corsHeaders, status: 200 });
    }

    // Fetch wallet transaction
    const { data: transaction, error: txError } = await supabase
      .from("wallet_transactions")
      .select("id, amount, wallet_id, toyyibpay_transaction_id")
      .eq("toyyibpay_transaction_id", billCode)
      .single();

    if (txError || !transaction) {
      console.error("Transaction not found for billCode:", billCode, txError);
      return new Response("OK", { headers: corsHeaders, status: 200 });
    }

    // AMOUNT VERIFICATION - ToyyibPay sends in cents
    const expectedAmount = Number(transaction.amount);
    const receivedAmount = amount / 100; // Convert from cents
    
    if (amount > 0 && Math.abs(expectedAmount - receivedAmount) > 0.01) {
      console.error("Amount mismatch:", {
        expected: expectedAmount,
        received: receivedAmount,
        rawAmount: amount
      });
      // Mark as failed instead of returning error
      await supabase
        .from("wallet_transactions")
        .update({ 
          status: 'failed',
        })
        .eq("id", transaction.id);
      return new Response("OK", { headers: corsHeaders, status: 200 });
    }

    // Fetch wallet separately
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("user_id")
      .eq("id", transaction.wallet_id)
      .single();

    if (walletError || !wallet) {
      console.error("Wallet not found:", walletError);
      return new Response("OK", { headers: corsHeaders, status: 200 });
    }

    const userId = wallet.user_id;

    // At this point, status is "1" (successful) due to early exit above
    // ✅ Successful payment - use atomic update
    const { data: newBalance, error: updateError } = await supabase.rpc("increment_wallet_balance", {
      p_user_id: userId,
      p_amount: Number(transaction.amount),
    });

    if (updateError) {
      console.error("Failed to update wallet:", updateError);
      throw updateError;
    }

    // Update transaction status
    await supabase
      .from("wallet_transactions")
      .update({ status: "completed" })
      .eq("id", transaction.id)
      .eq("status", "pending"); // Only update if still pending

    await supabase.from("notifications").insert({
      user_id: userId,
      type: "payment",
      title: "Top-up Successful",
      message: `RM${Number(transaction.amount).toFixed(2)} has been added to your wallet.`,
      link: "/wallet",
    });

    console.log("✅ Wallet top-up successful:", { userId, newBalance, billCode });

    return new Response("OK", { headers: corsHeaders, status: 200 });
  } catch (error) {
    console.error("🚨 Error in ToyyibPay webhook:", error);
    return new Response("OK", { headers: corsHeaders, status: 200 }); // Always OK to stop retries
  }
});
