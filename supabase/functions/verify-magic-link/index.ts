import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOTRUE_URL = `${Deno.env.get('SUPABASE_URL')!}/auth/v1`;

async function gotrue(path: string, apiKey: string, options?: { method?: string; body?: unknown }) {
  const res = await fetch(`${GOTRUE_URL}${path}`, {
    method: options?.method || 'GET',
    headers: {
      'apikey': apiKey,
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GoTrue ${res.status}: ${text}`);
  return JSON.parse(text);
}

function generatePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let pw = '';
  for (let i = 0; i < 24; i++) {
    pw += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  pw += 'Aa1!';
  return pw;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, email } = await req.json();
    if (!token || !email) {
      return new Response(JSON.stringify({ error: 'Missing token or email' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, SERVICE_KEY);

    // Find valid token
    const { data: magicLink, error: findError } = await supabase
      .from('magic_links')
      .select('*')
      .eq('token', token)
      .eq('email', normalizedEmail)
      .is('used_at', null)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (findError || !magicLink) {
      return new Response(JSON.stringify({ error: 'Invalid or expired link' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Mark token as used
    await supabase
      .from('magic_links')
      .update({ used_at: new Date().toISOString() })
      .eq('id', magicLink.id);

    // Use the stored user_id from send-magic-link
    const userId = magicLink.user_id;

    // Set a new password on the user
    const tempPassword = generatePassword();
    await gotrue(`/admin/users/${userId}`, SERVICE_KEY, {
      method: 'PUT',
      body: {
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: true,
      },
    });

    // Sign in with the temp password
    const sessionData = await gotrue('/token?grant_type=password', SERVICE_KEY, {
      method: 'POST',
      body: { email: normalizedEmail, password: tempPassword },
    }) as { access_token: string; refresh_token: string; expires_in: number };

    return new Response(JSON.stringify({
      access_token: sessionData.access_token,
      refresh_token: sessionData.refresh_token,
      expires_in: sessionData.expires_in,
      user: { id: userId, email: normalizedEmail },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('verify-magic-link error:', error);
    const detail = JSON.stringify(error, Object.getOwnPropertyNames(error));
    return new Response(JSON.stringify({ error: 'Verification failed', detail }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
