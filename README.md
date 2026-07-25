# Vivaran Health

Patient-owned digital health record app. Full context: see `Vivaran Health PRD.docx`
in this repo (Sections 6, 7, 9, 12, and 15 especially).

Core principle: **the patient always initiates every action.** Nothing is
uploaded, stored, or shared without an explicit action the patient takes and
can revoke. No hospital, clinic, or doctor ever needs to sign up.

## Stack

- Frontend: plain HTML/CSS/vanilla JS, no build step, hash-based routing.
- Backend: Supabase (Auth + Postgres + Storage + two Edge Functions).
- AI extraction: Claude (Anthropic API), called server-side from an Edge Function.

## Local setup

1. **Config.** Copy `public/js/config.example.js` to `public/js/config.js` and
   fill in your Supabase project URL and anon/publishable key (Project
   Settings → API). `config.js` is gitignored — never commit it.

2. **Serve the frontend.** No build step, but ES modules need an HTTP server
   (not `file://`). Any static server works, e.g.:

   ```sh
   npx serve public
   # or
   python -m http.server 5173 --directory public
   ```

   Then open the printed local URL.

3. **Database schema.** Already applied to the live project this was built
   against. To apply to a different project: run the SQL in
   `supabase/migrations/0001_init_schema.sql` via the Supabase SQL editor, or
   `supabase db push` with the Supabase CLI linked to your project.

4. **Edge Functions.** `extract-record` and `resolve-share` are deployed.
   `extract-record` needs an Anthropic API key as a **Supabase secret** —
   never in frontend code or the repo:

   ```sh
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref <your-project-ref>
   ```

   (Or set it from the Supabase Dashboard → Edge Functions → Secrets.)

5. **Email confirmation.** New Supabase projects require email confirmation
   before a session is created. For faster local testing, turn this off under
   Authentication → Providers → Email → "Confirm email", or just confirm via
   the email link Supabase sends.

## Project structure

```
public/
  index.html
  css/style.css
  js/
    app.js              # router registration, auth guard, profile bootstrap
    router.js            # tiny hash router
    supabaseClient.js
    config.js             # gitignored — your real Supabase URL/key
    config.example.js     # checked-in template
    util/                # dom helpers, shared page shell
    views/                # one file per screen (auth, timeline, upload, ...)
supabase/
  migrations/0001_init_schema.sql   # tables, RLS, storage bucket
  functions/
    extract-record/       # vision extraction via Claude, patient-authenticated
    resolve-share/         # public token resolution, service-role only
```

## Security model

- RLS is enabled on `profiles`, `visits`, and `share_links`, scoped to
  `auth.uid()` — a patient can only ever read/write their own rows.
- The Storage bucket `documents` is private; policies restrict each object to
  a path prefixed with the uploading user's id.
- The doctor-facing view never queries `share_links` or `visits` directly with
  the anon key. It calls the `resolve-share` Edge Function, which uses the
  service-role key server-side to check the token, expiry, and revocation
  status, then returns only the relevant visit(s).

## Out of scope for this build

ABHA/ABDM integration, audio recording, hospital/doctor accounts, appointments,
insurance, payments, native mobile app, deployment (Netlify/Vercel — phase 2).
