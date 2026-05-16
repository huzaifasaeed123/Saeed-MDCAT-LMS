// ── User-access cache ────────────────────────────────────────────────────────
// The featureGate middleware runs on every request to a gated route. Without
// a cache that would mean one User.findById per request — the exact "hot-path
// burden" the system was designed to avoid.
//
// Strategy mirrors syllabusTodayCache:
//   • TTL 10 min as a safety net.
//   • LRU bounded at 10 000 active users (~5 MB worst case).
//   • Eager invalidation on every admin write (PATCH /access, course toggles)
//     PLUS an SSE 'feature_access_updated' push so the user's tabs re-render
//     within milliseconds of an admin change.
//
// Stored value per user: { role, featureAccess: {...flags}, courseAccess: Set<courseId>, builtAt }.
// `role` lives in the cached value so the staff-bypass check inside
// requireFeature() doesn't need to trust the request user object.
// ─────────────────────────────────────────────────────────────────────────────

const User = require('../models/User');

const TTL_MS  = 10 * 60 * 1000;
const MAX_ENT = 10000;

// Default access shape for users whose row has no featureAccess yet (e.g. rows
// created before this feature shipped). Mongoose schema defaults handle new
// rows; this guards against partial documents.
// 4 real feature flags. 'courses' is intentionally NOT here — course access
// is derived from coursesGrantAll OR courseAccess.length.
const DEFAULT_ACCESS = Object.freeze({
  autoTest:  false,
  community: false,
  videos:    false,
  notes:     false,
});

const cache = new Map(); // Map<userIdString, { role, featureAccess, courseAccess: Set, builtAt }>

const evictIfFull = () => {
  if (cache.size < MAX_ENT) return;
  // Drop the single oldest entry. O(n) but only triggered when at cap.
  let oldestKey = null;
  let oldest    = Infinity;
  for (const [k, v] of cache) {
    if (v.builtAt < oldest) { oldest = v.builtAt; oldestKey = k; }
  }
  if (oldestKey) cache.delete(oldestKey);
};

// Read straight from the DB and shape for the cache. Single .lean() projection
// — never returns the password etc.
const loadFromDb = async (userId) => {
  const u = await User.findById(userId)
    .select('role featureAccess coursesGrantAll courseAccess')
    .lean();
  if (!u) return null;
  return {
    role:            u.role,
    featureAccess:   { ...DEFAULT_ACCESS, ...(u.featureAccess || {}) },
    coursesGrantAll: !!u.coursesGrantAll,
    courseAccess:    new Set((u.courseAccess || []).map((id) => String(id))),
    builtAt:         Date.now(),
  };
};

// Return cached access (cache-aside). Loads on miss / expiry. Returns null
// only if the user row no longer exists.
const getOrLoad = async (userId) => {
  const key = String(userId);
  const hit = cache.get(key);
  if (hit && (Date.now() - hit.builtAt) < TTL_MS) return hit;

  const fresh = await loadFromDb(userId);
  if (!fresh) {
    cache.delete(key);
    return null;
  }
  evictIfFull();
  cache.set(key, fresh);
  return fresh;
};

const invalidateUser = (userId) => { cache.delete(String(userId)); };
const clearAll       = ()        => { cache.clear(); };

// Returns the shape used in API responses (frontend AuthContext stores this).
// `courseAccess` is serialised as an array of id strings.
const toResponseShape = (cached) => ({
  featureAccess:   { ...DEFAULT_ACCESS, ...(cached?.featureAccess || {}) },
  coursesGrantAll: !!cached?.coursesGrantAll,
  courseAccess:    cached ? [...cached.courseAccess] : [],
});

module.exports = {
  DEFAULT_ACCESS,
  getOrLoad,
  invalidateUser,
  clearAll,
  toResponseShape,
};
