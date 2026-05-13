const SyllabusTopic       = require('../models/SyllabusTopic');
const UserTopicProgress   = require('../models/UserTopicProgress');
const TopicRevisionLog    = require('../models/TopicRevisionLog');
const UserDailyTodo       = require('../models/UserDailyTodo');
const UserStickyNote      = require('../models/UserStickyNote');
const treeCache           = require('../utils/syllabusTreeCache');
const todayCache          = require('../utils/syllabusTodayCache');

// ─── PUBLIC: tree ────────────────────────────────────────────────────────────
// Cached. Same JSON for every user, so we only build it once per admin write.
exports.getTree = async (_req, res) => {
  try {
    const tree = await treeCache.getTree();
    res.json({ success: true, ...tree, source: 'PMDC MDCAT 2025' });
  } catch (err) {
    console.error('getTree error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── ADMIN: listing (flat) — used by the admin editor table ─────────────────
exports.adminListTopics = async (req, res) => {
  try {
    const q = {};
    if (req.query.subject)    q.subject    = req.query.subject;
    if (req.query.unitNumber) q.unitNumber = parseInt(req.query.unitNumber, 10);
    const rows = await SyllabusTopic.find(q)
      .sort({ subject: 1, unitNumber: 1, sortOrder: 1, outcomeCode: 1 })
      .lean();
    res.json({ success: true, total: rows.length, data: rows });
  } catch (err) {
    console.error('adminListTopics error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── ADMIN: units overview (grouped, with counts) ────────────────────────────
exports.adminListUnits = async (_req, res) => {
  try {
    const rows = await SyllabusTopic.aggregate([
      { $group: {
          _id: { subject: '$subject', unitNumber: '$unitNumber' },
          unitTitle:    { $first: '$unitTitle' },
          linkedDeck:   { $first: '$linkedDeck' },
          outcomeCount: { $sum: 1 },
      }},
      { $sort: { '_id.subject': 1, '_id.unitNumber': 1 } },
    ]);
    const units = rows.map((r) => ({
      subject:      r._id.subject,
      unitNumber:   r._id.unitNumber,
      unitTitle:    r.unitTitle,
      linkedDeck:   r.linkedDeck,
      outcomeCount: r.outcomeCount,
    }));
    res.json({ success: true, total: units.length, data: units });
  } catch (err) {
    console.error('adminListUnits error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── ADMIN: create one topic ─────────────────────────────────────────────────
exports.createTopic = async (req, res) => {
  try {
    const { subject, unitNumber, unitTitle, outcomeCode, outcomeText, sortOrder, linkedDeck } = req.body;
    if (!subject?.trim() || !unitTitle?.trim() || !outcomeCode?.trim() || !outcomeText?.trim()) {
      return res.status(400).json({ success: false, message: 'subject, unitTitle, outcomeCode, outcomeText are required' });
    }
    const u = parseInt(unitNumber, 10);
    if (!Number.isFinite(u) || u < 1) {
      return res.status(400).json({ success: false, message: 'unitNumber must be >= 1' });
    }

    // Auto-pick sortOrder if not supplied: append at end of the unit.
    let so = parseInt(sortOrder, 10);
    if (!Number.isFinite(so)) {
      const last = await SyllabusTopic.findOne({ subject: subject.trim(), unitNumber: u })
        .sort({ sortOrder: -1 }).select('sortOrder').lean();
      so = last ? (last.sortOrder + 1) : 0;
    }

    const doc = await SyllabusTopic.create({
      subject:     subject.trim(),
      unitNumber:  u,
      unitTitle:   unitTitle.trim(),
      outcomeCode: outcomeCode.trim(),
      outcomeText: outcomeText.trim(),
      sortOrder:   so,
      linkedDeck:  linkedDeck || null,
    });

    treeCache.invalidate();
    // Stale per-user "today" caches reference topic data — clear all so newly-
    // created topics are visible in the next /today request. Cheap; today cache
    // rebuilds on demand.
    todayCache.clearAll();
    res.status(201).json({ success: true, data: doc.toObject() });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: 'Outcome code already exists in this unit' });
    }
    console.error('createTopic error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── ADMIN: edit one topic ───────────────────────────────────────────────────
exports.updateTopic = async (req, res) => {
  try {
    const update = {};
    const { unitTitle, outcomeCode, outcomeText, sortOrder, linkedDeck } = req.body;
    if (unitTitle   !== undefined) update.unitTitle   = String(unitTitle).trim();
    if (outcomeCode !== undefined) update.outcomeCode = String(outcomeCode).trim();
    if (outcomeText !== undefined) update.outcomeText = String(outcomeText).trim();
    if (sortOrder   !== undefined) update.sortOrder   = parseInt(sortOrder, 10);
    if (linkedDeck  !== undefined) update.linkedDeck  = linkedDeck || null;

    const doc = await SyllabusTopic.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, lean: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Topic not found' });

    treeCache.invalidate();
    todayCache.clearAll();
    res.json({ success: true, data: doc });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: 'Outcome code conflict' });
    }
    console.error('updateTopic error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── ADMIN: delete one topic + cascade per-user progress/logs/todos ─────────
exports.deleteTopic = async (req, res) => {
  try {
    const doc = await SyllabusTopic.findByIdAndDelete(req.params.id).lean();
    if (!doc) return res.status(404).json({ success: false, message: 'Topic not found' });

    // Cascades — fire-and-forget so the response goes out instantly.
    UserTopicProgress.deleteMany({ topic: doc._id }).catch(() => {});
    TopicRevisionLog.deleteMany({ topic: doc._id }).catch(() => {});
    UserDailyTodo.deleteMany({ topic: doc._id }).catch(() => {});
    UserStickyNote.updateMany({ topic: doc._id }, { $set: { topic: null } }).catch(() => {});

    treeCache.invalidate();
    todayCache.clearAll();
    res.json({ success: true });
  } catch (err) {
    console.error('deleteTopic error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── ADMIN: rename a whole unit (bulk across all its topics) ─────────────────
exports.renameUnit = async (req, res) => {
  try {
    const { subject, unitNumber } = req.params;
    const { unitTitle } = req.body;
    if (!unitTitle?.trim()) return res.status(400).json({ success: false, message: 'unitTitle required' });

    const n = parseInt(unitNumber, 10);
    const r = await SyllabusTopic.updateMany(
      { subject, unitNumber: n },
      { $set: { unitTitle: unitTitle.trim() } }
    );
    if (r.matchedCount === 0) return res.status(404).json({ success: false, message: 'Unit not found' });

    treeCache.invalidate();
    todayCache.clearAll();
    res.json({ success: true, matched: r.matchedCount, modified: r.modifiedCount });
  } catch (err) {
    console.error('renameUnit error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── ADMIN: delete an entire unit ────────────────────────────────────────────
exports.deleteUnit = async (req, res) => {
  try {
    const { subject, unitNumber } = req.params;
    const n = parseInt(unitNumber, 10);

    const topics = await SyllabusTopic.find({ subject, unitNumber: n }).select('_id').lean();
    const ids = topics.map((t) => t._id);
    if (ids.length === 0) return res.status(404).json({ success: false, message: 'Unit not found' });

    await SyllabusTopic.deleteMany({ _id: { $in: ids } });
    UserTopicProgress.deleteMany({ topic: { $in: ids } }).catch(() => {});
    TopicRevisionLog.deleteMany({ topic:  { $in: ids } }).catch(() => {});
    UserDailyTodo.deleteMany({ topic:     { $in: ids } }).catch(() => {});
    UserStickyNote.updateMany({ topic: { $in: ids } }, { $set: { topic: null } }).catch(() => {});

    treeCache.invalidate();
    todayCache.clearAll();
    res.json({ success: true, deleted: ids.length });
  } catch (err) {
    console.error('deleteUnit error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── ADMIN: bulk import from JSON ────────────────────────────────────────────
// Accepts the SKN-style JSON:
//   { units: [ { s: 'Biology', u: 1, title: 'Acellular Life',
//                outcomes: [ { c: '1.1', t: '…' }, ... ] }, ... ] }
// Idempotent — re-running the same JSON updates existing rows (matched by
// subject+unitNumber+outcomeCode) and inserts the rest. Safe to run multiple
// times. Wipes BOTH caches at the end.
exports.bulkImport = async (req, res) => {
  try {
    const units = Array.isArray(req.body?.units) ? req.body.units : null;
    if (!units) return res.status(400).json({ success: false, message: 'Body must be { units: [...] }' });

    const ops = [];
    let prepared = 0;
    for (const unit of units) {
      const subject    = String(unit.s || unit.subject || '').trim();
      const u          = parseInt(unit.u || unit.unitNumber, 10);
      const unitTitle  = String(unit.title || unit.unitTitle || '').trim();
      if (!subject || !Number.isFinite(u) || !unitTitle) continue;

      const outcomes = Array.isArray(unit.outcomes) ? unit.outcomes : [];
      let order = 0;
      for (const o of outcomes) {
        const outcomeCode = String(o.c || o.outcomeCode || '').trim();
        const outcomeText = String(o.t || o.outcomeText || '').trim();
        if (!outcomeCode || !outcomeText) continue;
        ops.push({
          updateOne: {
            filter: { subject, unitNumber: u, outcomeCode },
            update: { $set: { unitTitle, outcomeText, sortOrder: order } },
            upsert: true,
          },
        });
        order++;
        prepared++;
      }
    }

    if (ops.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid topics in body' });
    }

    const r = await SyllabusTopic.bulkWrite(ops, { ordered: false });
    treeCache.invalidate();
    todayCache.clearAll();
    res.json({
      success: true,
      prepared,
      inserted: r.upsertedCount || 0,
      modified: r.modifiedCount || 0,
    });
  } catch (err) {
    console.error('bulkImport error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
