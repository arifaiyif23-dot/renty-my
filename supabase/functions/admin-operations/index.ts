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
        JSON.stringify({ error: "Missing authorization header" }),
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
        JSON.stringify({ error: "Invalid token" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const { action, ...payload } = await req.json();

    switch (action) {
      case 'verify_identity':
        return await handleVerifyIdentity(supabase, payload, user.id);
      case 'batch_verify_identity':
        return await handleBatchVerifyIdentity(supabase, payload, user.id);
      case 'fraud_alert_action':
        return await handleFraudAlertAction(supabase, payload, user.id);
      case 'suspend_user':
        return await handleSuspendUser(supabase, payload);
      case 'unsuspend_user':
        return await handleUnsuspendUser(supabase, payload);
      case 'resolve_dispute':
        return await handleResolveDispute(supabase, payload);
      case 'toggle_promo_code':
        return await handleTogglePromoCode(supabase, payload);
      case 'create_promo_code':
        return await handleCreatePromoCode(supabase, payload);
      case 'update_platform_setting':
        return await handleUpdatePlatformSetting(supabase, payload);
      case 'process_payout':
        return await handleProcessPayout(supabase, payload);
      case 'resolve_report':
        return await handleResolveReport(supabase, payload);
      case 'cleanup_payments':
        return await handleCleanupPayments(supabase);
      case 'log_sensitive_access':
        return await handleLogSensitiveAccess(supabase, payload, user.id);
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

// --- Verification ---

async function handleVerifyIdentity(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  adminUserId: string
) {
  const { verificationId, status, rejectionReason, adminNotes, userId } = payload as {
    verificationId: string;
    status: string;
    rejectionReason?: string;
    adminNotes?: string;
    userId: string;
  };

  const isApproved = status === 'approved';
  const updateData: Record<string, unknown> = { status, reviewed_at: new Date().toISOString() };
  if (adminNotes) updateData.admin_notes = adminNotes;
  if (!isApproved && rejectionReason) updateData.rejection_reason = rejectionReason;

  const { error: verifError } = await supabase
    .from('verification_requests')
    .update(updateData)
    .eq('id', verificationId);
  if (verifError) return json({ error: verifError.message }, 500);

  if (isApproved) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ is_verified: true })
      .eq('id', userId);
    if (profileError) return json({ error: profileError.message }, 500);
  }

  await supabase.from('notifications').insert({
    user_id: userId,
    type: isApproved ? 'verification_approved' : 'verification_rejected',
    title: isApproved ? 'Identity Verified' : 'Verification Rejected',
    message: isApproved
      ? 'Your identity has been verified successfully.'
      : `Your verification was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
    link: '/verification',
  });

  await supabase.from('verification_audit_log').insert({
    verification_id: verificationId,
    action: isApproved ? 'approved' : 'rejected',
    performed_by: adminUserId,
    details: { rejection_reason: rejectionReason ?? null, admin_notes: adminNotes ?? null },
  });

  return json({ success: true });
}

async function handleBatchVerifyIdentity(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  adminUserId: string
) {
  const { ids, status, rejectionReason, adminNotes } = payload as {
    ids: string[];
    status: string;
    rejectionReason?: string;
    adminNotes?: string;
  };

  const isApproved = status === 'approved';
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = { status, reviewed_at: now, verified_by: adminUserId };
  if (!isApproved && rejectionReason) updateData.rejection_reason = rejectionReason;
  if (adminNotes) updateData.admin_notes = adminNotes;

  const { error: verifError } = await supabase
    .from('verification_requests')
    .update(updateData)
    .in('id', ids);
  if (verifError) return json({ error: verifError.message }, 500);

  if (isApproved) {
    const { data: requests, error: fetchError } = await supabase
      .from('verification_requests')
      .select('user_id')
      .in('id', ids);
    if (fetchError) return json({ error: fetchError.message }, 500);

    const userIds = [...new Set(requests.map((r: { user_id: string }) => r.user_id))];

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ is_verified: true })
      .in('id', userIds);
    if (profileError) return json({ error: profileError.message }, 500);

    const notifications = userIds.map((uid: string) => ({
      user_id: uid,
      type: 'verification_approved',
      title: 'Identity Verified',
      message: 'Your identity has been verified successfully.',
      link: '/verification',
    }));
    await supabase.from('notifications').insert(notifications);
  } else {
    const { data: requests, error: fetchError } = await supabase
      .from('verification_requests')
      .select('user_id')
      .in('id', ids);
    if (!fetchError && requests) {
      const notifications = requests.map((r: { user_id: string }) => ({
        user_id: r.user_id,
        type: 'verification_rejected',
        title: 'Verification Rejected',
        message: `Your verification was rejected${rejectionReason ? `: ${rejectionReason}` : ''}.`,
        link: '/verification',
      }));
      await supabase.from('notifications').insert(notifications);
    }
  }

  const auditLogs = ids.map((id: string) => ({
    verification_id: id,
    action: isApproved ? 'bulk_approved' : 'bulk_rejected',
    performed_by: adminUserId,
    details: { rejection_reason: rejectionReason || null, bulk_count: ids.length },
  }));
  await supabase.from('verification_audit_log').insert(auditLogs);

  return json({ success: true, count: ids.length });
}

// --- Fraud Alerts ---

async function handleFraudAlertAction(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  adminUserId: string
) {
  const { alertId, status } = payload as { alertId: string; status: string };

  const { error } = await supabase
    .from('fraud_alerts')
    .update({ status, reviewed_by: adminUserId, reviewed_at: new Date().toISOString() })
    .eq('id', alertId);

  if (error) return json({ error: error.message }, 500);
  return json({ success: true });
}

// --- User Suspension ---

async function handleSuspendUser(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const { userId, reason } = payload as { userId: string; reason: string };

  const { error } = await supabase
    .from('profiles')
    .update({
      is_suspended: true,
      suspended_at: new Date().toISOString(),
      suspension_reason: reason,
    })
    .eq('id', userId);

  if (error) return json({ error: error.message }, 500);
  return json({ success: true });
}

async function handleUnsuspendUser(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const { userId } = payload as { userId: string };

  const { error } = await supabase
    .from('profiles')
    .update({ is_suspended: false, suspended_at: null, suspension_reason: null })
    .eq('id', userId);

  if (error) return json({ error: error.message }, 500);
  return json({ success: true });
}

// --- Disputes ---

async function handleResolveDispute(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const { disputeId, resolutionNotes, resolutionAmount, resolutionSplit, rentalId } = payload as {
    disputeId: string;
    resolutionNotes?: string;
    resolutionAmount?: number;
    resolutionSplit?: Record<string, unknown>;
    rentalId: string;
  };

  const { error: disputeError } = await supabase
    .from('disputes')
    .update({
      status: 'resolved',
      resolution_notes: resolutionNotes || null,
      resolution_amount: resolutionAmount || null,
      resolution_split: resolutionSplit || null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', disputeId);

  if (disputeError) return json({ error: disputeError.message }, 500);

  const { error: rentalError } = await supabase
    .from('rentals')
    .update({ is_disputed: false, status: 'completed' })
    .eq('id', rentalId);

  if (rentalError) return json({ error: rentalError.message }, 500);

  return json({ success: true });
}

// --- Promo Codes ---

async function handleTogglePromoCode(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const { id, isActive } = payload as { id: string; isActive: boolean };

  const { error } = await supabase
    .from('promo_codes')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) return json({ error: error.message }, 500);
  return json({ success: true });
}

async function handleCreatePromoCode(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const { code, discountAmount, discountType, maxUses, validFrom, validUntil } = payload as {
    code: string;
    discountAmount: number;
    discountType: string;
    maxUses?: number;
    validFrom?: string;
    validUntil?: string;
  };

  const { data, error } = await supabase
    .from('promo_codes')
    .insert({
      code,
      discount_amount: discountAmount,
      discount_type: discountType,
      max_uses: maxUses || null,
      valid_from: validFrom || null,
      valid_until: validUntil || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);
  return json({ success: true, data });
}

// --- Platform Settings ---

async function handleUpdatePlatformSetting(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const { key, value } = payload as { key: string; value: string };

  const { error } = await supabase
    .from('platform_settings')
    .update({ value, updated_at: new Date().toISOString() })
    .eq('key', key);

  if (error) return json({ error: error.message }, 500);
  return json({ success: true });
}

// --- Payouts ---

async function handleProcessPayout(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const { payoutId, status, transactionReference, failureReason } = payload as {
    payoutId: string;
    status: string;
    transactionReference?: string;
    failureReason?: string;
  };

  const updateData: Record<string, unknown> = { status, processed_at: new Date().toISOString() };
  if (transactionReference) updateData.transaction_reference = transactionReference;
  if (failureReason) updateData.failure_reason = failureReason;

  const { error } = await supabase
    .from('payouts')
    .update(updateData)
    .eq('id', payoutId);

  if (error) return json({ error: error.message }, 500);
  return json({ success: true });
}

// --- Reports ---

async function handleResolveReport(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const { reportId, status, resolutionNote } = payload as {
    reportId: string;
    status: string;
    resolutionNote?: string;
  };

  const { error } = await supabase
    .from('reports')
    .update({ status, resolution_note: resolutionNote || null })
    .eq('id', reportId);

  if (error) return json({ error: error.message }, 500);
  return json({ success: true });
}

// --- Cleanup ---

async function handleCleanupPayments(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase.rpc('cleanup_expired_payments');
  if (error) return json({ error: error.message }, 500);
  return json({ success: true, data });
}

// --- Sensitive Access Log ---

async function handleLogSensitiveAccess(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  adminUserId: string
) {
  const { resourceType, resourceId } = payload as {
    resourceType: string;
    resourceId: string;
  };

  const { error } = await supabase.from('sensitive_data_access_log').insert({
    user_id: adminUserId,
    resource_type: resourceType,
    resource_id: resourceId,
    access_type: 'admin_view',
  });

  if (error) return json({ error: error.message }, 500);
  return json({ success: true });
}
