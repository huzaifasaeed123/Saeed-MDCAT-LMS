// ── Syllabus-tree cache ──────────────────────────────────────────────────────
// The full PMDC topic tree is identical for every student and changes only
// when an admin edits the catalog. We build it once, hold it in memory, and
// invalidate on every admin write. ~99% of /tree reads hit the cache → zero
// DB work on this hot path.
//
// Strategy mirrors announcementsCache.js:
//   • TTL 10 min as a safety net (admin write also invalidates eagerly).
//   • Built lazily on first miss after invalidation.
//   • Cache stores TWO shapes: the tree (for /tree) and a Map<topicId, topic>
//     (for fast lookups in controllers that need to validate a topic id).
// ─────────────────────────────────────────────────────────────────────────────

const SyllabusTopic = require('../models/SyllabusTopic');

const TTL_MS = 10 * 60 * 1000;

let cache = null;       // { tree, byId, total, builtAt }

const build = async () => {
  const rows = await SyllabusTopic.find({})
    .sort({ subject: 1, unitNumber: 1, sortOrder: 1, outcomeCode: 1 })
    .lean();

  // Group: subject -> [{unitNumber, unitTitle, linkedDeck, outcomes:[]}]
  const bySubject = new Map();
  const byId      = new Map();
  for (const r of rows) {
    byId.set(String(r._id), r);
    let subj = bySubject.get(r.subject);
    if (!subj) { subj = new Map(); bySubject.set(r.subject, subj); }
    let unit = subj.get(r.unitNumber);
    if (!unit) {
      unit = {
        unitNumber: r.unitNumber,
        unitTitle:  r.unitTitle,
        linkedDeck: r.linkedDeck || null,
        outcomes:   [],
      };
      subj.set(r.unitNumber, unit);
    }
    unit.outcomes.push({
      _id:         r._id,
      outcomeCode: r.outcomeCode,
      outcomeText: r.outcomeText,
    });
  }

  const subjects = [...bySubject.keys()].sort().map((s) => ({
    subject: s,
    units:   [...bySubject.get(s).values()].sort((a, b) => a.unitNumber - b.unitNumber),
  }));

  return { tree: { subjects, total: rows.length }, byId, total: rows.length, builtAt: Date.now() };
};

const getTree = async () => {
  if (cache && (Date.now() - cache.builtAt) < TTL_MS) return cache.tree;
  cache = await build();
  return cache.tree;
};

// Fast topic lookup without a DB round-trip. Returns null if unknown.
const getTopicById = async (topicId) => {
  if (!cache || (Date.now() - cache.builtAt) >= TTL_MS) cache = await build();
  return cache.byId.get(String(topicId)) || null;
};

const invalidate = () => { cache = null; };

module.exports = { getTree, getTopicById, invalidate };
