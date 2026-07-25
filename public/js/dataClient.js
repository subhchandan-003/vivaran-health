// Single switch point for the app's data layer.
//
// Right now the app runs fully local/offline — localStorage + IndexedDB,
// no Supabase project required. To reconnect to the real Supabase backend
// later:
//   1. Copy public/js/config.example.js to public/js/config.js and fill in
//      your project URL + anon key.
//   2. Add back the Supabase JS CDN <script> tag and <script src="js/config.js">
//      in index.html (see the comment left there).
//   3. Change the export below to `export { supabase } from "./supabaseClient.js";`
//
// Nothing else needs to change — every view imports `{ supabase }` from this
// file, not from supabaseClient.js or local/mockClient.js directly.
export { supabase } from "./local/mockClient.js";

// Flip to false when you switch the export above to supabaseClient.js — this
// gates the quick-test-login shortcuts on the auth screen, which only make
// sense against the local mock (see views/auth.js).
export const isLocalMode = true;
