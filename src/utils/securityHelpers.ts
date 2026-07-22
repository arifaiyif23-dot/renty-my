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
  windowMinutes: number = 15,
  identifier?: string
): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const params: Record<string, unknown> = {
      p_action: action,
      p_max_attempts: maxAttempts,
      p_window_minutes: windowMinutes
    };

    if (user?.id) {
      params.p_user_id = user.id;
      params.p_ip_address = null;
    } else {
      params.p_user_id = null;
      params.p_ip_address = identifier ?? null;
    }

    const { data, error } = await supabase.rpc('check_rate_limit_enhanced', params);

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
 * Safely format a date string with error handling
 * @param dateStr - Date string to format
 * @param formatter - Formatting function
 * @param fallback - Fallback string if date is invalid
 */
export function safeFormatDate(dateStr: string | null | undefined, formatter: (d: Date) => string, fallback = "—"): string {
  if (!dateStr) return fallback;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return fallback;
    return formatter(d);
  } catch {
    return fallback;
  }
}
