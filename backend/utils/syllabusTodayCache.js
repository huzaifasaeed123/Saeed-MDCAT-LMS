// ── Per-user "today" cache ──────────────────────────────────────────────────
// /api/syllabus/me/today is hit on every dashboard render. Even with our
// $facet aggregation it's ~5–10 ms of DB work per call. Caching the result
// for 60 s per user collapses repeated dashboard renders within a minute
// (page switches, tab refocus, polling-style UIs) into zero DB work.
//
// We bound memory with an LRU cap so we don't hold state for idle users:
//   • At most 5 000 cached snapshots in memory (~50 MB upper bound).
//   • Eviction is "drop oldest builtAt when full" — cheap O(n) scan run
//     at most once per insert past the cap.
//
// Invalidation is eager: every write that affects this user's "today"
// state (review/start/master/tracker/todo/note) calls invalidateUser(userId)
// so the next /today request rebuilds. The TTL is only a safety net.
// ─────────────────────────────────────────────────────────────────────────────

const TTL_MS  = 60 * 1000;
const MAX_ENT = 5000;

// Map<userIdString, { value, builtAt, dayPkt }>
const cache = new Map();

const evictIfFull = () => {
  if (cache.size < MAX_ENT) return;
  // Find oldest entry. O(n) but only when at the cap — bounded by MAX_ENT.
  let oldestKey = null;
  let oldest    = Infinity;
  for (const [k, v] of cache) {
    if (v.builtAt < oldest) { oldest = v.builtAt; oldestKey = k; }
  }
  if (oldestKey) cache.delete(oldestKey);
};

// Returns the cached value if fresh AND the dayPkt still matches (so a
// midnight rollover automatically forces a rebuild for everyone).
const get = (userId, dayPkt) => {
  const key = String(userId);
  const e = cache.get(key);
  if (!e) return null;
  if (e.dayPkt !== dayPkt) return null;
  if ((Date.now() - e.builtAt) >= TTL_MS) return null;
  return e.value;
};

const set = (userId, dayPkt, value) => {
  evictIfFull();
  cache.set(String(userId), { value, builtAt: Date.now(), dayPkt });
};

const invalidateUser = (userId) => { cache.delete(String(userId)); };
const clearAll       = ()         => { cache.clear(); };

module.exports = { get, set, invalidateUser, clearAll };
