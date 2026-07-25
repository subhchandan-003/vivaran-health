import { supabase } from "./supabaseClient.js";
import { route, setNotFound, startRouter, navigate } from "./router.js";
import { render as renderAuth, getPendingConsent } from "./views/auth.js";

let currentSession = null;

async function ensureProfile(session) {
  if (!session) return;
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", session.user.id)
    .maybeSingle();

  if (existing) return;

  const pending = getPendingConsent();
  await supabase.from("profiles").insert({
    id: session.user.id,
    name: pending?.name ?? null,
    consent_given: pending?.consent_given ?? false,
    consent_timestamp: pending?.consent_timestamp ?? null,
  });
}

function requireAuth(renderFn) {
  return async (app, params, query) => {
    if (!currentSession) {
      navigate("/login");
      return;
    }
    await renderFn(app, params, query);
  };
}

function publicOnly(renderFn) {
  return async (app, params, query) => {
    if (currentSession) {
      navigate("/timeline");
      return;
    }
    await renderFn(app, params, query);
  };
}

route("/login", publicOnly(renderAuth));

route("/timeline", requireAuth(async (app, params, query) => {
  const mod = await import("./views/timeline.js");
  await mod.render(app);
}));

route("/upload", requireAuth(async (app) => {
  const mod = await import("./views/upload.js");
  await mod.render(app);
}));

route("/visit/:id", requireAuth(async (app, params) => {
  const mod = await import("./views/visitDetail.js");
  await mod.render(app, params.id);
}));

route("/share/:visitId", requireAuth(async (app, params) => {
  const mod = await import("./views/share.js");
  await mod.render(app, params.visitId);
}));

route("/share", requireAuth(async (app) => {
  const mod = await import("./views/share.js");
  await mod.render(app, null);
}));

route("/shares", requireAuth(async (app) => {
  const mod = await import("./views/myShares.js");
  await mod.render(app);
}));

route("/doctor", async (app, params, query) => {
  const mod = await import("./views/doctor.js");
  await mod.render(app, query.token || "");
});

setNotFound(() => `
  <div class="empty-state">
    <div class="empty-state__icon">&#129300;</div>
    <h3>Page not found</h3>
    <p><a href="#/timeline">Go to your timeline</a></p>
  </div>
`);

async function boot() {
  const { data } = await supabase.auth.getSession();
  currentSession = data.session;

  supabase.auth.onAuthStateChange(async (event, session) => {
    currentSession = session;
    if (event === "SIGNED_IN") {
      await ensureProfile(session);
    }
    if (event === "SIGNED_OUT") {
      navigate("/login");
    }
  });

  if (currentSession) {
    await ensureProfile(currentSession);
  }

  if (!currentSession && !window.location.hash.startsWith("#/doctor")) {
    navigate("/login");
  }

  startRouter();
}

boot();
