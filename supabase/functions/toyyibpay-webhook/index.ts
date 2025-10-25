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

    console.log("ToyyibPay webhook received:", {
      billCode,
      status,
      amount,
      transactionId,
    });

    if (!billCode || !status) {
      throw new Error("Missing required webhook data (billCode/status)");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch wallet transaction with related wallet
    const { data: transaction, error: txError } = await supabase
      .from("wallet_transactions")
      .select("id, amount, wallet_id, toyyibpay_transaction_id")
      .eq("toyyibpay_transaction_id", billCode)
      .single();

    if (txError || !transaction) {
      console.error("Transaction not found for billCode:", billCode, txError);
      return new Response("OK", { headers: corsHeaders, status: 200 });
    }

    // Fetch wallet separately
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("user_id, balance")
      .eq("id", transaction.wallet_id)
      .single();

    if (walletError || !wallet) {
      console.error("Wallet not found:", walletError);
      return new Response("OK", { headers: corsHeaders, status: 200 });
    }

    const userId = wallet.user_id;
    const currentBalance = Number(wallet.balance) || 0;

    // Check if already processed (using amount as indicator - transaction.status doesn't exist yet)
    // We'll check if this transaction was already completed by checking the wallet balance change
    const { data: existingTx } = await supabase
      .from("wallet_transactions")
      .select("id")
      .eq("toyyibpay_transaction_id", billCode)
      .eq("type", "top_up")
      .single();
    
    if (existingTx && currentBalance >= Number(transaction.amount)) {
      console.log("Duplicate webhook ignored (already processed):", billCode);
      return new Response("OK", { headers: corsHeaders, status: 200 });
    }

    if (status === "1") {
      // ✅ Successful payment
      const newBalance = currentBalance + Number(transaction.amount);

      await supabase.from("wallets").update({ balance: newBalance }).eq("user_id", userId);
      await supabase.from("wallet_transactions").update({ status: "completed" }).eq("id", transaction.id);

      await supabase.from("notifications").insert({
        user_id: userId,
        type: "payment",
        title: "Top-up Successful",
        message: `RM${transaction.amount.toFixed(2)} has been added to your wallet.`,
        link: "/wallet",
      });

      console.log("✅ Wallet top-up successful:", { userId, newBalance, billCode });
    } else if (status === "3") {
      // ❌ Failed payment
      await supabase.from("wallet_transactions").update({ status: "failed" }).eq("id", transaction.id);

      await supabase.from("notifications").insert({
        user_id: userId,
        type: "payment",
        title: "Payment Failed",
        message: "Your payment could not be processed. Please try again.",
        link: "/wallet",
      });

      console.log("❌ Payment failed:", { userId, billCode });
    } else {
      // Pending or unknown
      console.log("ℹ️ Payment pending/unhandled:", { billCode, status });
    }

    return new Response("OK", { headers: corsHeaders, status: 200 });
  } catch (error) {
    console.error("🚨 Error in ToyyibPay webhook:", error);
    return new Response("OK", { headers: corsHeaders, status: 200 }); // Always OK to stop retries
  }
});
