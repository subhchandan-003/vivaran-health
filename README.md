# Vivaran Health

Patient-owned digital health record app. Full context: see `Vivaran Health PRD.docx`
in this repo (Sections 6, 7, 9, 12, and 15 especially).

Core principle: **the patient always initiates every action.** Nothing is
uploaded, stored, or shared without an explicit action the patient takes and
can revoke. No hospital, clinic, or doctor ever needs to sign up.

## Stack

- Frontend: plain HTML/CSS/vanilla JS, no build step, hash-based routing.
- Data layer: **currently local/offline** — localStorage + IndexedDB, no
  backend required. Designed to swap to Supabase (Auth + Postgres + Storage +
  two Edge Functions) when you're ready — see "Reconnecting Supabase" below.
- AI extraction: Claude (Anthropic API), called server-side from an Edge
  Function once Supabase is reconnected. In local mode, extraction is
  simulated — you fill the form in yourself.

## Running it locally (current default — no backend needed)

No build step, but ES modules need an HTTP server (not `file://`). Any static
server works, e.g.:

```sh
npx serve public
# or
python -m http.server 5173 --directory public
```

Open the printed local URL and sign up with any email/password — there's no
real account system yet, so it creates a session immediately (no email
confirmation step). All data (profile, visits, share links, uploaded images)
lives in your browser's localStorage/IndexedDB. Clearing site data wipes it.

**This mode is for demoing/developing the UI only** — it is not multi-device,
not durable, and the "auth" is a plaintext local stand-in with no real
security. Don't use it for real patient data.

## Reconnecting Supabase later

The Supabase backend is fully built and was live-tested during development —
nothing needs to be rewritten, just re-pointed:

1. **Config.** Copy `public/js/config.example.js` to `public/js/config.js` and
   fill in your Supabase project URL and anon/publishable key (Project
   Settings → API). `config.js` is gitignored — never commit it.

2. **Switch the data layer.** In `public/js/dataClient.js`, change the export
   from `./local/mockClient.js` to `./supabaseClient.js`. That's the only code
   change needed — every view imports `{ supabase }` from `dataClient.js`, not
   from either client directly.

3. **Restore the script tags.** In `public/index.html`, uncomment the Supabase
   JS CDN `<script>` and `<script src="js/config.js">` tags (see the comment
   block left in place).

4. **Database schema.** Run the SQL in `supabase/migrations/0001_init_schema.sql`
   via the Supabase SQL editor, or `supabase db push` with the Supabase CLI
   linked to your project. (Already applied to the project this was built
   against, if you're reusing it.)

5. **Edge Functions.** Deploy `extract-record` and `resolve-share` (already
   deployed on the original project). `extract-record` needs an Anthropic API
   key as a **Supabase secret** — never in frontend code or the repo:

   ```sh
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref <your-project-ref>
   ```

   (Or set it from the Supabase Dashboard → Edge Functions → Secrets.)

6. **Email confirmation.** New Supabase projects require email confirmation
   before a session is created. For faster testing, turn this off under
   Authentication → Providers → Email → "Confirm email", or just confirm via
   the email link Supabase sends.

## Project structure

```
public/
  index.html
  css/style.css
  js/
    app.js                 # router registration, auth guard, profile bootstrap
    router.js               # tiny hash router
    dataClient.js            # single switch point: local mock vs real Supabase
    supabaseClient.js         # real Supabase client (unused until reconnected)
    config.js                  # gitignored — your real Supabase URL/key
    config.example.js          # checked-in template
    local/
      mockClient.js            # supabase-js-shaped client over localStorage/IndexedDB
      store.js                  # localStorage table helpers
      idbFiles.js                # IndexedDB blob storage for uploaded images
    util/                    # dom helpers, shared page shell
    views/                    # one file per screen (auth, timeline, upload, ...)
supabase/
  migrations/0001_init_schema.sql   # tables, RLS, storage bucket
  functions/
    extract-record/       # vision extraction via Claude, patient-authenticated
    resolve-share/         # public token resolution, service-role only
```

## Security model (once reconnected to Supabase)

- RLS is enabled on `profiles`, `visits`, and `share_links`, scoped to
  `auth.uid()` — a patient can only ever read/write their own rows.
- The Storage bucket `documents` is private; policies restrict each object to
  a path prefixed with the uploading user's id.
- The doctor-facing view never queries `share_links` or `visits` directly with
  the anon key. It calls the `resolve-share` Edge Function, which uses the
  service-role key server-side to check the token, expiry, and revocation
  status, then returns only the relevant visit(s).

In local mode, none of this applies — everything lives unencrypted in the
current browser only.

## Out of scope for this build

ABHA/ABDM integration, audio recording, hospital/doctor accounts, appointments,
insurance, payments, native mobile app, deployment (Netlify/Vercel — phase 2).
