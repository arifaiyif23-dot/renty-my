# RENTY — SOP DEPLOY (laptop Windows, PowerShell)
> Build LOKAL + prebuilt deploy. JANGAN biar Vercel/CI buat `npm ci` fresh — npm 10.x crash "Exit handler never called".

## 0. Prereq (sekali je)
- Node 22 LTS + Git: `winget install OpenJS.NodeJS.LTS` dan `winget install Git.Git`
- Vercel CLI: `npm i -g vercel` → login sekali: `vercel login` (browser)
- `node_modules` folder **jangan sekali-kali delete** — kalau hilang, `npm ci` akan crash. Backup dulu kalau nak bersih.

## 1. Pull code
```powershell
cd C:\Users\yepwo\Documents\renty\renty-my
git status                 # kena CLEAN (takde modified files)
git pull origin main
```

## 2. Set env REAL (bukan `vercel env pull` — tulis REDACTED!)
```powershell
$env:VITE_SUPABASE_URL            = "https://gsucsqtqtpaeuxwrykmf.supabase.co"
$env:VITE_SUPABASE_PUBLISHABLE_KEY = "<anon key dari Vercel dashboard / Supabase dashboard>"
$env:VITE_SITE_URL                = "https://renty.my"
$env:VITE_VAPID_PUBLIC_KEY        = "<VAPID public key dari Supabase dashboard>"
```
Nilai betul: Vercel → Project `renty-my` → Settings → Environment Variables (Production). `.env` dalam repo cuma ada 2 var — SITE_URL + VAPID kena tambah manual.

## 3. Semak + build
```powershell
npm run verify             # typecheck + lint + build — WAJIB pass dulu
vercel link --yes --project renty-my   # sekali je (kalau belum)
npm run build              # bake env ke dist
vercel build --prod        # hasilkan .vercel/output (guna node_modules sedia ada)
```

## 4. Deploy + sahkan live
```powershell
vercel deploy --prebuilt --prod --yes
curl.exe -sI https://renty.my | findstr /i "last-modified"   # timestamp mesti BARU
```
Smoke test: buka https://renty.my — search jalan, listing keluar, login tak error.

## 5. Kalau blank page selepas deploy
1. `curl.exe -s https://renty.my -o live.html` → cari `assets/index-*.js` → `curl.exe -s https://renty.my/<chunk> -o chunk.js`
2. `findstr "supabase" chunk.js` — takde = env tak bake → balik langkah 2.
3. Browser console: error `Invalid supabaseUrl` = env tak masuk bundle.

---

## ENV VARS yang perlu ada
**Frontend (VITE_ = public, bake masa build):**
| Var | Nilai |
|---|---|
| `VITE_SUPABASE_URL` | `https://gsucsqtqtpaeuxwrykmf.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon key (bukan service_role!) |
| `VITE_SITE_URL` | `https://renty.my` |
| `VITE_VAPID_PUBLIC_KEY` | VAPID public key |

**GitHub Actions secrets (deploy.yml):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VERCEL_TOKEN` — **tambah juga** `VITE_SITE_URL` + `VITE_VAPID_PUBLIC_KEY` (skarang tertinggal, deploy CI bake nilai undefined).

**Edge functions (Supabase dashboard, BUKAN Vercel):** `TOYYIBPAY_SECRET_KEY`, `TOYYIBPAY_CATEGORY_CODE`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, eKYC keys — set via `supabase secrets set`, takde kaitan deploy frontend.

---

## FIX KEKAL untuk CI (buang workaround)
**Cadangan: A + B sekali gus.**
- **A. Deploy `--prebuilt` dalam deploy.yml** — build kat runner, `npx vercel build --prod`, `npx vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}`. Vercel tak install apa-apa → bug npm hilang 100%, tak kira version npm.
- **B. Pin npm 11 guna corepack** — package.json dah ada `"packageManager": "npm@11.19.0"`. Tambah step `corepack enable` sebelum `npm ci` (npm 11 takde lifecycle race 10.x; dengan ni boleh hidupkan semula `cache: npm`). Alternatif: `npm install -g npm@11`.
- **C. Bun (opsi ganti kalau npm meragam lagi)** — `oven-sh/setup-bun@v2` + `bun install --frozen-lockfile` + `bunx vercel deploy --prebuilt --prod`. Paling laju, tapi kena convert ke `bun.lockb` — buat kemudian, bukan sekarang.

## PITFALLS
- `vercel env pull` = REDACTED untuk agent/CI — jangan guna untuk build.
- `npm ci`/`npm install` fresh kat runner/Vercel = crash. Laptop selamat sebab node_modules sedia ada.
- VPS mirror `~/renty-web` ada 2 fail modified (Profile.tsx, Verification.tsx) — commit dulu, JANGAN deploy dari VPS.
