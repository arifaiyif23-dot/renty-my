import { supabase } from '@/integrations/supabase/client';

export interface ErrorLogPayload {
  error_type: 'runtime' | 'promise' | 'boundary';
  error_message: string;
  error_stack?: string;
  component_stack?: string;
  metadata?: Record<string, unknown>;
}

export async function logError(payload: ErrorLogPayload) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('errors').insert({
      user_id: user?.id || null,
      error_type: payload.error_type,
      error_message: payload.error_message,
      error_stack: payload.error_stack || null,
      component_stack: payload.component_stack || null,
      url: window.location.href,
      user_agent: navigator.userAgent,
      metadata: payload.metadata || {},
    });
  } catch {
    // silently fail
  }
}

export function logCaughtError(error: unknown, metadata?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  return logError({
    error_type: 'runtime',
    error_message: message,
    error_stack: stack,
    metadata,
  });
}

export function logRejection(event: PromiseRejectionEvent) {
  const message = event.reason instanceof Error ? event.reason.message : String(event.reason);
  const stack = event.reason instanceof Error ? event.reason.stack : undefined;
  return logError({
    error_type: 'promise',
    error_message: message,
    error_stack: stack,
  });
}

export function logBoundaryError(error: Error, componentStack: string) {
  return logError({
    error_type: 'boundary',
    error_message: error.message,
    error_stack: error.stack,
    component_stack: componentStack,
  });
}
