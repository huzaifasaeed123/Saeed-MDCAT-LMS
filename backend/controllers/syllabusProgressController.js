const UserTopicProgress = require('../models/UserTopicProgress');
const TopicRevisionLog  = require('../models/TopicRevisionLog');
const { todayPkt, addDaysPkt } = require('../utils/dayPkt');
const { applyOutcome, INTERVAL_BY_STAGE, VALID_OUTCOMES } = require('../utils/leitnerScheduler');
const treeCache  = require('../utils/syllabusTreeCache');
const todayCache = require('../utils/syllabusTodayCache');

// We deliberately do NOT push an SSE event back to the same user after every
// write. The originating tab already merged the response into its local
// state — a self-echo would trigger an extra refetch round on the SAME tab
// (the bug that made every click cost 5–6 APIs). If multi-tab live sync
// becomes a hard requirement later, we can re-introduce a debounced push
// with origin de-duplication. For now, the user's manual Refresh button
// covers cross-device divergence and the dashboard SSE badge only refreshes
// on (re)connect.
const notifyChange = (_userId) => { /* intentionally noop */ };

// ─── GET /api/syllabus/me/progress ───────────────────────────────────────────
// One indexed find + an in-memory rollup. Used by the syllabus-browse page.
exports.getMyProgress = async (req, res) => {
  try {
    const rows = await UserTopicProgress.find({ user: req.user.id })
      .select('topic status leitnerStage intervalDays nextReviewDay failCount successCount '
            + 'lectureDone lectureDoneAt bookDone bookDoneAt mcqCount mcqTarget mcqLastAt '
            + 'firstStudiedAt lastReviewedAt')
      .lean();

    const totals   = { new: 0, learning: 0, reviewing: 0, mastered: 0, total: rows.length };
    const trackers = { lecturesDone: 0, booksDone: 0, mcqsDone: 0, topicsWithMcqs: 0 };
    for (const r of rows) {
      if (totals[r.status] !== undefined) totals[r.status]++;
      if (r.lectureDone) trackers.lecturesDone++;
      if (r.bookDone)    trackers.booksDone++;
      if (r.mcqCount > 0) { trackers.mcqsDone += r.mcqCount; trackers.topicsWithMcqs++; }
    }

    res.json({ success: true, totals, trackers, progress: rows });
  } catch (err) {
    console.error('getMyProgress error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── Internal helper: validate topic via tree cache (no DB hit) ─────────────
const requireTopic = async (topicId) => {
  const t = await treeCache.getTopicById(topicId);
  return t || null;
};

// ─── POST /api/syllabus/me/progress/:topicId/start ──────────────────────────
// Idempotent — surfaces current state if already started.
exports.startTopic = async (req, res) => {
  try {
    const topic = await requireTopic(req.params.topicId);
    if (!topic) return res.status(404).json({ success: false, message: 'Topic not found' });

    const userId   = req.user.id;
    const today    = todayPkt();
    const tomorrow = addDaysPkt(today, 1);

    // findOneAndUpdate with $setOnInsert lets us "start if missing, otherwise
    // return existing state" in a single round-trip — no separate findOne.
    const result = await UserTopicProgress.findOneAndUpdate(
      { user: userId, topic: topic._id },
      {
        $setOnInsert: {
          status:          'learning',
          leitnerStage:    0,
          intervalDays:    1,
          nextReviewDay:   tomorrow,
          firstStudiedAt:  new Date(),
          lastReviewedAt:  new Date(),
        },
      },
      { upsert: true, new: true, lean: true, includeResultMetadata: true }
    );

    const doc          = result.value || result; // depending on driver version
    const alreadyHad   = result?.lastErrorObject?.updatedExisting || false;

    todayCache.invalidateUser(userId);
    notifyChange(userId);

    res.json({
      success:         true,
      alreadyStarted:  alreadyHad,
      status:          doc.status,
      leitnerStage:    doc.leitnerStage,
      intervalDays:    doc.intervalDays,
      nextReviewDay:   doc.nextReviewDay,
    });
  } catch (err) {
    console.error('startTopic error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── POST /api/syllabus/me/progress/:topicId/review ─────────────────────────
// Body: { outcome: 'again'|'good'|'easy' }. The hot mutation path of the
// module — kept to ONE write on the SRS doc + ONE append on the log.
exports.reviewTopic = async (req, res) => {
  try {
    const outcome = String(req.body?.outcome || '').toLowerCase();
    if (!VALID_OUTCOMES.has(outcome)) {
      return res.status(400).json({ success: false, message: 'outcome must be again|good|easy' });
    }

    const topic = await requireTopic(req.params.topicId);
    if (!topic) return res.status(404).json({ success: false, message: 'Topic not found' });

    const userId = req.user.id;
    const today  = todayPkt();

    // Auto-start if missing (the "review-first" flow used by /today buttons).
    let row = await UserTopicProgress.findOne(
      { user: userId, topic: topic._id },
      { status: 1, leitnerStage: 1, intervalDays: 1 }
    ).lean();

    if (!row) {
      row = { status: 'new', leitnerStage: 0, intervalDays: 0 };
    }

    const d = applyOutcome(row, outcome);
    const nextDay = d.newInt > 0 ? addDaysPkt(today, d.newInt) : '';

    await UserTopicProgress.updateOne(
      { user: userId, topic: topic._id },
      {
        $set: {
          status:         d.status,
          leitnerStage:   d.stageAfter,
          intervalDays:   d.newInt,
          nextReviewDay:  nextDay,
          lastReviewedAt: new Date(),
        },
        $inc: {
          failCount:    d.failDelta,
          successCount: d.successDelta,
        },
        $setOnInsert: { firstStudiedAt: new Date() },
      },
      { upsert: true }
    );

    // Append-only log — fire-and-forget so the response is fast.
    TopicRevisionLog.create({
      user:         userId,
      topic:        topic._id,
      outcome,
      stageBefore:  d.stageBefore,
      stageAfter:   d.stageAfter,
      prevInterval: d.prevInt,
      newInterval:  d.newInt,
      dayPkt:       today,
    }).catch((e) => console.error('TopicRevisionLog insert:', e));

    todayCache.invalidateUser(userId);
    notifyChange(userId);

    res.json({
      success:        true,
      outcome,
      status:         d.status,
      leitnerStage:   d.stageAfter,
      intervalDays:   d.newInt,
      nextReviewDay:  nextDay,
    });
  } catch (err) {
    console.error('reviewTopic error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── POST /api/syllabus/me/progress/:topicId/master ─────────────────────────
exports.masterTopic = async (req, res) => {
  try {
    const topic = await requireTopic(req.params.topicId);
    if (!topic) return res.status(404).json({ success: false, message: 'Topic not found' });

    const userId = req.user.id;
    const today  = todayPkt();

    const prev = await UserTopicProgress.findOne(
      { user: userId, topic: topic._id },
      { leitnerStage: 1, intervalDays: 1 }
    ).lean();

    await UserTopicProgress.updateOne(
      { user: userId, topic: topic._id },
      {
        $set: {
          status:         'mastered',
          leitnerStage:   6,
          intervalDays:   0,
          nextReviewDay:  '',
          lastReviewedAt: new Date(),
        },
        $inc: { successCount: 1 },
        $setOnInsert: { firstStudiedAt: new Date() },
      },
      { upsert: true }
    );

    TopicRevisionLog.create({
      user:         userId,
      topic:        topic._id,
      outcome:      'master',
      stageBefore:  prev?.leitnerStage ?? 0,
      stageAfter:   6,
      prevInterval: prev?.intervalDays ?? 0,
      newInterval:  0,
      dayPkt:       today,
    }).catch((e) => console.error('TopicRevisionLog insert:', e));

    todayCache.invalidateUser(userId);
    notifyChange(userId);

    res.json({ success: true, status: 'mastered', leitnerStage: 6, nextReviewDay: '' });
  } catch (err) {
    console.error('masterTopic error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── Helpers for the 3 trackers — promote new→learning on first touch ───────
const TRACKER_SET = {
  lecture: (done) => ({ lectureDone: !!done, lectureDoneAt: done ? new Date() : null }),
  book:    (done) => ({ bookDone:    !!done, bookDoneAt:    done ? new Date() : null }),
};

const touchProgress = async (userId, topicId, set, alsoIncMcq = 0, mcqTarget = null) => {
  const inc = alsoIncMcq ? { mcqCount: alsoIncMcq } : null;
  const update = {
    $set: { ...set, ...(alsoIncMcq ? { mcqLastAt: new Date() } : {}) },
    $setOnInsert: { firstStudiedAt: new Date() },
  };
  if (inc) update.$inc = inc;
  if (mcqTarget != null) update.$set.mcqTarget = mcqTarget;

  // Single round-trip upsert. We don't bother fetching the row first because
  // we don't need its previous value.
  await UserTopicProgress.updateOne({ user: userId, topic: topicId }, update, { upsert: true });

  // Promote 'new' → 'learning' on first touch so the topic appears in
  // "started" rollups. Done in a separate cheap conditional update.
  await UserTopicProgress.updateOne(
    { user: userId, topic: topicId, status: 'new' },
    { $set: { status: 'learning' } }
  );
};

// ─── POST /api/syllabus/me/topic/:id/lecture  body { done } ─────────────────
exports.setLecture = async (req, res) => {
  try {
    const topic = await requireTopic(req.params.id);
    if (!topic) return res.status(404).json({ success: false, message: 'Topic not found' });
    const done = req.body?.done !== false; // default true (mark done)
    await touchProgress(req.user.id, topic._id, TRACKER_SET.lecture(done));
    todayCache.invalidateUser(req.user.id);
    notifyChange(req.user.id);
    res.json({ success: true, lectureDone: done });
  } catch (err) {
    console.error('setLecture error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── POST /api/syllabus/me/topic/:id/book  body { done } ────────────────────
exports.setBook = async (req, res) => {
  try {
    const topic = await requireTopic(req.params.id);
    if (!topic) return res.status(404).json({ success: false, message: 'Topic not found' });
    const done = req.body?.done !== false;
    await touchProgress(req.user.id, topic._id, TRACKER_SET.book(done));
    todayCache.invalidateUser(req.user.id);
    notifyChange(req.user.id);
    res.json({ success: true, bookDone: done });
  } catch (err) {
    console.error('setBook error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── POST /api/syllabus/me/topic/:id/mcqs  body { count? | delta? | target? } ─
// All three are optional — caller sends just the one they want to change.
exports.setMcqs = async (req, res) => {
  try {
    const topic = await requireTopic(req.params.id);
    if (!topic) return res.status(404).json({ success: false, message: 'Topic not found' });

    const { count, delta, target } = req.body || {};
    const userId = req.user.id;

    // For 'count' (absolute) or 'target' we need to set; for 'delta' we $inc.
    const update = {
      $set: { mcqLastAt: new Date() },
      $setOnInsert: { firstStudiedAt: new Date() },
    };
    if (typeof count  === 'number' && Number.isFinite(count))   update.$set.mcqCount  = Math.max(0, Math.floor(count));
    if (typeof target === 'number' && Number.isFinite(target) && target > 0) update.$set.mcqTarget = Math.floor(target);
    if (typeof delta  === 'number' && Number.isFinite(delta))   update.$inc = { mcqCount: Math.floor(delta) };

    await UserTopicProgress.updateOne({ user: userId, topic: topic._id }, update, { upsert: true });

    // Floor mcqCount at 0 — $inc with negative delta could go negative.
    await UserTopicProgress.updateOne(
      { user: userId, topic: topic._id, mcqCount: { $lt: 0 } },
      { $set: { mcqCount: 0 } }
    );

    // Promote 'new' -> 'learning' on first touch.
    await UserTopicProgress.updateOne(
      { user: userId, topic: topic._id, status: 'new' },
      { $set: { status: 'learning' } }
    );

    const row = await UserTopicProgress.findOne({ user: userId, topic: topic._id })
      .select('mcqCount mcqTarget').lean();

    todayCache.invalidateUser(userId);
    notifyChange(userId);
    res.json({ success: true, mcqCount: row?.mcqCount ?? 0, mcqTarget: row?.mcqTarget ?? 50 });
  } catch (err) {
    console.error('setMcqs error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
