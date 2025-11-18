import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const withdrawalActionSchema = z.object({
  withdrawalId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  notes: z.string().optional(),
  rejectionReason: z.string().optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin access
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: isAdmin } = await supabaseServiceClient
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (!isAdmin) {
      throw new Error('Admin access required');
    }

    const body = await req.json();
    const { withdrawalId, action, notes, rejectionReason } = withdrawalActionSchema.parse(body);

    console.log(`Processing withdrawal ${withdrawalId} - Action: ${action}`);

    // Get withdrawal request
    const { data: withdrawal, error: withdrawalError } = await supabaseServiceClient
      .from('withdrawal_requests')
      .select('*, profiles!inner(full_name, avatar_url)')
      .eq('id', withdrawalId)
      .single();

    if (withdrawalError || !withdrawal) {
      throw new Error('Withdrawal request not found');
    }

    if (withdrawal.status !== 'pending') {
      throw new Error(`Withdrawal already ${withdrawal.status}`);
    }

    // Get user wallet
    const { data: wallet, error: walletError } = await supabaseServiceClient
      .from('wallets')
      .select('*')
      .eq('user_id', withdrawal.user_id)
      .single();

    if (walletError || !wallet) {
      throw new Error('Wallet not found');
    }

    if (action === 'approve') {
      // Get withdrawal processing fee
      const { data: processingFeeData } = await supabaseServiceClient
        .rpc('get_platform_setting', { setting_key: 'withdrawal_processing_fee' });
      
      const processingFee = processingFeeData || 0;
      const totalDeduction = Number(withdrawal.amount) + Number(processingFee);

      // Check sufficient balance
      if (wallet.balance < totalDeduction) {
        throw new Error('Insufficient balance for withdrawal');
      }

      // Deduct from wallet using RPC
      const { data: deductResult, error: deductError } = await supabaseServiceClient
        .rpc('deduct_wallet_balance', {
          p_user_id: withdrawal.user_id,
          p_amount: totalDeduction,
          p_idempotency_key: `withdrawal_${withdrawalId}`
        });

      if (deductError || !deductResult?.success) {
        console.error('Wallet deduction failed:', deductError || deductResult);
        throw new Error(deductResult?.error || 'Failed to deduct from wallet');
      }

      // Record wallet transaction
      const { error: txError } = await supabaseServiceClient
        .from('wallet_transactions')
        .insert({
          wallet_id: wallet.id,
          type: 'withdrawal',
          amount: -totalDeduction,
          description: `Withdrawal to ${withdrawal.bank_name} (${withdrawal.account_number?.slice(-4)})${processingFee > 0 ? ` + RM${processingFee} processing fee` : ''}`,
          status: 'completed',
          reference_id: withdrawalId,
          idempotency_key: `withdrawal_${withdrawalId}`
        });

      if (txError) {
        console.error('Transaction recording failed:', txError);
        // Try to refund
        await supabaseServiceClient.rpc('refund_wallet_balance', {
          p_user_id: withdrawal.user_id,
          p_amount: totalDeduction,
          p_reason: 'Withdrawal processing failed'
        });
        throw new Error('Failed to record transaction');
      }

      // Update withdrawal status
      const { error: updateError } = await supabaseServiceClient
        .from('withdrawal_requests')
        .update({
          status: 'approved',
          processed_by: user.id,
          processed_at: new Date().toISOString(),
          notes: notes || 'Approved by admin'
        })
        .eq('id', withdrawalId);

      if (updateError) {
        console.error('Status update failed:', updateError);
        throw new Error('Failed to update withdrawal status');
      }

      console.log(`✅ Withdrawal ${withdrawalId} approved. Deducted RM${totalDeduction}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Withdrawal approved successfully',
          deducted: totalDeduction,
          processingFee
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'reject') {
      // Update withdrawal status to rejected
      const { error: updateError } = await supabaseServiceClient
        .from('withdrawal_requests')
        .update({
          status: 'rejected',
          processed_by: user.id,
          processed_at: new Date().toISOString(),
          rejection_reason: rejectionReason || 'Rejected by admin',
          notes: notes || 'Rejected by admin'
        })
        .eq('id', withdrawalId);

      if (updateError) {
        console.error('Status update failed:', updateError);
        throw new Error('Failed to update withdrawal status');
      }

      console.log(`❌ Withdrawal ${withdrawalId} rejected`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Withdrawal rejected successfully'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Error processing withdrawal:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});