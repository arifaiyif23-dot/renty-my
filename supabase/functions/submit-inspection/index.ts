import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') || 'https://renty.my',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized: No authorization header');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized: Invalid token');

    const { error: suspendError } = await supabase.rpc('check_user_not_suspended', { p_user_id: user.id });
    if (suspendError) throw new Error('Your account has been suspended. Contact support for assistance.');

    const { itemId, result, claimType, description, penaltyAmount, evidenceUrls } = await req.json();

    if (!itemId || !result) {
      return new Response(
        JSON.stringify({ error: 'itemId and result required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['available', 'maintenance', 'damaged', 'disputed'].includes(result)) {
      return new Response(
        JSON.stringify({ error: 'Invalid result. Must be: available, maintenance, damaged, or disputed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user owns the item
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id, owner_id, status, title')
      .eq('id', itemId)
      .single();

    if (itemError || !item) throw new Error('Item not found');
    if (item.owner_id !== user.id) throw new Error('Forbidden: Only the item owner can submit inspection');
    if (item.status !== 'inspection_pending') throw new Error(`Item is not in inspection_pending status (current: ${item.status})`);

    const { data: rpcResult, error: rpcError } = await supabase.rpc('complete_inspection', {
      p_item_id: itemId,
      p_result: result,
      p_claim_type: claimType || null,
      p_description: description || null,
      p_penalty_amount: penaltyAmount || 0,
      p_evidence_urls: evidenceUrls || [],
    });

    if (rpcError) throw rpcError;

    return new Response(
      JSON.stringify(rpcResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('submit-inspection error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const isExpected = message.startsWith('Unauthorized') || message.startsWith('Forbidden') || message.startsWith('Item') || message.startsWith('Invalid') || message.startsWith('Your account');
    return new Response(
      JSON.stringify({ error: isExpected ? message : 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
