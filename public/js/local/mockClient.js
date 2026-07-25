// A supabase-js-shaped client backed by localStorage + IndexedDB, so the app
// runs fully offline with no Supabase project connected. Swap dataClient.js
// back to supabaseClient.js when you're ready to reconnect — every view calls
// the same `supabase.auth` / `.from()` / `.storage` / `.functions` shape.
//
// NOT SECURE — passwords are stored in plain text in localStorage. This is a
// local dev/demo stand-in only, never a substitute for real auth.
import { readTable, writeTable, uuid, SESSION_KEY } from "./store.js";
import { putFile, getFileBlob, deleteFile } from "./idbFiles.js";

// ---------------------------------------------------------------------------
// Query builder — mimics the slice of supabase-js's fluent `.from()` API this
// app actually uses: select/eq/order/insert/update/delete/single/maybeSingle.
// ---------------------------------------------------------------------------
class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.op = "select";
    this.filters = [];
    this.orders = [];
    this.selectCols = "*";
    this.insertRows = null;
    this.updateData = null;
    this.singleMode = null;
  }

  select(cols) {
    this.selectCols = cols || "*";
    return this;
  }

  eq(col, val) {
    this.filters.push({ col, val, op: "eq" });
    return this;
  }

  in(col, values) {
    this.filters.push({ col, val: values, op: "in" });
    return this;
  }

  order(col, opts = {}) {
    this.orders.push({ col, ascending: opts.ascending !== false });
    return this;
  }

  insert(rows) {
    this.op = "insert";
    this.insertRows = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(data) {
    this.op = "update";
    this.updateData = data;
    return this;
  }

  delete() {
    this.op = "delete";
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  _matches(row) {
    return this.filters.every((f) =>
      f.op === "in" ? Array.isArray(f.val) && f.val.includes(row[f.col]) : row[f.col] === f.val,
    );
  }

  _applyOrder(rows) {
    if (this.orders.length === 0) return rows;
    return [...rows].sort((a, b) => {
      for (const o of this.orders) {
        const av = a[o.col];
        const bv = b[o.col];
        if (av === bv) continue;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const cmp = av < bv ? -1 : 1;
        return o.ascending ? cmp : -cmp;
      }
      return 0;
    });
  }

  _embed(rows) {
    // Only case this app needs: share_links.select("...visits(hospital_name, visit_date)")
    if (this.table === "share_links" && this.selectCols.includes("visits(")) {
      const visits = readTable("visits");
      return rows.map((r) => ({
        ...r,
        visits: r.visit_id ? visits.find((v) => v.id === r.visit_id) || null : null,
      }));
    }
    return rows;
  }

  then(resolve, reject) {
    this._run().then(resolve, reject || resolve);
  }

  async _run() {
    const rows = readTable(this.table);

    if (this.op === "insert") {
      const now = new Date().toISOString();
      const inserted = this.insertRows.map((r) => ({
        id: uuid(),
        created_at: now,
        updated_at: now,
        ...r,
      }));
      writeTable(this.table, [...rows, ...inserted]);
      const data = this.singleMode ? inserted[0] || null : inserted;
      return { data, error: null };
    }

    if (this.op === "update") {
      const updated = [];
      const next = rows.map((row) => {
        if (!this._matches(row)) return row;
        const merged = { ...row, ...this.updateData, updated_at: new Date().toISOString() };
        updated.push(merged);
        return merged;
      });
      writeTable(this.table, next);
      return { data: updated, error: null };
    }

    if (this.op === "delete") {
      const toDelete = rows.filter((r) => this._matches(r));
      const remaining = rows.filter((r) => !this._matches(r));
      writeTable(this.table, remaining);
      // Mirror the real schema's ON DELETE CASCADE: deleting a visit removes
      // any share_links pointing at it.
      if (this.table === "visits") {
        const deletedIds = toDelete.map((r) => r.id);
        const links = readTable("share_links");
        writeTable("share_links", links.filter((l) => !deletedIds.includes(l.visit_id)));
      }
      return { data: null, error: null };
    }

    let filtered = this._applyOrder(rows.filter((r) => this._matches(r)));
    filtered = this._embed(filtered);

    if (this.singleMode === "single") {
      return filtered[0]
        ? { data: filtered[0], error: null }
        : { data: null, error: { message: "Row not found" } };
    }
    if (this.singleMode === "maybeSingle") {
      return { data: filtered[0] || null, error: null };
    }
    return { data: filtered, error: null };
  }
}

// ---------------------------------------------------------------------------
// Auth — signUp/signIn create a session immediately (no email confirmation
// step, since there's no real backend to send mail from).
// ---------------------------------------------------------------------------
let listeners = [];

function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSession(session) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

function notify(event, session) {
  listeners.forEach((cb) => cb(event, session));
}

const auth = {
  async signUp({ email, password }) {
    const users = readTable("users");
    if (users.some((u) => u.email === email)) {
      return { data: { user: null, session: null }, error: { message: "An account with this email already exists." } };
    }
    const user = { id: uuid(), email };
    writeTable("users", [...users, { ...user, password }]);
    const session = { user, access_token: "local-mock-token" };
    setSession(session);
    notify("SIGNED_IN", session);
    return { data: { user, session }, error: null };
  },

  async signInWithPassword({ email, password }) {
    const users = readTable("users");
    const byEmail = users.find((u) => u.email === email);
    if (!byEmail) {
      // Local mode has no real security model, so it's more useful to be
      // specific here than to give a generic "invalid credentials" — this
      // account genuinely doesn't exist in *this* browser's local storage.
      // Local data never syncs across devices/browsers/private windows.
      return {
        data: { user: null, session: null },
        error: { message: "No account with that email on this device. Local demo data doesn't sync across browsers or devices — sign up here first." },
      };
    }
    if (byEmail.password !== password) {
      return { data: { user: null, session: null }, error: { message: "Incorrect password for this local test account." } };
    }
    const found = byEmail;
    const user = { id: found.id, email: found.email };
    const session = { user, access_token: "local-mock-token" };
    setSession(session);
    notify("SIGNED_IN", session);
    return { data: { user, session }, error: null };
  },

  async signOut() {
    setSession(null);
    notify("SIGNED_OUT", null);
    return { error: null };
  },

  async getSession() {
    return { data: { session: getSession() } };
  },

  async getUser() {
    const session = getSession();
    return { data: { user: session ? session.user : null } };
  },

  onAuthStateChange(callback) {
    listeners.push(callback);
    return {
      data: {
        subscription: {
          unsubscribe() {
            listeners = listeners.filter((l) => l !== callback);
          },
        },
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Storage — IndexedDB-backed, keyed by `${bucket}/${path}`.
// ---------------------------------------------------------------------------
const storage = {
  from(bucket) {
    return {
      async upload(path, file) {
        await putFile(`${bucket}/${path}`, file);
        return { data: { path }, error: null };
      },
      async createSignedUrl(path) {
        const blob = await getFileBlob(`${bucket}/${path}`);
        if (!blob) return { data: null, error: { message: "File not found" } };
        return { data: { signedUrl: URL.createObjectURL(blob) }, error: null };
      },
      async remove(paths) {
        for (const p of paths) await deleteFile(`${bucket}/${p}`);
        return { data: null, error: null };
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Functions — local stand-ins for the extract-record and resolve-share edge
// functions. extract-record has no real AI to call locally, so it returns an
// honest blank form (see upload.js's `local_mode` handling) rather than
// pretending to have read the image.
// ---------------------------------------------------------------------------
const NO_LONGER_ACTIVE = "This link is no longer active. It may have expired or been revoked by the patient.";

// Scope resolution shared by resolve-share and by the patient-side content
// preview on "My shared links" (see loadShareContents in myShares.js, which
// duplicates this logic client-side since it already has the visit list).
function resolveVisitsForScope(link, ownerVisits) {
  if (link.scope === "single_visit") {
    return ownerVisits.filter((v) => v.id === link.visit_id);
  }
  if (link.scope === "selected_visits") {
    const ids = Array.isArray(link.visit_ids) ? link.visit_ids : [];
    return ownerVisits.filter((v) => ids.includes(v.id));
  }
  return ownerVisits; // full_history
}

const functions = {
  async invoke(name, { body } = {}) {
    if (name === "extract-record") {
      return {
        data: {
          visit_date: null,
          hospital_name: null,
          doctor_name: null,
          diagnosis_summary: null,
          medicines: [],
          notes: null,
          confidence_flags: [],
          local_mode: true,
        },
        error: null,
      };
    }

    if (name === "resolve-share") {
      const token = body?.token;
      const links = readTable("share_links");
      const link = links.find((l) => l.token === token);
      if (!link) return { data: { active: false, message: NO_LONGER_ACTIVE }, error: null };

      const expired = new Date(link.expires_at).getTime() < Date.now();
      if (link.revoked || expired) return { data: { active: false, message: NO_LONGER_ACTIVE }, error: null };

      const ownerVisits = readTable("visits").filter((v) => v.user_id === link.user_id);
      const visits = resolveVisitsForScope(link, ownerVisits);

      const visitsWithImages = await Promise.all(
        visits.map(async (v) => {
          let image_url = null;
          if (v.raw_file_path) {
            const blob = await getFileBlob(`documents/${v.raw_file_path}`);
            if (blob) image_url = URL.createObjectURL(blob);
          }
          const { raw_file_path, ...rest } = v;
          return { ...rest, image_url };
        }),
      );

      const nextAccessLog = Array.isArray(link.access_log) ? [...link.access_log] : [];
      nextAccessLog.push({ accessed_at: new Date().toISOString() });
      writeTable(
        "share_links",
        links.map((l) => (l.id === link.id ? { ...l, access_log: nextAccessLog } : l)),
      );

      return { data: { active: true, scope: link.scope, visits: visitsWithImages }, error: null };
    }

    return { data: null, error: { message: `Unknown local function: ${name}` } };
  },
};

export const supabase = {
  auth,
  from(table) {
    return new QueryBuilder(table);
  },
  storage,
  functions,
};
