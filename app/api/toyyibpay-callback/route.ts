// toyyibpay-callback - Deno / Supabase-compatible
// Minimal, robust, idempotent handler for ToyyibPay callbacks.
// - Accepts GET or POST (form-urlencoded / json / multipart)
// - Finds wallet_transaction by toyyibpay_transaction_id (billCode)
// - Fallback: find latest pending top_up with matching amount
// - Uses Supabase service role key to update DB and call RPC increment_wallet_balance
// - Always returns 200 to ToyyibPay (prevents retries), but logs errors for debugging
//
// ENV expected:
// SUPABASE_URL
// SUPABASE_SERVICE_ROLE_KEY
// OPTIONAL: TOYYIBPAY_SECRET_KEY (if you want to add signature verification later)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const webhookSchema = z
  .object({
    billcode: z.string().min(1).optional(),
    billCode: z.string().min(1).optional(),
    BillCode: z.string().min(1).optional(),
    status: z.union([z.string(), z.number()]).optional(),
    status_id: z.union([z.string(), z.number()]).optional(),
    amount: z.union([z.string(), z.number()]).optional(),
    billpaymentAmount: z.union([z.string(), z.number()]).optional(),
    transaction_id: z.string().optional(),
    order_id: z.string().optional(),
    // accept everything else too, don't throw on unknown fields
  })
  .passthrough();

function safeNum(v: any): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (Number.isFinite(n)) return n;
  return null;
}

function normalizeAmount(amountRaw: any): number | null {
  // Toyyibpay might send cents (e.g., 100 = RM1) or RM (1.00)
  // Heuristics:
  // - if value >= 1000 assume it's cents (divide by 100)
  // - if value is integer and > 100 then treat as cents
  // - else assume it's RM
  const n = safeNum(amountRaw);
  if (n === null) return null;
  if (n > 1000) return n / 100;
  // If it's integer and > 100, likely cents
  if (Number.isInteger(n) && n > 100) return n / 100;
  // otherwise already RM
  return n;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    let body: Record<string, any> = {};

    // parse incoming payload (GET query, JSON body, or form data)
    if (req.method === "GET") {
      const url = new URL(req.url);
      url.searchParams.forEach((v, k) => (body[k] = v));
    } else {
      // POST/PUT
      if (contentType.includes("application/json")) {
        try {
          body = await req.json();
        } catch {
          body = {};
        }
      } else {
        // form-data or urlencoded
        try {
          const form = await req.formData();
          body = Object.fromEntries(form.entries());
        } catch {
          // fallback: try to parse text and urlsearchparams
          const txt = await req.text();
          try {
            const params = new URLSearchParams(txt);
            body = Object.fromEntries(params.entries());
          } catch {
            body = {};
          }
        }
      }
    }

    console.log("[toyyib-callback] incoming", {
      method: req.method,
      contentType,
      bodySample: Object.keys(body).slice(0, 10),
    });

    // basic validation
    const parsed = webhookSchema.safeParse(body);
    if (!parsed.success) {
      console.warn("[toyyib-callback] payload failed schema:", parsed.error?.message);
      // respond 200 - ToyyibPay will stop retries; we still log for debugging
      return new Response(JSON.stringify({ success: false, error: "invalid payload" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const p = parsed.data;

    const billCode = p.billcode || p.billCode || p.BillCode || null;
    const statusRaw = p.status_id ?? p.status ?? null;
    const transactionId = p.transaction_id ?? p.fpx_fpxTxnId ?? p.order_id ?? null;
    const amountRaw = p.amount ?? p.billpaymentAmount ?? null;
    const statusStr = String(statusRaw ?? "").trim();

    // determine payment status: Toyyibpay doc: 1 = success, 2 = pending, 3 = failed
    const isSuccess = statusStr === "1" || statusStr === "1.0";
    const isFailed = statusStr === "3" || statusStr === "3.0";

    // Connect Supabase as service
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[toyyib-callback] missing supabase env");
      return new Response(JSON.stringify({ success: false, error: "server misconfigured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find transaction by billCode first
    let tx: any = null;
    if (billCode) {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*, wallet:wallets(user_id)")
        .eq("toyyibpay_transaction_id", billCode)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[toyyib-callback] db lookup error by billCode:", error);
      } else {
        tx = data || null;
      }
    }

    // Fallback: match by most recent pending top_up with same amount
    if (!tx) {
      const normalized = normalizeAmount(amountRaw);
      if (normalized === null) {
        console.warn("[toyyib-callback] missing amount and no billCode, cannot match");
        return new Response(JSON.stringify({ success: false, error: "transaction not found" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: pendingData, error: pendErr } = await supabase
        .from("wallet_transactions")
        .select("*, wallet:wallets(user_id)")
        .eq("status", "pending")
        .eq("type", "top_up")
        .eq("amount", normalized)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendErr) {
        console.error("[toyyib-callback] db lookup fallback error:", pendErr);
      } else {
        tx = pendingData || null;
      }
    }

    if (!tx) {
      console.warn("[toyyib-callback] transaction not found after attempts");
      return new Response(JSON.stringify({ success: false, error: "transaction not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: if already completed, return success
    if (tx.status === "completed" || tx.status === "paid" || tx.status === "success") {
      console.log("[toyyib-callback] already processed tx:", tx.id);
      return new Response(JSON.stringify({ success: true, message: "already processed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process status
    if (isSuccess) {
      // amount conversion
      const amountRM = normalizeAmount(amountRaw) ?? Number(tx.amount || 0);

      // update wallet balance via RPC (atomic on DB side)
      const { error: rpcError } = await supabase.rpc("increment_wallet_balance", {
        p_user_id: tx.wallet?.user_id ?? tx.user_id,
        p_amount: amountRM,
      });

      if (rpcError) {
        console.error("[toyyib-callback] rpc increment failed:", rpcError);
        // still return 200 to Toyyibpay
        return new Response(JSON.stringify({ success: false, error: "failed to credit wallet" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // mark tx as completed and attach transaction id from provider
      const { error: updErr } = await supabase
        .from("wallet_transactions")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          provider_transaction_id: transactionId ?? null,
        })
        .eq("id", tx.id);

      if (updErr) {
        console.error("[toyyib-callback] failed to update tx row:", updErr);
      }

      // send notification (best-effort)
      try {
        await supabase.from("notifications").insert({
          user_id: tx.wallet?.user_id ?? tx.user_id,
          type: "payment_success",
          title: "Top Up Successful",
          message: `Your wallet has been topped up with RM ${amountRM.toFixed(2)}`,
          link: "/wallet",
        });
      } catch (nerr) {
        console.warn("[toyyib-callback] notification failed:", nerr);
      }

      console.log("[toyyib-callback] processed success:", { txId: tx.id, user: tx.wallet?.user_id, amountRM });
      return new Response(JSON.stringify({ success: true, message: "processed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (isFailed) {
      // mark failed
      try {
        await supabase.from("wallet_transactions").update({ status: "failed" }).eq("id", tx.id);
        await supabase.from("notifications").insert({
          user_id: tx.wallet?.user_id ?? tx.user_id,
          type: "payment_failed",
          title: "Top Up Failed",
          message: `Your wallet top up of RM ${tx.amount} failed.`,
          link: "/wallet",
        });
      } catch (err) {
        console.error("[toyyib-callback] fail-update error:", err);
      }

      console.log("[toyyib-callback] processed failed:", { txId: tx.id });
      return new Response(JSON.stringify({ success: true, message: "failed recorded" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // pending or unknown
      console.log("[toyyib-callback] pending/unknown status:", { status: statusStr });
      return new Response(JSON.stringify({ success: true, message: "pending" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("[toyyib-callback] unexpected error:", err);
    return new Response(JSON.stringify({ success: false, error: "internal error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
