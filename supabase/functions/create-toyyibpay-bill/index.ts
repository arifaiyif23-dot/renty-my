import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, description, userId } = await req.json();

    if (!amount || !userId) {
      throw new Error("Amount and userId are required");
    }

    // Setup Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")?.trim() ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? ""
    );

    // Get user details
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("full_name, phone")
      .eq("id", userId)
      .single();

    const { data: { user: authUser } } = await supabaseClient.auth.admin.getUserById(userId);

    // ToyyibPay credentials
    const toyyibpaySecretKey = Deno.env.get("TOYYIBPAY_SECRET_KEY")?.trim();
    const toyyibpayCategoryCode = Deno.env.get("TOYYIBPAY_CATEGORY_CODE")?.trim();

    if (!toyyibpaySecretKey || !toyyibpayCategoryCode) {
      throw new Error("ToyyibPay credentials not configured");
    }

    // Build callback and return URLs
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() || "";
    const projectId = supabaseUrl.match(/https:\/\/(.+?)\.supabase\.co/)?.[1] || "";
    const returnUrl = `https://${projectId}.lovableproject.com/wallet`;
    const callbackUrl = `${supabaseUrl}/functions/v1/toyyibpay-webhook`;

    // Prepare form data for ToyyibPay API
    const billData = new URLSearchParams({
      userSecretKey: toyyibpaySecretKey,
      categoryCode: toyyibpayCategoryCode,
      billName: description || "Wallet Top Up",
      billDescription: description || "Wallet Top Up",
      billPriceSetting: "1",
      billPayorInfo: "1",
      billAmount: Math.round(amount * 100).toString(),
      billReturnUrl: returnUrl,
      billCallbackUrl: callbackUrl,
      billExternalReferenceNo: userId,
      billTo: profile?.full_name || "User",
      billEmail: authUser?.email || "user@renty.com",
      billPhone: profile?.phone || "0123456789",
    });

    console.log("Creating ToyyibPay bill:", {
      amount,
      userId,
      categoryCode: toyyibpayCategoryCode,
      returnUrl,
      callbackUrl,
      email: authUser?.email,
    });

    // Make request to ToyyibPay PRODUCTION endpoint
    const response = await fetch("https://toyyibpay.com/index.php/api/createBill", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: billData.toString(),
    });

    const textResult = await response.text();
    let result;
    try {
      result = JSON.parse(textResult);
    } catch {
      console.error("Invalid JSON response from ToyyibPay:", textResult);
      throw new Error("ToyyibPay API returned invalid response");
    }

    console.log("ToyyibPay response:", result);

    if (Array.isArray(result) && result[0]?.BillCode) {
      const billCode = result[0].BillCode;
      const paymentUrl = `https://toyyibpay.com/${billCode}`;

      // Save transaction
      const { data: wallet } = await supabaseClient
        .from("wallets")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (wallet) {
        await supabaseClient.from("wallet_transactions").insert({
          wallet_id: wallet.id,
          type: "top_up",
          amount: amount,
          description: description || "Wallet Top Up",
          toyyibpay_transaction_id: billCode,
        });
      }

      return new Response(
        JSON.stringify({ success: true, billCode, paymentUrl }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } else {
      console.error("ToyyibPay error:", result);
      throw new Error(result[0]?.msg || "Failed to create ToyyibPay bill");
    }
  } catch (error) {
    console.error("Error creating ToyyibPay bill:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to create bill" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
