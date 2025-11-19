import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const topUpSchema = z.object({
  amount: z.number().positive().finite(),
  description: z.string().max(500).optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized - invalid token");
    const userId = user.id;

    const supabaseServiceClient = createClient(
      Deno.env.get("SUPABASE_URL")?.trim() ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? ""
    );

    const body = await req.json();
    const validationResult = topUpSchema.safeParse(body);
    if (!validationResult.success) return new Response(JSON.stringify({ success: false, error: 'Invalid input parameters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { amount, description = 'Wallet Top-Up' } = validationResult.data;

    const { data: minTopupData } = await supabaseServiceClient.rpc('get_platform_setting', { setting_key: 'min_topup_amount' });
    const { data: maxTopupData } = await supabaseServiceClient.rpc('get_platform_setting', { setting_key: 'max_topup_amount' });
    const minTopup = minTopupData || 1;
    const maxTopup = maxTopupData || 10000;

    if (amount < minTopup) return new Response(JSON.stringify({ success: false, error: `Minimum top-up amount is RM ${minTopup.toFixed(2)}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (amount > maxTopup) return new Response(JSON.stringify({ success: false, error: `Maximum top-up amount is RM ${maxTopup.toFixed(2)}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!Number.isInteger(amount * 100)) throw new Error('Amount must have at most 2 decimal places');

    const { data: profile } = await supabaseServiceClient.from("profiles").select("full_name, phone").eq("id", userId).single();
    const { data: { user: authUser } } = await supabaseServiceClient.auth.admin.getUserById(userId);

    const toyyibpaySecretKey = Deno.env.get("TOYYIBPAY_SECRET_KEY")?.trim();
    const toyyibpayCategoryCode = Deno.env.get("TOYYIBPAY_CATEGORY_CODE")?.trim();
    if (!toyyibpaySecretKey || !toyyibpayCategoryCode) throw new Error("ToyyibPay credentials not configured");

    const returnUrl = `${Deno.env.get("FRONTEND_URL") ?? 'https://renty.lovable.app'}/wallet`;
    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/check-payment-status?userId=${userId}`;

    const billData = new URLSearchParams({
      userSecretKey: toyyibpaySecretKey,
      categoryCode: toyyibpayCategoryCode,
      billName: description,
      billDescription: description,
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

    const response = await fetch("https://toyyibpay.com/index.php/api/createBill", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: billData.toString(),
    });

    const result = await response.json();

    if (Array.isArray(result) && result[0]?.BillCode) {
      const billCode = result[0].BillCode;
      const paymentUrl = `https://toyyibpay.com/${billCode}`;

      const { data: wallet } = await supabaseServiceClient.from("wallets").select("id").eq("user_id", userId).single();
      if (wallet) await supabaseServiceClient.from("wallet_transactions").insert({ wallet_id: wallet.id, type: "top_up", amount, description, toyyibpay_transaction_id: billCode });

      return new Response(JSON.stringify({ success: true, billCode, paymentUrl }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else throw new Error(result[0]?.msg || "Failed to create ToyyibPay bill");

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message || "Payment processing failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

