import { supabase } from "@/integrations/supabase/client";

type AdminAction =
  | { action: 'verify_identity'; verificationId: string; status: string; userId: string; rejectionReason?: string; adminNotes?: string }
  | { action: 'batch_verify_identity'; ids: string[]; status: string; rejectionReason?: string; adminNotes?: string }
  | { action: 'fraud_alert_action'; alertId: string; status: string }
  | { action: 'suspend_user'; userId: string; reason: string }
  | { action: 'unsuspend_user'; userId: string }
  | { action: 'resolve_dispute'; disputeId: string; rentalId: string; resolutionNotes?: string; resolutionAmount?: number; resolutionSplit?: Record<string, unknown> }
  | { action: 'toggle_promo_code'; id: string; isActive: boolean }
  | { action: 'create_promo_code'; code: string; discountAmount: number; discountType: string; maxUses?: number; validFrom?: string; validUntil?: string }
  | { action: 'update_platform_setting'; key: string; value: string }
  | { action: 'process_payout'; payoutId: string; status: string; transactionReference?: string; failureReason?: string }
  | { action: 'resolve_report'; reportId: string; status: string; resolutionNote?: string }
  | { action: 'cleanup_payments' }
  | { action: 'log_sensitive_access'; resourceType: string; resourceId: string }
  | { action: 'assign_admin_role'; email: string; permissions?: string[] }
  | { action: 'update_admin_permissions'; userId: string; permissions: string[] }
  | { action: 'remove_admin_role'; userId: string }
  | { action: 'list_admins' };

export async function invokeAdminOperation(op: AdminAction) {
  const { data, error } = await supabase.functions.invoke('admin-operations', {
    body: op,
  });
  if (error) throw error;
  return data;
}
