// ── Question-bank counts cache ───────────────────────────────────────────────
// Holds two pieces of QB-wide data that don't depend on the requesting user:
//   • topicCountsByQB:  Map<qbId, { topicId: count }>
//   • totalsByQB:       Map<qbId, totalMcqCount>
//
// Both are derived purely from MCQ documents. They serve every student from
// the same in-memory copy, so even thousands of concurrent QB-picker loads
// translate to zero DB work after warm-up.
//
// Why per-QB and not per-user:
//   QB counts change ONLY when admins add/remove/edit MCQs (minutes-to-hours
//   apart). Per-user history changes on every test submission (seconds apart
//   for active students), which would force constant invalidation and make
//   the cache thrashy. We deliberately do NOT cache per-user data here.
//
// Memory math:
//   ~50 topics × ~40 bytes per entry = ~2 KB per QB. Even 1,000 QBs is ~2 MB.
//
// Strategy mirrors syllabusTreeCache.js:
//   • TTL safety net (1h) in case an invalidation hook is ever missed.
//   • Eager invalidation on admin writes is the real correctness mechanism.
//   • Lazy build on first miss after invalidation.
// ─────────────────────────────────────────────────────────────────────────────

const TTL_MS = 60 * 60 * 1000;   // 1h — safety net only; admin writes invalidate eagerly.

// Each map value is { value, builtAt } so a stale entry can be detected.
const topicCountsByQB = new Map(); // String(qbId) → { value: {topicId: count}, builtAt }
const totalsByQB      = new Map(); // String(qbId) → { value: totalCount,      builtAt }

const isFresh = (entry) => entry && (Date.now() - entry.builtAt) < TTL_MS;

// ── Topic counts per QB ──────────────────────────────────────────────────────
// `value` is the object { byTopic, byChapterLoose, bySubjectLoose } built by
// getTopicCounts. The loose buckets hold partially-classified MCQs (subject-only
// or subject+chapter) so per-subject/chapter availability sums don't miss them.
const getTopicCounts = (qbId) => {
  const e = topicCountsByQB.get(String(qbId));
  return isFresh(e) ? e.value : null;
};

const sumBucket = (obj) => Object.values(obj || {}).reduce((a, b) => a + b, 0);

const setTopicCounts = (qbId, counts) => {
  const key = String(qbId);
  const now = Date.now();
  topicCountsByQB.set(key, { value: counts, builtAt: now });
  // The three buckets together account for every classified MCQ in the QB, so
  // their combined sum is the QB total — keep both maps in sync so a
  // /question-banks call after a topic-counts hit can skip the batch aggregation.
  const total = sumBucket(counts?.byTopic)
    + sumBucket(counts?.byChapterLoose)
    + sumBucket(counts?.bySubjectLoose);
  totalsByQB.set(key, { value: total, builtAt: now });
};

// ── Per-QB totals (independent setter so the batch aggregation in the
// QB list endpoint can populate just the totals without per-topic data) ─────
const getTotal = (qbId) => {
  const e = totalsByQB.get(String(qbId));
  return isFresh(e) ? e.value : null;
};

const setTotal = (qbId, n) => {
  totalsByQB.set(String(qbId), { value: n, builtAt: Date.now() });
};

// ── Invalidation ─────────────────────────────────────────────────────────────
// Called from any MCQ CRUD that may change the count. Safe with null/undefined
// qbId — just no-ops, which simplifies callers that pass through legacy MCQs
// without a questionBankId.
const invalidate = (qbId) => {
  if (!qbId) return;
  const key = String(qbId);
  topicCountsByQB.delete(key);
  totalsByQB.delete(key);
};

// Convenience: invalidate several at once (e.g. an MCQ update that moves
// from one QB to another — both old and new counts go stale).
const invalidateMany = (qbIds) => {
  if (!Array.isArray(qbIds)) return;
  qbIds.forEach(invalidate);
};

const invalidateAll = () => {
  topicCountsByQB.clear();
  totalsByQB.clear();
};

module.exports = {
  getTopicCounts,
  setTopicCounts,
  getTotal,
  setTotal,
  invalidate,
  invalidateMany,
  invalidateAll,
};
