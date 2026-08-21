# Email SMTP Setup — RENTY

## Status
App emails (signup confirmation, password reset, magic link, welcome, verification)
currently use `onboarding@resend.dev` — only delivers to the Resend account owner.
Real users never receive them.

## Goal
Route all emails through Resend using your own domain (`renty.my`).

---

## Step 1: Resend Domain Setup (5 min)

1. Go to https://resend.com/domains → **Add Domain**
2. Enter: `renty.my`
3. Resend gives you 3 DNS records (2 TXT + 1 CNAME):
   - **SPF** (TXT): `v=spf1 include:amazonses.com ~all`
   - **DKIM** (CNAME): `resend._domainkey.renty.my → ...`
   - **DMARC** (TXT): `_dmarc.renty.my → v=DMARC1; p=none;`

4. Go to your DNS provider (Cloudflare / Namecheap / etc.) and add these records
5. Back in Resend, click **Verify** — wait for green checkmarks (usually < 5 min)

## Step 2: Resend API Key

1. Go to https://resend.com/api-keys → **Create API Key**
2. Name: `renty-production`
3. Copy the key (starts with `re_...`)

## Step 3: Supabase Custom SMTP

1. Go to Supabase Dashboard → Project → **Authentication** → **SMTP Settings**
2. Enable **Custom SMTP**
3. Fill in:
   - **Sender email**: `Renty <no-reply@renty.my>`
   - **Host**: `smtp.resend.com`
   - **Port**: `587`
   - **Minimum interval between emails**: `60` (seconds)
   - **Username**: `resend`
   - **Password**: `<your Resend API key from Step 2>`
4. Click **Save**

## Step 4: Vercel Environment Variables

Add/update in Vercel Dashboard → Project → Settings → Environment Variables:

```
RESEND_API_KEY=re_your_key_here
RESEND_FROM_EMAIL=no-reply@renty.my
```

## Step 5: Verify

After deployment, test:
1. **Signup flow**: Create a new account → check inbox for confirmation email
2. **Password reset**: Click "Forgot password" → check inbox
3. **Magic link**: Click "Sign in with magic link" → check inbox

All three should arrive from `no-reply@renty.my` within seconds.

---

## Troubleshooting

- **Emails not arriving**: Check Resend dashboard → Logs for delivery status
- **SPF/DKIM fail**: DNS records may take up to 48h to propagate (usually < 5 min)
- **Supabase auth emails still broken**: Make sure SMTP is enabled AND the Site URL is set to `https://renty.my` in Auth → Settings
- **Resend onboarding@resend.dev warnings**: Safe to ignore during testing; disappear once domain is verified
