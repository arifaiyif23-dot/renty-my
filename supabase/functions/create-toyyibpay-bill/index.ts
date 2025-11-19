import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Note: Dynamic validation happens after fetching platform settings
const topUpSchema = z.object({
  amount: z.number().positive().finite(),
  description: z.string().max(500).optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract user from JWT token, not request body
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      throw new Error("Unauthorized - invalid token");
    }

    const userId = user.id; // Always use authenticated user's ID

    // Use service role for database operations
    const supabaseServiceClient = createClient(
      Deno.env.get("SUPABASE_URL")?.trim() ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? ""
    );

    // Parse and validate input
    const body = await req.json();
    const validationResult = topUpSchema.safeParse(body);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid input parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { amount, description = 'Wallet Top-Up' } = validationResult.data;
    
    // Get dynamic constraints from platform settings
    const { data: minTopupData } = await supabaseServiceClient
      .rpc('get_platform_setting', { setting_key: 'min_topup_amount' });
    const { data: maxTopupData } = await supabaseServiceClient
      .rpc('get_platform_setting', { setting_key: 'max_topup_amount' });
    
    const minTopup = minTopupData || 1;
    const maxTopup = maxTopupData || 10000;
    
    // Validate against dynamic constraints
    if (amount < minTopup) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Minimum top-up amount is RM ${minTopup.toFixed(2)}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (amount > maxTopup) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Maximum top-up amount is RM ${maxTopup.toFixed(2)}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Additional validation for decimal places
    if (!Number.isInteger(amount * 100)) {
      throw new Error('Amount must have at most 2 decimal places');
    }

    // Get user details
    const { data: profile } = await supabaseServiceClient
      .from("profiles")
      .select("full_name, phone")
      .eq("id", userId)
      .single();

    const { data: { user: authUser } } = await supabaseServiceClient.auth.admin.getUserById(userId);

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
    const callbackUrl = `${supabaseUrl}/functions/v1/check-payment-status`;

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
      throw new Error("ToyyibPay API returned invalid response");
    }

    if (Array.isArray(result) && result[0]?.BillCode) {
      const billCode = result[0].BillCode;
      const paymentUrl = `https://toyyibpay.com/${billCode}`;

      // Save transaction
      const { data: wallet } = await supabaseServiceClient
        .from("wallets")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (wallet) {
        await supabaseServiceClient.from("wallet_transactions").insert({
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
      throw new Error(result[0]?.msg || "Failed to create ToyyibPay bill");
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Payment processing failed"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
