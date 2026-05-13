# Calendar Conflict Checker — Setup Guide

## 1. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase-schema.sql`
3. Copy your **Project URL** and **service_role key** from Settings → API

## 2. Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable the **Google Calendar API** (APIs & Services → Enable APIs)
4. Create **OAuth 2.0 credentials** (APIs & Services → Credentials → Create Credentials → OAuth client ID)
   - Application type: **Web application**
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/google/callback` (local dev)
     - `https://your-domain.vercel.app/api/auth/google/callback` (production)
5. Copy the **Client ID** and **Client Secret**
6. Configure the OAuth consent screen:
   - Scopes: `https://www.googleapis.com/auth/calendar.readonly`, `openid`, `email`, `profile`

## 3. Resend Setup

1. Sign up at [resend.com](https://resend.com)
2. Create an API key
3. (Optional) Add a custom domain for the `from` address in `lib/email.ts`

## 4. Environment Variables

Update `.env.local` for local development:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=re_...
APP_URL=http://localhost:3000
CRON_SECRET=generate-a-random-string-here
```

## 5. Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000

## 6. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Set all env vars in Vercel dashboard (Settings → Environment Variables). Make sure to:
- Set `GOOGLE_REDIRECT_URI` to `https://your-domain.vercel.app/api/auth/google/callback`
- Set `APP_URL` to `https://your-domain.vercel.app`
- Set `CRON_SECRET` to a long random string

The Vercel cron in `vercel.json` runs daily at 13:00 UTC and automatically sends reports to users whose `report_day` matches today's weekday.

## Cron Authentication

The cron endpoint `/api/cron/send-weekly-reports` requires the `Authorization: Bearer <CRON_SECRET>` header. Vercel automatically sends this when using the cron config — no manual action needed.

## Architecture Notes

- **Session**: Cookie-based (`user_id`), httpOnly, 30-day expiry
- **Tokens**: Stored server-side in Supabase; auto-refreshed before API calls
- **Calendars**: Fetched live from Google Calendar API on each dashboard load
- **Conflict logic**: O(n×m) pairwise comparison — `A.start < B.end && B.start < A.end`
- **Reports**: Plain HTML email via Resend; no markdown
