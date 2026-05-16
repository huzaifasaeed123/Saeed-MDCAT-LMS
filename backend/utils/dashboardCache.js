// ── Dashboard summary cache ──────────────────────────────────────────────────
// Two independent caches, two different strategies:
//
//   1. Per-user summary (student / teacher view) — HOT PATH.
//      Stale-while-revalidate (SWR):
//        • fresh window  (< FRESH_TTL_MS = 30 min): return cached, no rebuild
//        • stale window  (< STALE_TTL_MS = 60 min): return cached AND trigger
//          background rebuild so the next reader gets fresh data with zero blocking
//        • beyond stale window: synchronous rebuild
//      Dashboard is a KPI view (not real-time), so the windows are wide —
//      eager invalidation on test completion still gives instant updates for
//      the moment students DO refresh. Community/rank/course-access changes
//      surface within the stale window (≤ 60 min) — acceptable for a dashboard.
//      LRU-bounded at 5 000 entries.
//
//   2. Platform-wide admin summary — COLD PATH.
//      No TTL. Cache lives forever until an admin clicks "Refresh" on the
//      dashboard (refreshSummary endpoint) or the process restarts.
//      Rationale: admin KPIs aren't time-critical; admins explicitly ask
//      for fresh numbers when they want them, and that's the only moment
//      we pay for a rebuild.
// ─────────────────────────────────────────────────────────────────────────────

const FRESH_TTL_MS  = 30 * 60 * 1000; // serve from cache, no rebuild
const STALE_TTL_MS  = 60 * 60 * 1000; // serve from cache + background rebuild
const MAX_USER_ENTS = 5000;

// Per-user store. Map<userIdString, { value, builtAt }>.
const userCache = new Map();

// Background-rebuild dedupe set. Prevents two concurrent requests from each
// kicking off their own rebuild for the same user.
const rebuildsInFlight = new Set();

// Global admin store. Single { value, builtAt } object (or null).
let adminCache = null;

const evictUserIfFull = () => {
  if (userCache.size < MAX_USER_ENTS) return;
  // Drop the oldest entry. O(n) but only when at cap — bounded by MAX_USER_ENTS.
  let oldestKey = null;
  let oldest    = Infinity;
  for (const [k, v] of userCache) {
    if (v.builtAt < oldest) { oldest = v.builtAt; oldestKey = k; }
  }
  if (oldestKey) userCache.delete(oldestKey);
};

// ── Per-user (SWR) ──────────────────────────────────────────────────────────
//
// Returns one of:
//   { hit: 'fresh', value }   → use it, do nothing else
//   { hit: 'stale', value }   → use it AND call markRebuildStarted + run rebuild in background
//   { hit: 'miss' }           → must build synchronously
//
const getUser = (userId) => {
  const key = String(userId);
  const e   = userCache.get(key);
  if (!e) return { hit: 'miss' };

  const age = Date.now() - e.builtAt;
  if (age < FRESH_TTL_MS)  return { hit: 'fresh', value: e.value };
  if (age < STALE_TTL_MS)  return { hit: 'stale', value: e.value };

  // Too stale to serve — treat as miss.
  userCache.delete(key);
  return { hit: 'miss' };
};

const setUser = (userId, value) => {
  evictUserIfFull();
  userCache.set(String(userId), { value, builtAt: Date.now() });
};

const invalidateUser = (userId) => { userCache.delete(String(userId)); };

// Background-rebuild dedupe. Caller checks markRebuildStarted() before kicking
// off an async rebuild; if it returns false, another rebuild is already in
// flight for this user and the caller should skip.
const markRebuildStarted = (userId) => {
  const key = String(userId);
  if (rebuildsInFlight.has(key)) return false;
  rebuildsInFlight.add(key);
  return true;
};
const markRebuildDone = (userId) => { rebuildsInFlight.delete(String(userId)); };

// Bulk invalidation — wipes EVERY user's cached summary. Used by admin actions
// that affect many rows (e.g. bulk feature toggle). Cheap because cache
// re-fills lazily on next request.
const invalidateAllUsers = () => { userCache.clear(); };

// ── Global admin (no TTL — manual refresh only) ─────────────────────────────
const getAdmin = () => (adminCache ? adminCache.value : null);

const setAdmin = (value) => {
  adminCache = { value, builtAt: Date.now() };
};

const invalidateAdmin = () => { adminCache = null; };

// When was the admin cache last built? Exposed for the manual-refresh
// spam-click guard in the controller.
const getAdminBuiltAt = () => (adminCache ? adminCache.builtAt : 0);

const clearAll = () => {
  userCache.clear();
  adminCache = null;
};

module.exports = {
  FRESH_TTL_MS, STALE_TTL_MS,
  getUser, setUser, invalidateUser, invalidateAllUsers,
  markRebuildStarted, markRebuildDone,
  getAdmin, setAdmin, invalidateAdmin, getAdminBuiltAt,
  clearAll,
};
