// backend/utils/courseCache.js
//
// In-memory cache for the *static* portion of a course — the title, hierarchy
// (subjects/chapters/topics/resources), and derived resource counts. The hot
// per-user progress data is computed separately (see /:id/progress).
//
// Lifecycle:
//   • READ  — controllers ask getOrLoad(id, loader) on every GET /courses/:id.
//             Cache hit → 0 DB reads. Miss → loader() runs once and the result
//             is cached until an admin mutates the course.
//   • WRITE — admin endpoints (update/delete/create) call invalidate(id) (or
//             invalidateList() for create+delete which also affect the catalog).
//             Next read repopulates from DB.
//
// Why no TTL? Courses change only when an admin edits them; the matching
// write path always invalidates, so we never serve stale data. The cache is
// process-local (each Node instance maintains its own copy) — admin write
// paths fan out via the existing SSE manager for cross-instance freshness if
// needed later, but for the typical single-instance Coolify deploy this is
// sufficient.

const cache     = new Map();   // courseIdString → fully populated course doc
let   listCache = null;        // cached /courses (catalog) array

const keyOf = (id) => String(id);

// ── Per-course read ─────────────────────────────────────────────────────────
// `loader` runs only on cache miss. Returns whatever loader returns; null is
// cached too (so subsequent requests don't hammer the DB for missing IDs).
async function getOrLoad(id, loader) {
  const k = keyOf(id);
  if (cache.has(k)) return cache.get(k);
  const fresh = await loader();
  cache.set(k, fresh);
  return fresh;
}

// Replace the cached value without going through loader (used by writers
// to push the *new* doc into the cache atomically with the DB write).
function set(id, doc) {
  cache.set(keyOf(id), doc);
}

function invalidate(id) {
  cache.delete(keyOf(id));
  listCache = null;
}

// ── Catalog (GET /courses) cache ────────────────────────────────────────────
function getList() {
  return listCache;
}
function setList(data) {
  listCache = data;
}
function invalidateList() {
  listCache = null;
}

// Wipe everything — used by tests + the boot path for safety.
function clearAll() {
  cache.clear();
  listCache = null;
}

module.exports = {
  getOrLoad, set, invalidate,
  getList,   setList,        invalidateList,
  clearAll,
};
