/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://renty.my';

const corsHeaders = {
  'Access-Control-Allow-Origin': FRONTEND_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---------------------------------------------------------------------------
// FCM HTTP v1 implementation (native Android/iOS via @capacitor/push-notifications)
//
// Requires env secrets:
//   FCM_SERVICE_JSON  - full service account JSON from Firebase console
//   FCM_PROJECT_ID    - Firebase project id
// ---------------------------------------------------------------------------

interface FcmServiceAccount {
  client_email: string;
  private_key: string;
  project_id?: string;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getFCMAccessToken(): Promise<{ token: string; projectId: string } | null> {
  const raw = Deno.env.get('FCM_SERVICE_JSON');
  if (!raw) {
    console.warn('[push] FCM_SERVICE_JSON is not configured — skipping push');
    return null;
  }
  let cred: FcmServiceAccount;
  try {
    cred = JSON.parse(raw);
  } catch {
    console.error('[push] FCM_SERVICE_JSON is not valid JSON');
    return null;
  }
  const projectId = Deno.env.get('FCM_PROJECT_ID') || cred.project_id;
  if (!projectId) {
    console.error('[push] FCM_PROJECT_ID is not set');
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({
    iss: cred.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })));

  const signingInput = `${header}.${claims}`;

  // Build an RSA-SHA256 signature from the PEM private key.
  const pem = cred.private_key
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const pemBytes = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${encodeURIComponent(jwt)}`,
  });
  if (!tokenRes.ok) {
    console.error('[push] failed to get FCM token', await tokenRes.text());
    return null;
  }
  const tokenData = await tokenRes.json();
  return { token: tokenData.access_token, projectId };
}

async function sendFCM(
  projectId: string,
  accessToken: string,
  token: string,
  title: string,
  body: string,
  data: Record<string, string>
): Promise<boolean> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn(`[push] FCM send failed (${res.status}): ${text.slice(0, 300)}`);
    return false;
  }
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate the shared webhook secret for DB-trigger dispatch.
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
  const requestSecret = req.headers.get('x-webhook-secret');
  if (!webhookSecret || (!requestSecret || requestSecret !== webhookSecret)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const { user_id, title, body, link, type } = await req.json();
    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: 'user_id and title are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch this user's FCM-only subscriptions.
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user_id)
      .eq('platform', 'fcm');

    if (error) {
      console.warn('[push] error fetching subscriptions', error);
    }
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const cred = await getFCMAccessToken();
    if (!cred) {
      return new Response(JSON.stringify({ ok: true, sent: 0, configured: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data: Record<string, string> = { type: type || 'general' };
    if (link) data.link = link;

    let sent = 0;
    for (const sub of subs) {
      const token = sub.endpoint || (sub.subscription?.token as string | undefined);
      if (!token) continue;
      const ok = await sendFCM(cred.projectId, cred.token, token, title, body, data);
      if (ok) sent++;
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('[push] error:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Failed to send push notification' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});