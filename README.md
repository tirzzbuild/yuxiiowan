# YuxiioDev Premium API Control Center

A vanilla HTML/CSS/JavaScript frontend with Vercel serverless functions and Supabase Auth/Postgres. No frontend framework or CDN is used. The upstream AxzyeDev API key is server-only.

## Features
- Public email/password signup and login using Supabase Auth.
- Per-user profile and request history.
- Admin user list and role management.
- Four allowlisted upstream actions: deploy, subdomain, amprem, build APK.
- Backend validates Supabase access tokens, validates payloads, and applies a basic per-user request limit.
- API request history, status/duration, theme preference, responsive layout, and help.

## 1. Create Supabase project
1. Create a project at Supabase.
2. Open SQL Editor and run `supabase/schema.sql`.
3. In Authentication settings, configure allowed site URLs and email confirmation as desired.
4. Copy Project URL and the publishable/anon key for the browser login form. These are public client values; never use the service-role key in the browser.

## 2. Configure Vercel
1. Push this folder to a Git repository.
2. Import the repository into Vercel. The included `vercel.json` configures serverless functions.
3. In Vercel Project Settings → Environment Variables, set:
   - `SUPABASE_URL` = Supabase project URL
   - `SUPABASE_ANON_KEY` = Supabase publishable/anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = Supabase service-role secret (server only)
   - `AXZYEDEV_BASE_URL` = `https://axzy.my.id` (or the verified API host)
   - `AXZYEDEV_API_KEY` = a newly rotated AxzyeDev key
4. Redeploy after adding variables.
5. Open the deployed website. Enter Supabase Project URL and publishable/anon key on the login page and save. These values are stored in localStorage for convenience.

## 3. Promote the first admin
1. Register using the email that should become the administrator.
2. Verify the email if confirmation is enabled.
3. In Supabase SQL Editor run:

```sql
update public.profiles
set role = 'admin'
where email = 'YOUR_ADMIN_EMAIL';
```

4. Sign out and sign in again (or refresh the session). The Admin navigation should appear.

## 4. Verify endpoints
- `GET /api/me` — current profile
- `PATCH /api/me` — update display name
- `GET /api/history?limit=40` — current user's logs
- `GET /api/health` — authenticated upstream connectivity check
- `POST /api/proxy` — allowlisted upstream request
- `GET /api/admin-users` — admin-only user list
- `PATCH /api/admin-users` — admin-only role change

The browser frontend uses same-origin `/api/...` paths. Do not deploy the static HTML separately from Vercel Functions unless you also configure an API base URL and exact CORS origin.

## Security notes
- Do not commit `.env` or real API keys. `.env.example` is a template only.
- Rotate any API key previously pasted into chats, repositories, or static HTML.
- Supabase service-role secret bypasses RLS. Keep it only in Vercel server environment variables.
- Supabase publishable/anon key is expected to be public; security relies on Auth, RLS, and server authorization.
- Basic rate limiting queries recent log rows and is suitable as a starter guard, not a high-scale abuse prevention system. For production scale use a managed rate limiter and stricter quotas.
- The upstream endpoint names and request schemas must be confirmed with the API provider. The dashboard cannot guarantee those endpoints exist or that the provider accepts the payloads.
- Consider whether storing submitted emails/repository URLs in logs is appropriate for your privacy requirements; the current history is visible only to the owning account through this backend.
- Review account deletion, data retention, email verification, password recovery, and incident response before public launch.
