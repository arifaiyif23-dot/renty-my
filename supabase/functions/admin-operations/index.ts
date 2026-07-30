import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') || 'https://renty.my',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACTION_PERMISSIONS: Record<string, string> = {
  verify_identity: 'verification.verify',
  batch_verify_identity: 'verification.batch_verify',
  fraud_alert_action: 'fraud.manage',
  suspend_user: 'user.suspend',
  unsuspend_user: 'user.suspend',
  resolve_dispute: 'disputes.resolve',
  toggle_promo_code: 'promos.manage',
  create_promo_code: 'promos.manage',
  update_platform_setting: 'settings.manage',
  process_payout: 'payouts.process',
  resolve_report: 'reports.resolve',
  cleanup_payments: 'payments.cleanup',
  log_sensitive_access: 'admin.logs',
};

const ADMIN_MANAGEMENT_ACTIONS = [
  'assign_admin_role',
  'update_admin_permissions',
  'remove_admin_role',
  'list_admins',
];

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
      .in('role', ['admin', 'super_admin', 'moderator'])
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const isSuperAdmin = roleData.role === 'super_admin';
    const { action, ...payload } = await req.json();

    if (ADMIN_MANAGEMENT_ACTIONS.includes(action) && !isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: "Only super admins can manage admin roles" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    if (!isSuperAdmin) {
      const requiredPermission = ACTION_PERMISSIONS[action];
      if (requiredPermission) {
        const { data: permData } = await supabase
          .from('admin_permissions')
          .select('permission')
          .eq('user_id', user.id)
          .eq('permission', requiredPermission)
          .maybeSingle();

        if (!permData) {
          return new Response(
            JSON.stringify({ error: "You don't have permission for this action" }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
          );
        }
      }
    }

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
      case 'assign_admin_role':
        return await handleAssignAdminRole(supabase, payload, user.id);
      case 'update_admin_permissions':
        return await handleUpdateAdminPermissions(supabase, payload);
      case 'remove_admin_role':
        return await handleRemoveAdminRole(supabase, payload);
      case 'list_admins':
        return await handleListAdmins(supabase);
      case 'item_review':
        return await handleItemReview(supabase, payload, user.id);
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
  } catch (error) {
    console.error('Admin operation error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
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

// --- Role Management (Super Admin only) ---

async function handleAssignAdminRole(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  adminUserId: string
) {
  const { email, permissions } = payload as {
    email: string;
    permissions?: string[];
  };

  // `auth.users` is NOT exposed via PostgREST — querying it as a table always
  // errors. Use the auth admin API to look the user up by email instead.
  const normalizedEmail = email.trim().toLowerCase();
  let targetUserId: string | null = null;
  try {
    // listUsers is paginated; scan pages until we find a matching email.
    let page = 1;
    const perPage = 1000;
    // Cap pages to avoid an unbounded loop on very large user bases.
    while (page <= 20) {
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ page, perPage });
      if (listError) break;
      const found = listData?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail);
      if (found) { targetUserId = found.id; break; }
      if (!listData?.users || listData.users.length < perPage) break;
      page += 1;
    }
  } catch (lookupErr) {
    console.error('Auth admin lookup failed:', lookupErr);
  }

  if (!targetUserId) {
    return json({ error: 'User not found' }, 404);
  }

  const { error: roleError } = await supabase
    .from('user_roles')
    .insert({ user_id: targetUserId, role: 'admin' });

  if (roleError) {
    if (roleError.code === '23505') {
      return json({ error: 'User is already an admin' }, 409);
    }
    return json({ error: 'Failed to assign admin role' }, 500);
  }

  if (permissions && permissions.length > 0) {
    const permissionRows = permissions.map((p) => ({
      user_id: targetUserId,
      permission: p,
      created_by: adminUserId,
    }));
    const { error: permError } = await supabase
      .from('admin_permissions')
      .insert(permissionRows);

    if (permError) {
      console.error('Failed to assign permissions:', permError);
    }
  }

  return json({ success: true, userId: targetUserId });
}

async function handleUpdateAdminPermissions(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const { userId, permissions } = payload as {
    userId: string;
    permissions: string[];
  };

  const { error: deleteError } = await supabase
    .from('admin_permissions')
    .delete()
    .eq('user_id', userId);

  if (deleteError) {
    return json({ error: 'Failed to update permissions' }, 500);
  }

  if (permissions.length > 0) {
    const permissionRows = permissions.map((p) => ({
      user_id: userId,
      permission: p,
    }));
    const { error: insertError } = await supabase
      .from('admin_permissions')
      .insert(permissionRows);

    if (insertError) {
      return json({ error: 'Failed to insert permissions' }, 500);
    }
  }

  return json({ success: true });
}

async function handleRemoveAdminRole(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const { userId } = payload as { userId: string };

  const { error: permError } = await supabase
    .from('admin_permissions')
    .delete()
    .eq('user_id', userId);

  if (permError) {
    console.error('Failed to delete permissions:', permError);
  }

  const { error: roleError } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role', 'admin');

  if (roleError) {
    return json({ error: 'Failed to remove admin role' }, 500);
  }

  return json({ success: true });
}

async function handleListAdmins(supabase: ReturnType<typeof createClient>) {
  const { data: roles, error: rolesError } = await supabase
    .from('user_roles')
    .select('user_id, role, created_at')
    .in('role', ['admin', 'super_admin']);

  if (rolesError) {
    return json({ error: 'Failed to list admins' }, 500);
  }

  const userIds = [...new Set(roles.map((r: { user_id: string }) => r.user_id))];

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', userIds);

  if (profilesError) {
    return json({ error: 'Failed to fetch profiles' }, 500);
  }

  const { data: permissions, error: permsError } = await supabase
    .from('admin_permissions')
    .select('user_id, permission');

  if (permsError) {
    return json({ error: 'Failed to fetch permissions' }, 500);
  }

  const profileMap = new Map(
    (profiles || []).map((p: { id: string; full_name: string; avatar_url?: string }) => [p.id, p])
  );

  const permsMap = new Map<string, string[]>();
  for (const p of permissions || []) {
    const pData = p as { user_id: string; permission: string };
    if (!permsMap.has(pData.user_id)) {
      permsMap.set(pData.user_id, []);
    }
    permsMap.get(pData.user_id)!.push(pData.permission);
  }

  const admins = roles.map((r: { user_id: string; role: string; created_at: string }) => {
    const profile = profileMap.get(r.user_id);
    return {
      userId: r.user_id,
      role: r.role,
      fullName: profile?.full_name || 'Unknown',
      email: '',
      avatarUrl: profile?.avatar_url || null,
      permissions: permsMap.get(r.user_id) || [],
      createdAt: r.created_at,
    };
  });

  return json({ admins });
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
  const now = new Date().toISOString();
  const updateData: Record<string, unknown> = { status, verified_by: adminUserId };
  if (isApproved) updateData.verified_at = now;
  if (adminNotes) updateData.admin_notes = adminNotes;
  if (!isApproved && rejectionReason) updateData.rejection_reason = rejectionReason;

  const { error: verifError } = await supabase
    .from('verification_requests')
    .update(updateData)
    .eq('id', verificationId);
  if (verifError) { console.error('Verify identity error:', verifError); return json({ error: 'Failed to update verification' }, 500); }

  if (isApproved) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ is_verified: true, verification_level: 'kyc' })
      .eq('id', userId);
    if (profileError) { console.error('Verify identity profile error:', profileError); return json({ error: 'Failed to update profile' }, 500); }
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

  const updateData: Record<string, unknown> = { status, verified_by: adminUserId };
  if (isApproved) updateData.verified_at = now;
  if (!isApproved && rejectionReason) updateData.rejection_reason = rejectionReason;
  if (adminNotes) updateData.admin_notes = adminNotes;

  const { error: verifError } = await supabase
    .from('verification_requests')
    .update(updateData)
    .in('id', ids);
  if (verifError) { console.error('Batch verify error:', verifError); return json({ error: 'Failed to update verifications' }, 500); }

  if (isApproved) {
    const { data: requests, error: fetchError } = await supabase
      .from('verification_requests')
      .select('user_id')
      .in('id', ids);
    if (fetchError) { console.error('Batch fetch error:', fetchError); return json({ error: 'Failed to fetch user IDs' }, 500); }

    const userIds = [...new Set(requests.map((r: { user_id: string }) => r.user_id))];

    // Match the single-approve path: set verification_level too, otherwise
    // batch-approved users get a lower trust state than individually approved ones.
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ is_verified: true, verification_level: 'kyc' })
      .in('id', userIds);
    if (profileError) { console.error('Batch profile update error:', profileError); return json({ error: 'Failed to update profiles' }, 500); }

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

  if (error) { console.error('Fraud alert error:', error); return json({ error: 'Failed to update fraud alert' }, 500); }
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

  if (error) { console.error('Suspend user error:', error); return json({ error: 'Failed to suspend user' }, 500); }
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

  if (error) { console.error('Unsuspend user error:', error); return json({ error: 'Failed to unsuspend user' }, 500); }
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

  const refundAmount = typeof resolutionAmount === 'number' && resolutionAmount > 0 ? resolutionAmount : 0;

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

  if (disputeError) { console.error('Dispute update error:', disputeError); return json({ error: 'Failed to update dispute' }, 500); }

  // If a refund was granted, the rental is cancelled (not completed) and the
  // payment is marked refunded with a pending refund payout for the renter.
  const rentalStatus = refundAmount > 0 ? 'cancelled' : 'completed';
  const { error: rentalError } = await supabase
    .from('rentals')
    .update({ is_disputed: false, status: rentalStatus })
    .eq('id', rentalId);

  if (rentalError) { console.error('Rental update error:', rentalError); return json({ error: 'Failed to update rental' }, 500); }

  if (refundAmount > 0) {
    // Find the rental's paid payment to attach the refund payout.
    const { data: payment } = await supabase
      .from('payments')
      .select('id')
      .eq('rental_id', rentalId)
      .eq('status', 'paid')
      .maybeSingle();

    if (payment) {
      const { data: rentalRow } = await supabase
        .from('rentals')
        .select('renter_id')
        .eq('id', rentalId)
        .single();

      await supabase.from('payments').update({ status: 'refunded', refunded_at: new Date().toISOString() }).eq('id', payment.id);

      if (rentalRow?.renter_id) {
        const { error: refundError } = await supabase.from('payouts').insert({
          owner_id: rentalRow.renter_id, // recipient of the refund
          payment_id: payment.id,
          rental_id: rentalId,
          rental_amount: 0,
          platform_fee: 0,
          payout_amount: Math.round(refundAmount * 100) / 100,
          status: 'pending',
          held_reason: 'Dispute refund (admin)',
        });
        if (refundError) console.error('Refund payout insert error:', refundError);
      }
    }
  }

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

  if (error) { console.error('Toggle promo error:', error); return json({ error: 'Failed to toggle promo code' }, 500); }
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

  if (error) { console.error('Create promo error:', error); return json({ error: 'Failed to create promo code' }, 500); }
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

  if (error) { console.error('Platform setting error:', error); return json({ error: 'Failed to update platform setting' }, 500); }
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

  // Allowlist valid target statuses to prevent arbitrary values being stored.
  const ALLOWED = ['completed', 'failed'];
  if (!ALLOWED.includes(status)) {
    return json({ error: `Invalid payout status. Must be one of: ${ALLOWED.join(', ')}` }, 400);
  }
  if (status === 'completed' && !transactionReference) {
    return json({ error: 'transactionReference is required when marking a payout completed' }, 400);
  }

  const updateData: Record<string, unknown> = { status, processed_at: new Date().toISOString() };
  if (transactionReference) updateData.transaction_reference = transactionReference;
  if (failureReason) updateData.failure_reason = failureReason;

  // CRITICAL: status guard prevents double-processing. Only a payout still in a
  // processable state can transition — concurrent/duplicate calls get 0 rows.
  const { data: updated, error } = await supabase
    .from('payouts')
    .update(updateData)
    .eq('id', payoutId)
    .in('status', ['pending', 'held', 'awaiting_bank_details'])
    .select('id')
    .maybeSingle();

  if (error) { console.error('Process payout error:', error); return json({ error: 'Failed to process payout' }, 500); }
  if (!updated) {
    return json({ error: 'Payout already processed or not in a processable state' }, 409);
  }
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

  if (error) { console.error('Resolve report error:', error); return json({ error: 'Failed to resolve report' }, 500); }
  return json({ success: true });
}

// --- Cleanup ---

async function handleCleanupPayments(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase.rpc('cleanup_expired_payments');
  if (error) { console.error('Cleanup payments error:', error); return json({ error: 'Failed to cleanup payments' }, 500); }
  return json({ success: true, data });
}

// --- Item Review (approve/reject) ---

async function handleItemReview(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  adminUserId: string
) {
  const { itemId, action, reason } = payload as {
    itemId: string;
    action: 'approve' | 'reject';
    reason?: string;
  };

  if (!itemId || !['approve', 'reject'].includes(action)) {
    return json({ error: 'itemId and action (approve/reject) required' }, 400);
  }

  const { data: item, error: itemError } = await supabase
    .from('items')
    .select('id, status, owner_id')
    .eq('id', itemId)
    .single();

  if (itemError || !item) {
    return json({ error: 'Item not found' }, 404);
  }

  if (action === 'approve') {
    if (item.status !== 'under_review') {
      return json({ error: `Cannot approve item in '${item.status}' status` }, 409);
    }
    const { error: updateError } = await supabase
      .from('items')
      .update({ status: 'available', is_available: true, listing_status: 'active' })
      .eq('id', itemId);
    if (updateError) throw updateError;
  } else {
    const { error: updateError } = await supabase
      .from('items')
      .update({ status: 'created', listing_status: 'draft' })
      .eq('id', itemId);
    if (updateError) throw updateError;
  }

  await supabase.from('admin_audit_log').insert({
    admin_id: adminUserId,
    action: `item_${action}`,
    target: itemId,
    reason: reason || `Admin ${action}d listing`,
  });

  return json({ success: true, newStatus: action === 'approve' ? 'available' : 'created' });
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

  if (error) { console.error('Log access error:', error); return json({ error: 'Failed to log access' }, 500); }
  return json({ success: true });
}
