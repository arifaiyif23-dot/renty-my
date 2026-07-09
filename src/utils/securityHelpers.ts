import { supabase } from '@/integrations/supabase/client';

/**
 * Check rate limit for an action
 * @param action - The action being rate limited (e.g., 'login', 'signup', 'password_reset')
 * @param maxAttempts - Maximum attempts allowed
 * @param windowMinutes - Time window in minutes
 * @returns Promise<boolean> - true if within limit, false if exceeded
 */
export async function checkRateLimit(
  action: string,
  maxAttempts: number = 5,
  windowMinutes: number = 15
): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.rpc('check_rate_limit_enhanced', {
      p_user_id: user?.id || null,
      p_ip_address: null,
      p_action: action,
      p_max_attempts: maxAttempts,
      p_window_minutes: windowMinutes
    });

    if (error) {
      console.error('Rate limit check error:', error);
      return false;
    }

    if (!data || !data.length) return false;
    return data[0].allowed === true;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return false;
  }
}

/**
 * Log access to sensitive data
 * @param resourceType - Type of resource being accessed
 * @param resourceId - ID of the resource
 * @param accessType - Type of access (e.g., 'view', 'download', 'edit')
 */
export async function logSensitiveAccess(
  resourceType: string,
  resourceId: string,
  accessType: string
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.rpc('log_sensitive_access', {
      p_user_id: user.id,
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_access_type: accessType
    });
  } catch (error) {
    console.error('Failed to log sensitive access:', error);
    // Don't throw - logging failure shouldn't block the operation
  }
}

/**
 * Get signed URL for a file in storage
 * @param bucket - Storage bucket name
 * @param path - File path
 * @param expiresIn - Expiration time in seconds (default 1 hour)
 * @returns Promise<string | null> - Signed URL or null on error
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) throw error;
    return data.signedUrl;
  } catch (error) {
    console.error('Failed to generate signed URL:', error);
    return null;
  }
}

/**
 * Mask account number to show only last 4 digits
 * @param accountNumber - Full account number
 * @returns Masked account number (e.g., "****1234")
 */
export function maskAccountNumber(accountNumber: string | null): string {
  if (!accountNumber || accountNumber.length < 4) {
    return '****';
  }
  return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
}

/**
 * Approximate coordinates for privacy (rounds to 2 decimal places ~1km accuracy)
 * @param coord - Coordinate value (latitude or longitude)
 * @returns Approximated coordinate
 */
export function approximateCoordinate(coord: number | null): number | null {
  if (coord === null) return null;
  return Math.round(coord * 100) / 100;
}

/**
 * Hash IC number for storage (client-side implementation)
 * Note: This is a fallback. Prefer server-side hashing via database function
 * @param icNumber - IC number to hash
 * @returns Promise<string> - Hashed IC number
 */
export async function hashIcNumber(icNumber: string): Promise<string> {
  const { data, error } = await supabase.rpc('hash_ic_number', {
    ic: icNumber
  });

  if (error) {
    console.error('Failed to hash IC number:', error);
    throw new Error('Identity number hashing failed. Please try again.');
  }

  return data;
}
