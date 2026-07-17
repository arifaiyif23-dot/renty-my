import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') || 'https://renty.my',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const promoValidationSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[A-Z0-9-]+$/i),
  userId: z.string().uuid(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const validationResult = promoValidationSchema.safeParse(body);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { code, userId } = validationResult.data;

    if (userId !== user.id) {
      return new Response(
        JSON.stringify({ error: 'User ID mismatch' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: promoCode, error: promoError } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (promoError || !promoCode) {
      return new Response(
        JSON.stringify({ error: 'Invalid promo code' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (promoCode.valid_until && new Date(promoCode.valid_until) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Promo code has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (promoCode.max_uses && promoCode.current_uses >= promoCode.max_uses) {
      return new Response(
        JSON.stringify({ error: 'Promo code usage limit reached' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: existingUsage } = await supabase
      .from('user_promo_usage')
      .select('id')
      .eq('user_id', userId)
      .eq('promo_code_id', promoCode.id)
      .single();

    if (existingUsage) {
      return new Response(
        JSON.stringify({ error: 'You have already used this promo code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        valid: true,
        promoCode: {
          id: promoCode.id,
          code: promoCode.code,
          discountType: promoCode.discount_type,
          discountAmount: promoCode.discount_amount,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Promo code validation error:', error);
    return new Response(
      JSON.stringify({ error: 'Validation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
