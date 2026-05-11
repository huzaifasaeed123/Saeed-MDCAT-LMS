// ─── Announcements cache ─────────────────────────────────────────────────────
// Hot path: every SSE connect (= every browser tab open) needs the latest
// 15 visible announcements. Without this cache, 40k DAU would hammer the
// `Announcement.find().limit(15)` query on every connect.
//
// Strategy:
//   • Cache the latest-15 list per audience role (3 buckets: student / teacher
//     / admin). Almost all reads hit the cache.
//   • Mutations (create / update / delete / pin) call invalidate(), so the
//     next read rebuilds. Lazy build = only roles that were actually requested
//     get rebuilt.
//   • TTL of 60s as a safety net — covers the case where an announcement's
//     `expiresAt` lapses between mutations. Not a freshness guarantee — the
//     mutation invalidate() is what matters for new content.
//
// Result: 99%+ of SSE connects do ZERO database work for announcements.
// ─────────────────────────────────────────────────────────────────────────────

const Announcement = require('../models/Announcement');

const TTL_MS = 60 * 1000;

const audienceFor = (role) => {
  if (role === 'student') return ['everyone', 'students'];
  if (role === 'teacher') return ['everyone', 'teachers'];
  if (role === 'admin')   return ['everyone', 'admins'];
  return ['everyone'];
};

// Map<role, { list, builtAt }>
const cache = new Map();

const buildFor = async (role) => {
  const list = await Announcement.find({
    audience: { $in: audienceFor(role) },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  })
    .sort({ pinned: -1, createdAt: -1 })
    .limit(15)
    .lean();
  cache.set(role, { list, builtAt: Date.now() });
  return list;
};

// Returns the latest-15 list for a given role. Caller must NOT mutate the
// returned array — it's shared. A shallow copy is cheap if mutation is needed.
const getLatestForRole = async (role) => {
  const key = ['student', 'teacher', 'admin'].includes(role) ? role : 'student';
  const entry = cache.get(key);
  if (entry && (Date.now() - entry.builtAt) < TTL_MS) return entry.list;
  return buildFor(key);
};

// Drop all cached buckets. Cheap — next read for each role rebuilds lazily.
const invalidate = () => {
  cache.clear();
};

module.exports = { getLatestForRole, invalidate };
