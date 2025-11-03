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
    if (!authHeader) {
      return new Response(
        JSON.stringify({ valid: false, error: "Missing authorization" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ valid: false, error: "Unauthorized" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { code, rentalAmount } = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ valid: false, error: "Promo code required" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check rate limit (max 5 attempts per 5 minutes)
    const { data: canAttempt } = await supabaseServiceClient
      .rpc('check_promo_rate_limit', { p_user_id: user.id });

    if (!canAttempt) {
      console.log(`Rate limit exceeded for user ${user.id}`);
      
      // Log failed attempt
      await supabaseServiceClient.from('promo_attempt_log').insert({
        user_id: user.id,
        promo_code: code.toUpperCase(),
        success: false,
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
      });

      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "Too many attempts. Please try again in a few minutes." 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch promo code
    const { data: promo, error: promoError } = await supabaseServiceClient
      .from('promo_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();

    // Log attempt
    await supabaseServiceClient.from('promo_attempt_log').insert({
      user_id: user.id,
      promo_code: code.toUpperCase(),
      success: !!promo,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
    });

    if (promoError || !promo) {
      console.log(`Invalid promo code: ${code}`);
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid promo code" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check validity period
    const now = new Date();
    if (promo.valid_from && new Date(promo.valid_from) > now) {
      return new Response(
        JSON.stringify({ valid: false, error: "Promo code not yet active" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (promo.valid_until && new Date(promo.valid_until) < now) {
      return new Response(
        JSON.stringify({ valid: false, error: "Promo code expired" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check usage limit
    if (promo.max_uses && promo.current_uses >= promo.max_uses) {
      return new Response(
        JSON.stringify({ valid: false, error: "Promo code fully redeemed" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already used this code
    const { data: existingUsage } = await supabaseServiceClient
      .from('user_promo_usage')
      .select('id')
      .eq('user_id', user.id)
      .eq('promo_code_id', promo.id)
      .single();

    if (existingUsage) {
      return new Response(
        JSON.stringify({ valid: false, error: "You've already used this promo code" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate discount
    let discountAmount = 0;
    if (promo.discount_type === 'percentage') {
      discountAmount = (rentalAmount * promo.discount_amount) / 100;
    } else if (promo.discount_type === 'fixed') {
      discountAmount = Math.min(promo.discount_amount, rentalAmount);
    }

    console.log(`Valid promo code: ${code}, discount: RM${discountAmount.toFixed(2)}`);

    return new Response(
      JSON.stringify({
        valid: true,
        promoId: promo.id,
        discountType: promo.discount_type,
        discountAmount: promo.discount_amount,
        calculatedDiscount: discountAmount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error validating promo code:', error);
    return new Response(
      JSON.stringify({ 
        valid: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
