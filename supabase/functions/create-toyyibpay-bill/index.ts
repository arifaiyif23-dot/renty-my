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
    const { amount, description, userId } = await req.json();

    if (!amount || !userId) {
      throw new Error('Amount and userId are required');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user profile and auth data for contact info
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('full_name, phone')
      .eq('id', userId)
      .single();

    // Get user email from auth
    const { data: { user: authUser } } = await supabaseClient.auth.admin.getUserById(userId);

    // Create ToyyibPay bill
    const toyyibpaySecretKey = Deno.env.get('TOYYIBPAY_SECRET_KEY');
    const toyyibpayCategoryCode = Deno.env.get('TOYYIBPAY_CATEGORY_CODE');
    
    if (!toyyibpaySecretKey || !toyyibpayCategoryCode) {
      throw new Error('ToyyibPay credentials not configured');
    }

    // Get proper return URL
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const projectId = supabaseUrl.match(/https:\/\/(.+?)\.supabase\.co/)?.[1] || '';
    const returnUrl = `https://${projectId}.lovableproject.com/wallet`;
    const callbackUrl = `${supabaseUrl}/functions/v1/toyyibpay-webhook`;

    const billData = new URLSearchParams({
      userSecretKey: toyyibpaySecretKey,
      categoryCode: toyyibpayCategoryCode,
      billName: description || 'Wallet Top Up',
      billDescription: description || 'Wallet Top Up',
      billPriceSetting: '1',
      billPayorInfo: '1',
      billAmount: (amount * 100).toString(), // Convert to sen
      billReturnUrl: returnUrl,
      billCallbackUrl: callbackUrl,
      billExternalReferenceNo: userId,
      billTo: profile?.full_name || 'User',
      billEmail: authUser?.email || 'user@renty.com',
      billPhone: profile?.phone || '0123456789',
    });

    console.log('Creating ToyyibPay bill:', {
      amount,
      userId,
      categoryCode: toyyibpayCategoryCode,
      returnUrl,
      callbackUrl,
      email: authUser?.email
    });

    const response = await fetch('https://dev.toyyibpay.com/index.php/api/createBill', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: billData.toString(),
    });

    const result = await response.json();
    console.log('ToyyibPay response:', result);

    if (result[0]?.BillCode) {
      const billCode = result[0].BillCode;
      const paymentUrl = `https://dev.toyyibpay.com/${billCode}`;

      // Create wallet transaction record
      const { data: wallet } = await supabaseClient
        .from('wallets')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (wallet) {
        await supabaseClient
          .from('wallet_transactions')
          .insert({
            wallet_id: wallet.id,
            type: 'top_up',
            amount: amount,
            description: description || 'Wallet Top Up',
            toyyibpay_transaction_id: billCode,
          });
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          billCode,
          paymentUrl 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    } else {
      throw new Error(result[0]?.msg || 'Failed to create bill');
    }
  } catch (error: any) {
    console.error('Error creating ToyyibPay bill:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});