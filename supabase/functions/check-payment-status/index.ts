import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema for webhook
const webhookSchema = z.object({
  billcode: z.string().min(1).optional(),
  billCode: z.string().min(1).optional(),
  status: z.union([z.string(), z.number()]).optional(),
  status_id: z.union([z.string(), z.number()]).optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  transaction_id: z.string().optional(),
  order_id: z.string().optional(),
}).passthrough();

// Verify ToyyibPay signature
async function verifyToyyibPaySignature(body: any, signature: string | null, secretKey: string): Promise<boolean> {
  if (!signature) {
    return false;
  }

  try {
    // ToyyibPay uses MD5 hash of concatenated values
    const billCode = body.billcode || body.billCode || '';
    const statusId = body.status_id || body.status || '';
    const amount = body.amount || '';
    const orderId = body.order_id || body.transaction_id || '';
    
    // Create signature string: billcode+status_id+amount+order_id+secretkey
    const signatureString = `${billCode}${statusId}${amount}${orderId}${secretKey}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureString);
    const hashBuffer = await crypto.subtle.digest("MD5", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const calculatedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return calculatedSignature === signature;
  } catch (error) {
    return false;
  }
}

serve(async (req) => {
  // Always return 200 OK to ToyyibPay to prevent retries
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ToyyibPay can send either formData or JSON
    let body: any = {};
    const contentType = req.headers.get('content-type') || '';
    
    console.log('Payment callback received:', { 
      method: req.method, 
      contentType,
      url: req.url 
    });
    
    try {
      if (contentType.includes('application/json')) {
        body = await req.json();
      } else {
        const formData = await req.formData();
        body = Object.fromEntries(formData.entries());
      }
      console.log('Callback body:', body);
    } catch (parseError) {
      console.error('Failed to parse callback:', parseError);
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Invalid request format' 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Still return 200 to prevent retries
      });
    }

    // Validate input structure
    const validationResult = webhookSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid payload' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify webhook signature
    const toyyibpaySecretKey = Deno.env.get('TOYYIBPAY_SECRET_KEY');
    if (!toyyibpaySecretKey) {
      return new Response(JSON.stringify({ success: false, error: 'Configuration error' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const signature = req.headers.get('x-signature') || body.signature;
    const isValidSignature = await verifyToyyibPaySignature(body, signature, toyyibpaySecretKey);
    
    if (!isValidSignature) {
      // Still return 200 to prevent retries, but don't process
      return new Response(JSON.stringify({ success: false, error: 'Invalid signature' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract payment details (ToyyibPay uses different field names)
    const billCode = body.billcode || body.billCode || body.BillCode;
    const status = body.status || body.status_id;
    const amount = body.amount || body.billpaymentAmount;
    const transactionId = body.transaction_id || body.fpx_fpxTxnId;

    if (!billCode) {
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
    const { data: transaction, error: txError } = await supabase
      .from("wallet_transactions")
      .select("*, wallet:wallets(user_id)")
      .eq("toyyibpay_transaction_id", billCode)
      .single();

    if (txError || !transaction) {
      // Try to find by pending status and matching amount (last resort)
      const amountNum = parseFloat(amount) / 100; // ToyyibPay sends in cents
      const { data: pendingTx } = await supabase
        .from("wallet_transactions")
        .select("*, wallet:wallets(user_id)")
        .eq("status", "pending")
        .eq("amount", amountNum)
        .eq("type", "deposit")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!pendingTx) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: 'Transaction not found' 
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }
    }

    const tx = transaction || (await supabase
      .from("wallet_transactions")
      .select("*, wallet:wallets(user_id)")
      .eq("status", "pending")
      .eq("amount", parseFloat(amount) / 100)
      .eq("type", "deposit")
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
      // Check if already processed
      if (tx.status === 'completed') {
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

    // Credit wallet balance
    const { error: walletError } = await supabase.rpc("increment_wallet_balance", {
      p_user_id: tx.wallet.user_id,
      p_amount: amountInRM,
    });

    if (walletError) {
      console.error('Wallet increment failed:', walletError);
      throw walletError;
    }

    // Mark transaction as completed
    const { error: updateError } = await supabase
      .from("wallet_transactions")
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq("id", tx.id);
      
    if (updateError) {
      console.error('Transaction update failed:', updateError);
    }

    console.log('Payment processed successfully:', { 
      txId: tx.id, 
      userId: tx.wallet.user_id, 
      amount: amountInRM 
    });

      // Send notification
      await supabase.from("notifications").insert({
        user_id: tx.wallet.user_id,
        type: "payment_success",
        title: "Top Up Successful",
        message: `Your wallet has been topped up with RM ${amountInRM.toFixed(2)}`,
        link: "/wallet",
      });

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Payment processed' 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    } else if (status === '3') {
      // Payment failed
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
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Payment pending' 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    // Always return 200 to prevent retries from ToyyibPay
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Webhook processing failed'
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }
});
