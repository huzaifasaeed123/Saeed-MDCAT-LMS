const UserDailyTodo     = require('../models/UserDailyTodo');
const UserTopicProgress = require('../models/UserTopicProgress');
const SyllabusTopic     = require('../models/SyllabusTopic');
const { todayPkt }      = require('../utils/dayPkt');
const treeCache         = require('../utils/syllabusTreeCache');
const todayCache        = require('../utils/syllabusTodayCache');

const TASK_TYPES = new Set(['lecture', 'book', 'mcqs', 'revise', 'custom']);

// ─── GET /api/syllabus/me/todo?day=YYYY-MM-DD ────────────────────────────────
exports.listTodos = async (req, res) => {
  try {
    const day = String(req.query.day || todayPkt());
    const rows = await UserDailyTodo.find({ user: req.user.id, dayPkt: day })
      .sort({ done: 1, sortOrder: 1, createdAt: 1 })
      .lean();

    // Hydrate topic info via the in-memory tree (no DB join).
    const enriched = await Promise.all(rows.map(async (r) => {
      if (!r.topic) return r;
      const t = await treeCache.getTopicById(r.topic);
      return t ? { ...r,
        subject: t.subject, unitNumber: t.unitNumber, unitTitle: t.unitTitle,
        outcomeCode: t.outcomeCode, outcomeText: t.outcomeText,
      } : r;
    }));

    res.json({ success: true, day, total: enriched.length, data: enriched });
  } catch (err) {
    console.error('listTodos error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── POST /api/syllabus/me/todo ─────────────────────────────────────────────
exports.createTodo = async (req, res) => {
  try {
    const b = req.body || {};
    const day = String(b.day || todayPkt());
    const taskType = String(b.taskType || '').toLowerCase();
    if (!TASK_TYPES.has(taskType)) return res.status(400).json({ success: false, message: 'invalid taskType' });

    const taskText = String(b.taskText || '').trim();
    const targetCount = Math.max(0, parseInt(b.targetCount, 10) || 0);

    if (taskType !== 'custom' && !b.topic) {
      return res.status(400).json({ success: false, message: `topic is required for taskType=${taskType}` });
    }
    if (taskType === 'custom' && !taskText) {
      return res.status(400).json({ success: false, message: 'taskText required for custom items' });
    }

    if (b.topic) {
      const t = await treeCache.getTopicById(b.topic);
      if (!t) return res.status(404).json({ success: false, message: 'topic not found' });

      // Dedup: refuse same (topic, taskType, day) twice.
      const dup = await UserDailyTodo.findOne(
        { user: req.user.id, dayPkt: day, topic: b.topic, taskType },
        { _id: 1 }
      ).lean();
      if (dup) return res.status(409).json({ success: false, message: 'Already on this day\'s list', existingId: dup._id });
    }

    // Pick a sortOrder at end of the day.
    const last = await UserDailyTodo.findOne({ user: req.user.id, dayPkt: day })
      .sort({ sortOrder: -1 }).select('sortOrder').lean();
    const sortOrder = last ? (last.sortOrder + 1) : 0;

    const doc = await UserDailyTodo.create({
      user:        req.user.id,
      dayPkt:      day,
      topic:       b.topic || null,
      taskType,
      taskText,
      targetCount,
      sortOrder,
    });
    todayCache.invalidateUser(req.user.id);
    res.status(201).json({ success: true, data: doc.toObject() });
  } catch (err) {
    console.error('createTodo error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── PATCH /api/syllabus/me/todo/:id ─────────────────────────────────────────
exports.updateTodo = async (req, res) => {
  try {
    const b = req.body || {};
    const update = {};
    if (b.done !== undefined) {
      const d = !!b.done;
      update.done = d;
      update.doneAt = d ? new Date() : null;
    }
    if (typeof b.taskText === 'string') update.taskText = b.taskText.trim();
    if (b.targetCount !== undefined) {
      const n = parseInt(b.targetCount, 10);
      if (Number.isFinite(n) && n >= 0) update.targetCount = n;
    }
    if (b.sortOrder !== undefined) {
      const n = parseInt(b.sortOrder, 10);
      if (Number.isFinite(n)) update.sortOrder = n;
    }
    if (Object.keys(update).length === 0) return res.json({ success: true, unchanged: true });

    const doc = await UserDailyTodo.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: update },
      { new: true, lean: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Todo not found' });

    todayCache.invalidateUser(req.user.id);
    res.json({ success: true, data: doc });
  } catch (err) {
    console.error('updateTodo error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── DELETE /api/syllabus/me/todo/:id ────────────────────────────────────────
exports.deleteTodo = async (req, res) => {
  try {
    const doc = await UserDailyTodo.findOneAndDelete({ _id: req.params.id, user: req.user.id }).lean();
    if (!doc) return res.status(404).json({ success: false, message: 'Todo not found' });
    todayCache.invalidateUser(req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteTodo error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── POST /api/syllabus/me/todo/seed ─────────────────────────────────────────
// "Plan my day" — bulk-creates today's todo from due topics + tracker gaps +
// N suggested-new topics. Idempotent — uses bulkWrite with the same dedup
// rule used by the manual create endpoint. ONE round-trip to write all items.
exports.seedTodo = async (req, res) => {
  try {
    const b = req.body || {};
    const day = String(b.day || todayPkt());
    const userId = req.user.id;

    const includeDue      = b.includeDue      !== false;
    const includeTrackers = b.includeTrackers !== false;
    const includeNew      = Math.max(0, Math.min(10, parseInt(b.includeNew, 10) || 0));

    // 1. existing items for this day — for dedup + sortOrder seed
    const existing = await UserDailyTodo.find({ user: userId, dayPkt: day })
      .select('topic taskType sortOrder').lean();
    const dupKey = new Set(existing.map((e) => `${e.topic ? String(e.topic) : ''}|${e.taskType}`));
    let nextSort = existing.length === 0
      ? 0
      : Math.max(...existing.map((e) => e.sortOrder || 0)) + 1;

    const ops = [];
    const addItem = (topic, taskType, targetCount = 0) => {
      const key = `${topic ? String(topic) : ''}|${taskType}`;
      if (dupKey.has(key)) return false;
      dupKey.add(key);
      ops.push({
        insertOne: {
          document: {
            user: userId, dayPkt: day, topic, taskType,
            taskText: '', targetCount, sortOrder: nextSort++,
            done: false, doneAt: null, createdAt: new Date(), updatedAt: new Date(),
          },
        },
      });
      return true;
    };

    if (includeDue) {
      const dueRows = await UserTopicProgress.find({
        user: userId,
        status: { $ne: 'mastered' },
        nextReviewDay: { $gt: '', $lte: day },
      }).sort({ nextReviewDay: 1 }).select('topic').limit(20).lean();
      for (const r of dueRows) addItem(r.topic, 'revise', 0);
    }

    if (includeTrackers) {
      const gapRows = await UserTopicProgress.find({
        user: userId,
        $or: [
          { lectureDone: true, bookDone: false },
          { $expr: { $and: [
              { $eq: ['$lectureDone', true] },
              { $eq: ['$bookDone', true] },
              { $lt: ['$mcqCount', '$mcqTarget'] },
          ]}},
        ],
      }).select('topic lectureDone bookDone mcqCount mcqTarget').sort({ lastReviewedAt: -1 }).limit(15).lean();
      for (const r of gapRows) {
        if (r.lectureDone && !r.bookDone) addItem(r.topic, 'book', 0);
        else if (r.lectureDone && r.bookDone && r.mcqCount < r.mcqTarget) {
          addItem(r.topic, 'mcqs', Math.max(10, r.mcqTarget - r.mcqCount));
        }
      }
    }

    if (includeNew > 0) {
      const startedIds = await UserTopicProgress.find({ user: userId }).select('topic').lean();
      const startedSet = new Set(startedIds.map((s) => String(s.topic)));
      const news = await SyllabusTopic.find({ _id: { $nin: [...startedSet] } })
        .sort({ subject: 1, unitNumber: 1, sortOrder: 1 })
        .limit(includeNew)
        .select('_id').lean();
      for (const n of news) addItem(n._id, 'lecture', 0);
    }

    let added = 0;
    if (ops.length > 0) {
      const result = await UserDailyTodo.bulkWrite(ops, { ordered: false });
      added = result.insertedCount || 0;
    }
    todayCache.invalidateUser(userId);
    res.json({ success: true, day, added });
  } catch (err) {
    console.error('seedTodo error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
