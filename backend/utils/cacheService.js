// ─── In-memory cache service ──────────────────────────────────────────────────
// One central place for all short-lived in-memory caches in the app. Domain
// modules (leaderboardCache, pointsService) use this as their storage backend
// and keep only their domain logic (refresh strategy, SSE broadcast, etc.)
// in their own files. To find every cache in the system, look here.
//
// ──────────────────────────────────────────────────────────────────────────
//                            CACHE REGISTRY
// ──────────────────────────────────────────────────────────────────────────
//  Namespace      Key           TTL          Owner                   Notes
//  ──────────────────────────────────────────────────────────────────────
//  feed           default       5 min        postController.getPosts Default community feed; invalidated on
//                                                                     post create/update/delete/pin
//  leaderboard    top10         5 min        leaderboardCache.js     Top 10 students. Manual refresh
//                                                                     throttled to 30s; broadcasts via SSE
//  pointValues    global        never        pointsService.js        Admin-configurable point amounts.
//                                                                     Invalidated when settings are saved
// ──────────────────────────────────────────────────────────────────────────
//
// API:
//   get(ns, key)                    → cached value or null (also auto-deletes if expired)
//   set(ns, key, value, ttlMs?)     → store with TTL (omit/null/0 = never expires)
//   invalidate(ns, key?)            → drop one key, or whole namespace if key omitted
//   remember(ns, key, ttlMs?, fn)   → cache-aside: returns cached if fresh, else fetches + caches
//   getExpiry(ns, key)              → ms timestamp when this entry expires (Infinity = never)
//   list()                          → debug view of every namespace + its entries
// ─────────────────────────────────────────────────────────────────────────────

const stores = new Map(); // namespace → Map<key, { value, expires }>

const get = (namespace, key) => {
  const store = stores.get(namespace);
  if (!store) return null;
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expires) {
    store.delete(key);
    return null;
  }
  return entry.value;
};

const set = (namespace, key, value, ttlMs) => {
  if (!stores.has(namespace)) stores.set(namespace, new Map());
  // Falsy / zero / negative / Infinity TTL = never expires.
  const expires = (ttlMs && ttlMs > 0 && ttlMs !== Infinity) ? Date.now() + ttlMs : Infinity;
  stores.get(namespace).set(key, { value, expires });
};

// Drop a single key, or the whole namespace if `key` is omitted.
const invalidate = (namespace, key) => {
  if (key === undefined) {
    stores.delete(namespace);
    return;
  }
  const store = stores.get(namespace);
  if (store) store.delete(key);
};

// Cache-aside helper. Returns cached value if fresh, otherwise runs fetchFn,
// stores its result, and returns it. Concurrent callers may briefly run
// fetchFn in parallel — acceptable for our use cases since the work is idempotent.
const remember = async (namespace, key, ttlMs, fetchFn) => {
  const cached = get(namespace, key);
  if (cached !== null) return cached;
  const value = await fetchFn();
  set(namespace, key, value, ttlMs);
  return value;
};

// When does this cache entry expire? Infinity = never; 0 = not cached (or already gone).
const getExpiry = (namespace, key) => {
  const store = stores.get(namespace);
  if (!store) return 0;
  const entry = store.get(key);
  return entry?.expires ?? 0;
};

// Debug snapshot of every cache in the app. Useful for ops endpoints / logging.
const list = () => {
  const now = Date.now();
  const result = {};
  for (const [ns, store] of stores) {
    result[ns] = [];
    for (const [key, entry] of store) {
      result[ns].push({
        key,
        expiresIn: entry.expires === Infinity ? 'never' : Math.max(0, entry.expires - now),
        expired:   now >= entry.expires,
      });
    }
  }
  return result;
};

module.exports = { get, set, invalidate, remember, getExpiry, list };
