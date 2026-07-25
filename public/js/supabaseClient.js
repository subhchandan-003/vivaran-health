// Single shared Supabase client. window.VIVARAN_CONFIG comes from config.js
// (gitignored) — see config.example.js for the shape.
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.VIVARAN_CONFIG || {};

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  document.getElementById("app").innerHTML =
    '<div style="padding:40px;font-family:sans-serif;max-width:480px;margin:0 auto;">' +
    "<h2>Missing config.js</h2>" +
    "<p>Copy <code>public/js/config.example.js</code> to <code>public/js/config.js</code> and fill in your Supabase project URL and anon key.</p>" +
    "</div>";
  throw new Error("Missing Supabase config");
}

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const SUPABASE_URL_EXPORT = SUPABASE_URL;
