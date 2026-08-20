import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export class RateLimitError extends Error {
  readonly status = 429;
  readonly remaining: number;
  readonly resetAt?: string;

  constructor(remaining = 0, resetAt?: string) {
    super('Rate limit exceeded. Please try again later.');
    this.name = 'RateLimitError';
    this.remaining = remaining;
    this.resetAt = resetAt;
  }
}

interface RateLimitOptions {
  userId?: string | null;
  ipAddress?: string | null;
  action: string;
  maxAttempts: number;
  windowMinutes: number;
}

// Throws RateLimitError when the caller has exceeded the window. Uses the
// atomic check_rate_limit_track RPC (rate_limits table, service-role policy).
// Fails open: rate limiting must never take the service down.
export async function enforceRateLimit(
  supabase: SupabaseClient,
  opts: RateLimitOptions
): Promise<void> {
  if (!opts.userId && !opts.ipAddress) return;

  const { data, error } = await supabase.rpc('check_rate_limit_track', {
    p_user_id: opts.userId ?? null,
    p_ip_address: opts.ipAddress ?? null,
    p_action: opts.action,
    p_max_attempts: opts.maxAttempts,
    p_window_minutes: opts.windowMinutes,
  });

  if (error) {
    console.error('Rate limit check failed:', error.message);
    return;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (row && row.allowed === false) {
    throw new RateLimitError(Number(row.remaining) || 0, row.reset_at);
  }
}