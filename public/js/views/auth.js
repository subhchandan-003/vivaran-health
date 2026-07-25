import { supabase } from "../supabaseClient.js";
import { navigate } from "../router.js";
import { escapeHtml } from "../util/dom.js";

const CONSENT_TEXT =
  "I agree to store my health documents securely. Vivaran Health will never share my data without my explicit action.";

const PENDING_CONSENT_KEY = "vivaran_pending_consent";

export async function render(app) {
  let mode = "login"; // 'login' | 'signup'

  function paint(errorMessage = "", infoMessage = "") {
    app.innerHTML = `
      <div class="auth-shell">
        <div class="auth-card">
          <div class="auth-brand">
            <span class="app-header__logo">V</span>
            <div>
              <div style="font-weight:700;font-size:1.15rem;">Vivaran Health</div>
              <div style="color:var(--ink-500);font-size:0.85rem;">Your records, your control</div>
            </div>
          </div>

          <div class="auth-tabs">
            <button type="button" class="auth-tab ${mode === "login" ? "active" : ""}" data-mode="login">Log in</button>
            <button type="button" class="auth-tab ${mode === "signup" ? "active" : ""}" data-mode="signup">Sign up</button>
          </div>

          ${errorMessage ? `<div class="alert alert-error">${escapeHtml(errorMessage)}</div>` : ""}
          ${infoMessage ? `<div class="alert alert-info">${escapeHtml(infoMessage)}</div>` : ""}

          <form id="auth-form">
            ${mode === "signup" ? `
              <div class="field">
                <label for="name">Your name</label>
                <input type="text" id="name" autocomplete="name" required />
              </div>
            ` : ""}
            <div class="field">
              <label for="email">Email</label>
              <input type="email" id="email" autocomplete="email" required />
            </div>
            <div class="field">
              <label for="password">Password</label>
              <input type="password" id="password" autocomplete="${mode === "signup" ? "new-password" : "current-password"}" minlength="6" required />
            </div>

            ${mode === "signup" ? `
              <div class="checkbox-row">
                <input type="checkbox" id="consent" />
                <label for="consent">${escapeHtml(CONSENT_TEXT)}</label>
              </div>
            ` : ""}

            <button type="submit" class="btn btn-primary btn-block" id="submit-btn">
              ${mode === "signup" ? "Create account" : "Log in"}
            </button>
          </form>
        </div>
      </div>
    `;

    app.querySelectorAll(".auth-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        mode = tab.dataset.mode;
        paint();
      });
    });

    app.querySelector("#auth-form").addEventListener("submit", handleSubmit);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById("submit-btn");
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    submitBtn.disabled = true;
    submitBtn.textContent = mode === "signup" ? "Creating account..." : "Logging in...";

    try {
      if (mode === "signup") {
        const name = document.getElementById("name").value.trim();
        const consentChecked = document.getElementById("consent").checked;
        if (!consentChecked) {
          throw new Error("Please agree to the consent statement to create an account.");
        }

        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        // Stash consent so the SIGNED_IN handler in app.js can attach it to
        // the profile row once a session exists (immediately, or after the
        // user confirms their email and logs in).
        localStorage.setItem(
          PENDING_CONSENT_KEY,
          JSON.stringify({ name, consent_given: true, consent_timestamp: new Date().toISOString(), stashed_at: Date.now() }),
        );

        if (data.session) {
          navigate("/timeline");
        } else {
          paint("", "Account created. Check your email to confirm it, then log in.");
          mode = "login";
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/timeline");
      }
    } catch (err) {
      paint(err.message || "Something went wrong. Please try again.");
    } finally {
      submitBtn.disabled = false;
    }
  }

  paint();
}

export function getPendingConsent() {
  const raw = localStorage.getItem(PENDING_CONSENT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Only trust a stash made in the last hour.
    if (Date.now() - parsed.stashed_at > 60 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  } finally {
    localStorage.removeItem(PENDING_CONSENT_KEY);
  }
}
