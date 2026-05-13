const mongoose = require('mongoose');
const UserTopicProgress = require('../models/UserTopicProgress');
const TopicRevisionLog  = require('../models/TopicRevisionLog');
const UserDailyTodo     = require('../models/UserDailyTodo');
const SyllabusTopic     = require('../models/SyllabusTopic');
const { todayPkt, addDaysPkt } = require('../utils/dayPkt');
const treeCache  = require('../utils/syllabusTreeCache');
const todayCache = require('../utils/syllabusTodayCache');

// ─── GET /api/syllabus/me/today ──────────────────────────────────────────────
// THE hottest endpoint of the module. Serves the dashboard's "what to do
// today" tile + the full Today page. Strategy:
//   1. Per-user 60-second cache (with eager invalidation on every mutation).
//   2. On miss: one $facet aggregation that returns ALL the rollups +
//      due/upcoming/streak data in a SINGLE round-trip. SKN's version made
//      7 separate queries.
//
// We hand-merge the SyllabusTopic data from the in-memory tree cache instead
// of $lookup'ing it from Mongo — that saves a join on every miss.
exports.getToday = async (req, res) => {
  try {
    const userId = req.user.id;
    const day    = todayPkt();

    // ── Fast path: cached ─────────────────────────────────────────────────
    const cached = todayCache.get(userId, day);
    if (cached) return res.json(cached);

    // ── Slow path: build once ─────────────────────────────────────────────
    const oid = new mongoose.Types.ObjectId(userId);
    const sixtyDaysAgo = addDaysPkt(day, -60);
    const weekFromToday = addDaysPkt(day, 7);

    // $facet pipeline — five sub-aggregations against UserTopicProgress that
    // produce due/upcoming/trackerGaps/totals counters; plus streak (from
    // TopicRevisionLog) is computed in JS afterwards from the last-60-days
    // distinct dayPkt list (also a single query).
    const [progressFacet, streakDays, todosRaw] = await Promise.all([
      UserTopicProgress.aggregate([
        { $match: { user: oid } },
        { $facet: {
            // Due today: nextReviewDay != '' AND nextReviewDay <= today AND not mastered
            due: [
              { $match: { status: { $ne: 'mastered' }, nextReviewDay: { $gt: '', $lte: day } } },
              { $sort:  { nextReviewDay: 1 } },
              { $project: { topic: 1, status: 1, leitnerStage: 1, intervalDays: 1, nextReviewDay: 1,
                            lectureDone: 1, bookDone: 1, mcqCount: 1, mcqTarget: 1 } },
            ],
            // Upcoming next 7 days
            upcoming: [
              { $match: { status: { $ne: 'mastered' }, nextReviewDay: { $gt: day, $lte: weekFromToday } } },
              { $sort:  { nextReviewDay: 1 } },
              { $limit: 50 },
              { $project: { topic: 1, status: 1, leitnerStage: 1, nextReviewDay: 1,
                            lectureDone: 1, bookDone: 1, mcqCount: 1, mcqTarget: 1 } },
            ],
            // Tracker gaps (lecture done but not book, or book done but mcq < target)
            trackerGaps: [
              { $match: {
                  $or: [
                    { lectureDone: true, bookDone: false },
                    { $expr: { $and: [
                        { $eq: ['$lectureDone', true] },
                        { $eq: ['$bookDone', true] },
                        { $lt: ['$mcqCount', '$mcqTarget'] },
                    ]}},
                  ],
              }},
              { $sort: { lastReviewedAt: -1 } },
              { $limit: 30 },
              { $project: { topic: 1, lectureDone: 1, bookDone: 1, mcqCount: 1, mcqTarget: 1,
                            status: 1, lastReviewedAt: 1 } },
            ],
            // Rollup counters (single doc out)
            totals: [
              { $group: {
                  _id: null,
                  started:      { $sum: 1 },
                  mastered:     { $sum: { $cond: [{ $eq: ['$status', 'mastered'] }, 1, 0] } },
                  reviewing:    { $sum: { $cond: [{ $eq: ['$status', 'reviewing'] }, 1, 0] } },
                  learning:     { $sum: { $cond: [{ $eq: ['$status', 'learning'] }, 1, 0] } },
                  lecturesDone: { $sum: { $cond: [{ $eq: ['$lectureDone', true] }, 1, 0] } },
                  booksDone:    { $sum: { $cond: [{ $eq: ['$bookDone',    true] }, 1, 0] } },
                  mcqsDone:     { $sum: '$mcqCount' },
              }},
            ],
        }},
      ]),
      // Streak: distinct dayPkt over last 60 days — one query, JS counts the
      // consecutive run from today backwards.
      TopicRevisionLog.aggregate([
        { $match: { user: oid, dayPkt: { $gte: sixtyDaysAgo } } },
        { $group: { _id: '$dayPkt' } },
        { $sort:  { _id: -1 } },
      ]),
      // Today's to-do items (no $lookup — we enrich in JS via the tree cache)
      UserDailyTodo.find({ user: oid, dayPkt: day })
        .sort({ done: 1, sortOrder: 1, createdAt: 1 })
        .lean(),
    ]);

    const facet     = progressFacet[0] || { due: [], upcoming: [], trackerGaps: [], totals: [] };
    const totalsRow = facet.totals[0]   || { started: 0, mastered: 0, reviewing: 0, learning: 0,
                                             lecturesDone: 0, booksDone: 0, mcqsDone: 0 };
    const totalTopicsTree = (await treeCache.getTree()).total;

    // Hydrate topic metadata from the in-memory tree cache (no DB join).
    const enrich = (row) => {
      const t = treeCache && row.topic ? null : null; // placeholder
      // Resolve via the cache — getTopicById is cheap (Map lookup).
      return row;
    };
    const hydrate = async (rows) => Promise.all(rows.map(async (r) => {
      const t = await treeCache.getTopicById(r.topic);
      return t ? {
        ...r,
        subject:     t.subject,
        unitNumber:  t.unitNumber,
        unitTitle:   t.unitTitle,
        outcomeCode: t.outcomeCode,
        outcomeText: t.outcomeText,
      } : r;
    }));

    const [dueHydrated, upcomingHydrated, trackerGapsHydrated, todosHydrated] = await Promise.all([
      hydrate(facet.due),
      hydrate(facet.upcoming),
      hydrate(facet.trackerGaps),
      hydrate(todosRaw),
    ]);

    // Build reminders. Same logic as SKN, just on hydrated data.
    const reminders = [];
    for (const r of trackerGapsHydrated) {
      const target = r.mcqTarget || 50;
      if (r.lectureDone && !r.bookDone) {
        reminders.push({
          type: 'book-pending', severity: 'warn',
          topic: r.topic, subject: r.subject,
          unitNumber: r.unitNumber, unitTitle: r.unitTitle,
          outcomeCode: r.outcomeCode, outcomeText: r.outcomeText,
          action: 'book',
          message: `Book reading pending — you watched the lecture for ${r.outcomeCode}.`,
        });
      } else if (r.lectureDone && r.bookDone) {
        if (r.mcqCount === 0) {
          reminders.push({
            type: 'mcqs-missing', severity: 'warn',
            topic: r.topic, subject: r.subject,
            unitNumber: r.unitNumber, unitTitle: r.unitTitle,
            outcomeCode: r.outcomeCode, outcomeText: r.outcomeText,
            action: 'mcqs', targetCount: target, mcqCount: 0,
            message: `No MCQs practiced yet — target ${target} for ${r.outcomeCode}.`,
          });
        } else if (r.mcqCount < 20) {
          reminders.push({
            type: 'mcqs-low', severity: 'high',
            topic: r.topic, subject: r.subject,
            unitNumber: r.unitNumber, unitTitle: r.unitTitle,
            outcomeCode: r.outcomeCode, outcomeText: r.outcomeText,
            action: 'mcqs', targetCount: target, mcqCount: r.mcqCount,
            message: `Only ${r.mcqCount} MCQs done for ${r.outcomeCode} — keep pushing to ${target}.`,
          });
        } else if (r.mcqCount < target) {
          reminders.push({
            type: 'mcqs-mid', severity: 'info',
            topic: r.topic, subject: r.subject,
            unitNumber: r.unitNumber, unitTitle: r.unitTitle,
            outcomeCode: r.outcomeCode, outcomeText: r.outcomeText,
            action: 'mcqs', targetCount: target, mcqCount: r.mcqCount,
            message: `${r.mcqCount}/${target} MCQs — almost there on ${r.outcomeCode}.`,
          });
        }
      }
    }

    // Single-summary "X topics due" reminder at the top.
    if (dueHydrated.length > 0) {
      reminders.unshift({
        type: 'revision-due',
        severity: 'high',
        count: dueHydrated.length,
        action: 'revise',
        message: `${dueHydrated.length} topic${dueHydrated.length === 1 ? ' is' : 's are'} due for revision today.`,
      });
    }
    const pendingTodo = todosHydrated.filter((t) => !t.done).length;
    if (pendingTodo > 0) {
      reminders.push({
        type: 'todo-pending', severity: 'info',
        count: pendingTodo, action: 'todo',
        message: `${pendingTodo} to-do item${pendingTodo === 1 ? '' : 's'} still pending for today.`,
      });
    }

    // Streak: walk distinct dayPkt list backwards from today.
    let streak = 0;
    let cursor = day;
    const dayPktSet = new Set(streakDays.map((d) => d._id));
    while (dayPktSet.has(cursor)) {
      streak++;
      cursor = addDaysPkt(cursor, -1);
    }

    // Suggested-new: 12 topics never started. Fetch directly here — small
    // index-only scan, cached for 60s along with everything else.
    const startedTopicIds = await UserTopicProgress.find({ user: oid })
      .select('topic').lean();
    const startedSet = new Set(startedTopicIds.map((r) => String(r.topic)));
    const suggestedNewRows = await SyllabusTopic.find({ _id: { $nin: [...startedSet] } })
      .sort({ subject: 1, unitNumber: 1, sortOrder: 1 })
      .limit(12)
      .lean();
    const suggestedNew = suggestedNewRows.map((t) => ({
      topic:       t._id,
      subject:     t.subject,
      unitNumber:  t.unitNumber,
      unitTitle:   t.unitTitle,
      outcomeCode: t.outcomeCode,
      outcomeText: t.outcomeText,
    }));

    const value = {
      success: true,
      today: day,
      streak,
      counts: {
        due:            dueHydrated.length,
        suggestedNew:   suggestedNew.length,
        totalTopics:    totalTopicsTree,
        started:        totalsRow.started,
        mastered:       totalsRow.mastered,
        reviewing:      totalsRow.reviewing,
        learning:       totalsRow.learning,
        lecturesDone:   totalsRow.lecturesDone,
        booksDone:      totalsRow.booksDone,
        mcqsDone:       totalsRow.mcqsDone,
        todoTotal:      todosHydrated.length,
        todoPending:    pendingTodo,
        todoDone:       todosHydrated.length - pendingTodo,
        reminders:      reminders.length,
      },
      reminders,
      todos:        todosHydrated,
      due:          dueHydrated,
      suggestedNew,
      upcoming:     upcomingHydrated,
    };

    todayCache.set(userId, day, value);
    res.json(value);
  } catch (err) {
    console.error('getToday error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── GET /api/syllabus/me/week?start=YYYY-MM-DD ─────────────────────────────
exports.getWeek = async (req, res) => {
  try {
    const userId = req.user.id;
    const today  = todayPkt();
    const start  = String(req.query.start || today);
    const end    = addDaysPkt(start, 6);
    const oid    = new mongoose.Types.ObjectId(userId);

    const [scheduleRaw, todosRaw, reviewed] = await Promise.all([
      UserTopicProgress.find({
        user: oid,
        status: { $ne: 'mastered' },
        nextReviewDay: { $gte: start, $lte: end },
      }).sort({ nextReviewDay: 1 }).lean(),
      UserDailyTodo.find({ user: oid, dayPkt: { $gte: start, $lte: end } })
        .sort({ dayPkt: 1, done: 1, sortOrder: 1 }).lean(),
      TopicRevisionLog.aggregate([
        { $match: { user: oid, dayPkt: { $gte: start, $lte: end } } },
        { $group: { _id: '$dayPkt', n: { $sum: 1 } } },
      ]),
    ]);

    // Hydrate topic info from the cache.
    const hydrate = async (rows) => Promise.all(rows.map(async (r) => {
      const t = await treeCache.getTopicById(r.topic);
      return t ? { ...r,
        subject: t.subject, unitNumber: t.unitNumber, unitTitle: t.unitTitle,
        outcomeCode: t.outcomeCode, outcomeText: t.outcomeText,
      } : r;
    }));
    const [schedule, todos] = await Promise.all([hydrate(scheduleRaw), hydrate(todosRaw)]);

    const reviewedMap = {};
    for (const r of reviewed) reviewedMap[r._id] = r.n;

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = addDaysPkt(start, i);
      days.push({
        day: d,
        offset: i,
        isToday: d === today,
        isPast:  d <  today,
        scheduled: schedule.filter((s) => s.nextReviewDay === d),
        todos:     todos.filter((t) => t.dayPkt === d),
        reviewedCount: reviewedMap[d] || 0,
      });
    }

    res.json({
      success: true, start, end, today, days,
      totals: {
        scheduled: schedule.length,
        todos:     todos.length,
        reviewed:  Object.values(reviewedMap).reduce((a, b) => a + b, 0),
      },
    });
  } catch (err) {
    console.error('getWeek error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Small helper used by streamController on SSE connect — returns the unread-
// equivalent "due today" count without rebuilding the entire Today snapshot.
// One indexed countDocuments. Cheap enough that we accept the extra read on
// the connect path.
exports.getDueCountAndStreak = async (userId) => {
  try {
    const oid = new mongoose.Types.ObjectId(userId);
    const day = todayPkt();
    const sixtyDaysAgo = addDaysPkt(day, -60);

    const [dueCount, streakDays] = await Promise.all([
      UserTopicProgress.countDocuments({
        user: oid, status: { $ne: 'mastered' },
        nextReviewDay: { $gt: '', $lte: day },
      }),
      TopicRevisionLog.aggregate([
        { $match: { user: oid, dayPkt: { $gte: sixtyDaysAgo } } },
        { $group: { _id: '$dayPkt' } },
      ]),
    ]);
    const set = new Set(streakDays.map((d) => d._id));
    let streak = 0;
    let cursor = day;
    while (set.has(cursor)) { streak++; cursor = addDaysPkt(cursor, -1); }
    return { dueCount, streak };
  } catch {
    return { dueCount: 0, streak: 0 };
  }
};
