// ── Question-bank counts cache ───────────────────────────────────────────────
// Holds two pieces of QB-wide data that don't depend on the requesting user:
//   • topicCountsByQB:  Map<qbId, { bySubject, byChapter, byTopic }>
//       bySubject: { subjectId: count }  — MCQs counted DIRECTLY by qbSubjectId
//       byChapter: { chapterId: count }  — MCQs counted DIRECTLY by qbChapterId
//       byTopic:   { topicId:   count }  — MCQs counted DIRECTLY by qbTopicId
//     (top-down: each level is counted by its own id, so an MCQ that stops at
//      subject/chapter is still counted at that level. The app enforces the
//      full subject→chapter→topic chain, so a deeper id always implies its
//      ancestors are present.)
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

// ── Topic counts ({ topicId: count } per QB) ────────────────────────────────
const getTopicCounts = (qbId) => {
  const e = topicCountsByQB.get(String(qbId));
  return isFresh(e) ? e.value : null;
};

const setTopicCounts = (qbId, counts) => {
  const key = String(qbId);
  const now = Date.now();
  topicCountsByQB.set(key, { value: counts, builtAt: now });
  // Keep the QB total in sync so a /question-banks call after a topic-counts
  // hit can skip its batch aggregation. Derive it from bySubject: every MCQ
  // carries a qbSubjectId (the app enforces subject-first classification), so
  // summing the per-subject counts equals the true total — INCLUDING MCQs that
  // stop at subject/chapter and have no topic. (The old code summed topic
  // buckets, which silently dropped topic-less MCQs — that's the undercount bug
  // this replaces.)
  const bySubject = counts?.bySubject || {};
  const total = Object.values(bySubject).reduce((a, b) => a + b, 0);
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
