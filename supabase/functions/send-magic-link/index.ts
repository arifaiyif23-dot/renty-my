import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') || 'https://renty.my',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const getFromEmail = () => {
  const customFrom = Deno.env.get('RESEND_FROM_EMAIL');
  if (customFrom) return customFrom.includes('<') ? customFrom : `Renty <${customFrom}>`;
  return 'Renty <onboarding@resend.dev>';
};

const GOTRUE_URL = `${Deno.env.get('SUPABASE_URL')!}/auth/v1`;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function gotrueAdmin(path: string, options?: { method?: string; body?: unknown }) {
  const url = `${GOTRUE_URL}${path}`;
  const res = await fetch(url, {
    method: options?.method || 'GET',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GoTrue ${res.status}: ${text}`);
  }
  return res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      SERVICE_KEY
    );

    // Rate limit: 3 requests per 15 min per email
    const { count } = await supabase
      .from('magic_links')
      .select('id', { count: 'exact', head: true })
      .eq('email', normalizedEmail)
      .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());

    if (count && count >= 3) {
      return new Response(JSON.stringify({ error: 'Too many requests. Try again later.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Find or create user by fetching all and matching email (filter param is unreliable)
    let userId: string;
    const allUsers = await gotrueAdmin('/admin/users') as { users: Array<{ id: string; email: string }> };
    const existingUser = allUsers?.users?.find((u: { email: string }) => u.email === normalizedEmail);
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const createResult = await gotrueAdmin('/admin/users', {
        method: 'POST',
        body: {
          email: normalizedEmail,
          email_confirm: true,
          user_metadata: {},
        },
      });
      userId = createResult.id;
    }

    // Generate a secure random token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: dbError } = await supabase
      .from('magic_links')
      .insert({ email: normalizedEmail, token, user_id: userId, expires_at: expiresAt });
    if (dbError) throw dbError;

    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://renty.my';
    const magicLinkUrl = `${frontendUrl}/auth/magic?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;

    const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);
    await resend.emails.send({
      from: getFromEmail(),
      to: [normalizedEmail],
      subject: 'Sign in to Renty',
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
          <div style="max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <div style="background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); text-align: center;">
              <h1 style="color: #18181b; font-size: 24px; margin-bottom: 8px;">Sign in to Renty</h1>
              <p style="color: #52525b; font-size: 15px; margin-bottom: 32px;">Click the button below to sign in instantly.</p>
              <a href="${magicLinkUrl}" style="display: inline-block; background-color: #10b981; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Sign In</a>
              <p style="color: #a1a1aa; font-size: 13px; margin-top: 24px;">This link expires in 15 minutes. If you didn't request this, ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
              <p style="color: #a1a1aa; font-size: 12px; margin: 0;">Renty — Rent anything from people nearby.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('send-magic-link error:', error);
    return new Response(JSON.stringify({ error: 'Failed to send magic link' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
