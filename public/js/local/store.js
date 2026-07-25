// Tiny localStorage-backed table store — the "database" for local/offline mode.
const PREFIX = "vivaran_local_";

export function readTable(name) {
  try {
    const raw = localStorage.getItem(PREFIX + name);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writeTable(name, rows) {
  localStorage.setItem(PREFIX + name, JSON.stringify(rows));
}

export function uuid() {
  return crypto.randomUUID();
}

export const SESSION_KEY = PREFIX + "session";
