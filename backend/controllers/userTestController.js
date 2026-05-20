const mongoose = require('mongoose');
const UserTestAttempt = require('../models/UserTestAttempt');
const UserMcqHistory  = require('../models/UserMcqHistory');
const SavedQuestion = require('../models/SavedQuestion');
const Test = require('../models/TestModel');
const MCQ = require('../models/McqModel');
const MCQReport = require('../models/MCQReport');


/**
 * Build bulkWrite ops for one attempt — used by both updateUserMcqHistory and backfill.
 * Uses $set + $inc + $setOnInsert (no pipeline syntax) for broad MongoDB compatibility.
 * markedForReview/saved are sticky: once true they are never reverted to false.
 */
const _buildHistoryOps = (userId, questionAttempts, mcqMap, now) => {
  const ops = [];
  for (const qa of questionAttempts) {
    const mcq = mcqMap[qa.mcqId?.toString()];
    if (!mcq?.questionBankId) continue;

    const lastResult = !qa.selectedOption ? 'omitted' : qa.isCorrect ? 'correct' : 'incorrect';
    const isMarked   = !!qa.markedForReview;
    const isSaved    = !!qa.saved;

    const setFields = {
      questionBankId:  mcq.questionBankId,
      qbSubjectId:     mcq.qbSubjectId  || null,
      qbChapterId:     mcq.qbChapterId  || null,
      qbTopicId:       mcq.qbTopicId    || null,
      lastResult,
      lastAttemptedAt: now,
    };
    // Only write sticky flags when true — $setOnInsert initialises them to false on new docs
    if (isMarked) setFields.markedForReview = true;
    if (isSaved)  setFields.saved           = true;

    const setOnInsert = {};
    if (!isMarked) setOnInsert.markedForReview = false;
    if (!isSaved)  setOnInsert.saved           = false;

    const update = {
      $set: setFields,
      $inc: {
        totalAttempts:  1,
        correctCount:   lastResult === 'correct'   ? 1 : 0,
        incorrectCount: lastResult === 'incorrect' ? 1 : 0,
        omittedCount:   lastResult === 'omitted'   ? 1 : 0,
      },
    };
    if (Object.keys(setOnInsert).length > 0) update.$setOnInsert = setOnInsert;

    ops.push({
      updateOne: {
        filter: { user: userId, mcq: qa.mcqId },
        update,
        upsert: true,
      },
    });
  }
  return ops;
};

/** Fire-and-forget after completeTest — tracks result for each MCQ in this attempt. */
const updateUserMcqHistory = async (attempt) => {
  try {
    const mcqIds = attempt.questionAttempts.map((qa) => qa.mcqId).filter(Boolean);
    if (mcqIds.length === 0) {
      console.warn('[MCQHistory] No mcqIds found in attempt');
      return;
    }

    // Fetch MCQ classification; only fetch test QB if some MCQs need the fallback
    const mcqs = await MCQ.find({ _id: { $in: mcqIds } })
      .select('_id questionBankId qbSubjectId qbChapterId qbTopicId')
      .lean();

    const needsFallback = mcqs.some((m) => !m.questionBankId);
    const fallbackQbId  = needsFallback
      ? (await Test.findById(attempt.test).select('questionBankId').lean())?.questionBankId || null
      : null;

    // Patch each MCQ entry — if MCQ lacks questionBankId, use the test's QB
    const mcqMap = {};
    for (const m of mcqs) {
      mcqMap[m._id.toString()] = {
        ...m,
        questionBankId: m.questionBankId || fallbackQbId,
      };
    }

    const ops = _buildHistoryOps(attempt.user, attempt.questionAttempts, mcqMap, new Date());
    if (ops.length > 0) {
      await UserMcqHistory.bulkWrite(ops, { ordered: false });
      console.log(`[MCQHistory] Updated ${ops.length} records for user ${attempt.user}`);
    } else {
      console.warn(`[MCQHistory] No ops — no questionBankId available (attemptId: ${attempt._id})`);
    }
  } catch (err) {
    console.error('[MCQHistory] updateUserMcqHistory error:', err);
  }
};

/**
 * Backfill UserMcqHistory from ALL past completed attempts for a user.
 * Uses pure $set (idempotent) — safe to run multiple times.
 * Processes oldest→newest so lastResult/lastAttemptedAt reflect the most recent attempt.
 * Falls back to the test's questionBankId when the MCQ document lacks one (legacy data).
 */
const backfillUserMcqHistory = async (userId) => {
  try {
    const attempts = await UserTestAttempt.find({ user: userId, status: 'completed' })
      .sort({ createdAt: 1 })
      .select('createdAt test questionAttempts.mcqId questionAttempts.selectedOption questionAttempts.isCorrect questionAttempts.markedForReview questionAttempts.saved')
      .lean();

    if (attempts.length === 0) return;

    // Build a map of test → questionBankId so MCQs without their own QB can fall back to it
    const testIds = [...new Set(attempts.map((a) => a.test?.toString()).filter(Boolean))];
    const testDocs = await Test.find({ _id: { $in: testIds } }).select('_id questionBankId').lean();
    const testQbMap = {};
    for (const t of testDocs) {
      if (t.questionBankId) testQbMap[t._id.toString()] = t.questionBankId;
    }

    // Aggregate final per-MCQ stats across all past attempts
    const statsMap = {}; // mcqId.toString() → accumulated stats + fallback QB
    for (const attempt of attempts) {
      const ts         = attempt.createdAt ? new Date(attempt.createdAt) : new Date();
      const testQbId   = testQbMap[attempt.test?.toString()] || null;
      for (const qa of attempt.questionAttempts) {
        if (!qa.mcqId) continue;
        const key = qa.mcqId.toString();
        if (!statsMap[key]) {
          statsMap[key] = {
            mcqId: qa.mcqId,
            testQbId,   // fallback — used if MCQ.questionBankId is null
            totalAttempts: 0, correctCount: 0, incorrectCount: 0, omittedCount: 0,
            lastResult: 'omitted', lastAttemptedAt: ts,
            markedForReview: false, saved: false,
          };
        }
        const s   = statsMap[key];
        const res = !qa.selectedOption ? 'omitted' : qa.isCorrect ? 'correct' : 'incorrect';
        s.totalAttempts++;
        if (res === 'correct')   s.correctCount++;
        if (res === 'incorrect') s.incorrectCount++;
        if (res === 'omitted')   s.omittedCount++;
        s.lastResult        = res;
        s.lastAttemptedAt   = ts;
        if (qa.markedForReview) s.markedForReview = true;
        if (qa.saved)           s.saved           = true;
      }
    }

    // Fetch QB classification from MCQ documents
    const allIds = Object.values(statsMap).map((s) => s.mcqId);
    const mcqs   = await MCQ.find({ _id: { $in: allIds } })
      .select('_id questionBankId qbSubjectId qbChapterId qbTopicId')
      .lean();
    const mcqMap = {};
    for (const m of mcqs) mcqMap[m._id.toString()] = m;

    let written = 0, skipped = 0;
    const bulkOps = [];
    for (const [key, s] of Object.entries(statsMap)) {
      const mcq  = mcqMap[key];
      const qbId = mcq?.questionBankId || s.testQbId || null;
      if (!qbId) { skipped++; continue; }

      written++;
      bulkOps.push({
        updateOne: {
          filter: { user: userId, mcq: s.mcqId },
          update: {
            $set: {
              user:            userId,
              mcq:             s.mcqId,
              questionBankId:  qbId,
              qbSubjectId:     mcq?.qbSubjectId  || null,
              qbChapterId:     mcq?.qbChapterId  || null,
              qbTopicId:       mcq?.qbTopicId    || null,
              lastResult:      s.lastResult,
              lastAttemptedAt: s.lastAttemptedAt,
              totalAttempts:   s.totalAttempts,
              correctCount:    s.correctCount,
              incorrectCount:  s.incorrectCount,
              omittedCount:    s.omittedCount,
              markedForReview: s.markedForReview,
              saved:           s.saved,
            },
          },
          upsert: true,
        },
      });

      if (bulkOps.length >= 500) {
        await UserMcqHistory.bulkWrite(bulkOps.splice(0), { ordered: false });
      }
    }
    if (bulkOps.length > 0) {
      await UserMcqHistory.bulkWrite(bulkOps, { ordered: false });
    }
    console.log(`[MCQHistory] Backfill complete for user ${userId}: written=${written}, skipped=${skipped}, total=${Object.keys(statsMap).length} MCQs from ${attempts.length} attempts`);
  } catch (err) {
    console.error('[MCQHistory] backfillUserMcqHistory error:', err);
  }
};

exports.backfillUserMcqHistory = backfillUserMcqHistory;

/**
 * Fire-and-forget after completeTest — increments per-option selection counts on each MCQ.
 * Stores: statistics.optionsSelections.A/B/C/D/E (pick counts) + .total (all attempts incl. omitted).
 */
const updateMcqOptionStats = async (attempt) => {
  try {
    const ops = [];
    for (const qa of attempt.questionAttempts) {
      if (!qa.mcqId) continue;
      const inc = { 'statistics.optionsSelections.total': 1 };
      if (qa.selectedOption) {
        inc[`statistics.optionsSelections.${qa.selectedOption}`] = 1;
      }
      ops.push({
        updateOne: {
          filter: { _id: qa.mcqId },
          update: { $inc: inc },
        },
      });
    }
    if (ops.length > 0) {
      await MCQ.bulkWrite(ops, { ordered: false });
    }
  } catch (err) {
    console.error('[MCQStats] updateMcqOptionStats error:', err);
  }
};

/**
 * Start a new test attempt
 * @route POST /api/user-tests/start
 * @access Private
 */
exports.startTest = async (req, res) => {
  try {
    const { testId, mode, totalDurationSec } = req.body;

    if (!testId || !mode) {
      return res.status(400).json({ success: false, message: 'Test ID and mode are required' });
    }
    if (mode !== 'tutor' && mode !== 'timer') {
      return res.status(400).json({ success: false, message: 'Mode must be either tutor or timer' });
    }

    // Single fetch — populate mcqs to avoid a second Test.findById call.
    // QB is populated WITH select('title') so we can snapshot the QB title
    // into the new attempt for the History endpoint — zero extra queries.
    const test = await Test.findById(testId)
      .populate('mcqs')
      .populate({ path: 'questionBankId', select: 'title' });
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }
    if (test.status !== 'published' && test.createdBy?.toString() !== req.user.id) {
      return res.status(400).json({ success: false, message: 'Test is not published' });
    }

    // Reject modes the test creator hasn't allowed. Defensive against old
    // documents written before allowedModes existed: an empty/missing array
    // falls back to "either mode permitted" so legacy tests don't break.
    const allowed = Array.isArray(test.allowedModes) && test.allowedModes.length > 0
      ? test.allowedModes
      : ['tutor', 'timer'];
    if (!allowed.includes(mode)) {
      return res.status(400).json({
        success: false,
        message: `This test only allows ${allowed.join(' or ')} mode.`,
      });
    }

    // Resolve the MCQ array UP FRONT — used by both the resume branch
    // (response reconstruction) and the new-attempt branch. test.mcqs is
    // already populated from the Test.findById above; the legacy fallback
    // covers tests written before the mcqs ref array existed.
    const mcqs = test.mcqs?.length > 0 ? test.mcqs : await MCQ.find({ testId });

    // Resume existing in-progress attempt
    const existingAttempt = await UserTestAttempt.findOne({
      user: req.user.id,
      test: testId,
      status: 'in-progress',
    });
    if (existingAttempt) {
      // Reconstruct the populated response shape from in-memory data — the
      // previous code did UserTestAttempt.findById + populate('test') +
      // populate('questionAttempts.mcqId'), which was 3 round trips. We
      // already have `test` and `mcqs` in scope.
      //
      // Edge case: the attempt's questionAttempts may reference MCQs no
      // longer in test.mcqs (test was edited after the attempt started).
      // Targeted MCQ.find for any missing ones is still cheaper than a
      // full populate over every attempt question.
      const attemptMcqIds = existingAttempt.questionAttempts
        .map((qa) => qa.mcqId?.toString())
        .filter(Boolean);
      const haveIds = new Set(mcqs.map((m) => m._id.toString()));
      const missingIds = attemptMcqIds.filter((id) => !haveIds.has(id));
      const extraMcqs = missingIds.length > 0
        ? await MCQ.find({ _id: { $in: missingIds } })
        : [];

      const resumeMcqMap = new Map();
      [...mcqs, ...extraMcqs].forEach((m) => {
        resumeMcqMap.set(m._id.toString(), m.toObject ? m.toObject() : m);
      });

      const testForResume = test.toObject();
      testForResume.mcqs = mcqs.map((m) => m._id); // match populate('test') shape

      const attemptObj = existingAttempt.toObject();
      attemptObj.test = testForResume;
      attemptObj.questionAttempts = attemptObj.questionAttempts.map((qa) => ({
        ...qa,
        mcqId: resumeMcqMap.get(qa.mcqId?.toString()) || qa.mcqId,
      }));

      return res.status(200).json({
        success: true,
        message: 'Found existing test attempt',
        data: attemptObj,
      });
    }

    // ── Attempt-limit enforcement ─────────────────────────────────────────
    // Skipped for staff so they can keep QA-testing their own tests. Also
    // skipped when maxAttempts is null/undefined (the default "unlimited"),
    // so we only run countDocuments when a limit is actually configured.
    // Reached only on the NEW-attempt path — resumes returned earlier above.
    if (req.user.role === 'student' && test.maxAttempts != null) {
      const usedAttempts = await UserTestAttempt.countDocuments({
        user:   req.user.id,
        test:   testId,
        status: 'completed',
      });
      if (usedAttempts >= test.maxAttempts) {
        return res.status(403).json({
          success: false,
          message: `You have used all ${test.maxAttempts} allowed attempts for this test.`,
          attemptLimitReached: true,
          usedAttempts,
          maxAttempts: test.maxAttempts,
        });
      }
    }

    if (mcqs.length === 0) {
      return res.status(400).json({ success: false, message: 'Test has no questions' });
    }

    // Embed correctOption in each questionAttempt so frontend can validate locally
    const questionAttempts = mcqs.map((mcq) => {
      const correct = mcq.options?.find((o) => o.isCorrect);
      return {
        mcqId:           mcq._id,
        correctOption:   correct?.optionLetter ?? null,
        selectedOption:  null,
        isCorrect:       false,
        reported:        false,
        saved:           false,
        markedForReview: false,
      };
    });

    // Snapshot test metadata into the attempt — the History endpoint reads
    // these directly instead of populating Test + QuestionBank on every load.
    // Captured ONCE at attempt-creation time; if admin later renames the test
    // or QB, this attempt keeps the original names (correct UX).
    const qb = test.questionBankId; // populated above
    const newAttempt = await UserTestAttempt.create({
      user:              req.user.id,
      test:              testId,
      mode,
      startTime:         new Date(),
      maxScore:          mcqs.length,
      questionAttempts,
      totalDurationSec:  totalDurationSec || null,
      // Snapshot fields ↓
      testTitle:         test.title || '',
      testSubjects:      Array.isArray(test.subjects) ? test.subjects.slice() : [],
      testChapters:      Array.isArray(test.chapters) ? test.chapters.slice() : [],
      testTopics:        Array.isArray(test.topics)   ? test.topics.slice()   : [],
      questionBankId:    qb?._id || qb || null,
      questionBankTitle: qb?.title || '',
      totalQuestions:    mcqs.length,
    });

    // Build the populated response shape locally from data we already have
    // in memory. The previous code re-fetched the attempt and ran two heavy
    // populates (`test` + `questionAttempts.mcqId`) — three round trips for
    // information we already loaded at the top of this handler. Reconstructing
    // matches the populate shape exactly (test as a plain object with mcqs as
    // an id array, questionAttempts.mcqId replaced with the full MCQ object)
    // so TestPlayerPage sees no difference.
    const mcqMap = new Map();
    mcqs.forEach((m) => {
      mcqMap.set(m._id.toString(), m.toObject ? m.toObject() : m);
    });

    const testForResponse = test.toObject();
    // populate('test') by default returns test.mcqs as an id array — keep that
    // shape so any consumer that walks test.mcqs gets ObjectIds, not nested docs.
    testForResponse.mcqs = mcqs.map((m) => m._id);

    const attemptResponse = newAttempt.toObject();
    attemptResponse.test = testForResponse;
    attemptResponse.questionAttempts = attemptResponse.questionAttempts.map((qa) => ({
      ...qa,
      mcqId: mcqMap.get(qa.mcqId.toString()) || qa.mcqId,
    }));

    res.status(201).json({
      success: true,
      message: 'Test attempt started successfully',
      data: attemptResponse,
    });
  } catch (error) {
    console.error('Error starting test:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Get the active (in-progress) attempt for a specific test — lightweight, no MCQ population.
 * Used by TestStartPage to check for an unfinished attempt without fetching full history.
 * @route GET /api/user-tests/active?testId=xxx
 * @access Private
 */
exports.getActiveAttempt = async (req, res) => {
  try {
    const { testId } = req.query;
    if (!testId) return res.status(400).json({ success: false, message: 'testId query param required' });

    // Two parallel reads only:
    //   1. The in-progress attempt (existing query, unchanged).
    //   2. completedAttempts — students only. Skipped entirely for staff so
    //      we add ZERO reads on the staff path. Indexed by {user,test,status}.
    // We do NOT fetch the Test here for maxAttempts — the frontend already
    // calls /tests/:id?summary=1 in the same Promise.all on the start page,
    // so it already has maxAttempts. Returning only the count keeps this
    // endpoint at one extra indexed read (or zero for staff).
    const [attempt, completedAttempts] = await Promise.all([
      UserTestAttempt.findOne({
        user:   req.user.id,
        test:   testId,
        status: 'in-progress',
      }).select('_id mode status questionAttempts startTime').lean(),
      req.user.role === 'student'
        ? UserTestAttempt.countDocuments({ user: req.user.id, test: testId, status: 'completed' })
        : Promise.resolve(0),
    ]);

    if (!attempt) {
      return res.json({
        success: true,
        data: null,
        attemptInfo: { completedAttempts },
      });
    }

    const answeredCount = attempt.questionAttempts.filter((qa) => qa.selectedOption).length;
    const totalCount    = attempt.questionAttempts.length;

    res.json({
      success: true,
      data: {
        _id:          attempt._id,
        mode:         attempt.mode,
        status:       attempt.status,
        startTime:    attempt.startTime,
        answeredCount,
        totalCount,
      },
      attemptInfo: { completedAttempts },
    });
  } catch (error) {
    console.error('getActiveAttempt error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Get cohort analytics for a single attempt — drives the Test Result page's
 * Leaderboard tab + the "Top X% · N students" + "class median Y%" + score
 * histogram on the Overview tab.
 *
 * Returns:
 *   - leaderboard: { top: [...], totalTakers, avgScore }
 *   - myRank, myPercentile  (null if user not in the result set somehow)
 *   - classMedian
 *   - scoreHistogram: 10 buckets (0-10, 10-20, ..., 90-100)
 *
 * Cost: ONE $facet aggregation, indexed by { test: 1, status: 1 } (already
 * exists). Top-10 + my-rank + median + histogram all in a single round trip.
 *
 * Not cached yet. When a test has >500 takers and this becomes a hot path,
 * mirror leaderboardCache.js — invalidate when a new completeTest lands for
 * that test.
 *
 * @route GET /api/user-tests/:attemptId/analytics
 * @access Private
 */
exports.getAttemptAnalytics = async (req, res) => {
  try {
    const { attemptId } = req.params;

    // One lookup to scope the analytics. Cheap — no populates.
    const attempt = await UserTestAttempt.findById(attemptId).select('user test scorePercentage').lean();
    if (!attempt) return res.status(404).json({ success: false, message: 'Test attempt not found' });
    if (attempt.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Pass-rate needs the test's passingScore. Tiny extra trip — projected
    // to a single field. Avoids hard-coding 50% as the pass threshold.
    const test = await Test.findById(attempt.test).select('passingScore').lean();
    const passingScore = test?.passingScore ?? 50;

    const testOid = attempt.test;
    const myUserOid = new mongoose.Types.ObjectId(req.user.id);

    // ── Leaderboard rule: only each user's FIRST attempt counts for ranking.
    // We dedup at the top of the pipeline so every $facet branch (top,
    // allScores, stats, histogram) sees one document per user — their
    // chronologically first completed attempt. Stats become "first-attempt
    // cohort" which is consistent and prevents prolific re-takers from
    // skewing averages.
    //
    // Mechanics: sort by user then createdAt ASC, $group by user with
    // $first to keep the oldest doc, then $replaceRoot to flatten back to
    // attempt documents.
    const [agg] = await UserTestAttempt.aggregate([
      { $match: { test: testOid, status: 'completed' } },
      { $sort:  { user: 1, createdAt: 1 } },
      { $group: { _id: '$user', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
      { $facet: {
        // Top 10 scorers with name, school, score breakdown. Ties broken by speed.
        top: [
          { $sort: { scorePercentage: -1, totalTimeSpent: 1 } },
          { $limit: 10 },
          { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'u' } },
          { $unwind: { path: '$u', preserveNullAndEmptyArrays: true } },
          { $project: {
            _id: 0,
            userId:          '$user',
            fullName:        { $ifNull: ['$u.fullName', 'Unknown'] },
            profilePicture:  '$u.profilePicture',
            // School / college shown under the name in the leaderboard table.
            // Best-effort: fall back through possible field names.
            school:          { $ifNull: ['$u.fscCollegeName', ''] },
            score:           1,
            maxScore:        1,
            scorePercentage: { $round: ['$scorePercentage', 1] },
            totalTimeSpent:  1,
            isMe:            { $eq: ['$user', myUserOid] },
          }},
        ],
        // Every score sorted desc. Used in JS for rank + median (score) +
        // median (time) + finding the current user's first-attempt details.
        // Includes the attempt _id so the frontend can detect when the
        // currently-viewed attempt is NOT the leaderboard-counted first one.
        allScores: [
          { $sort: { scorePercentage: -1, totalTimeSpent: 1 } },
          { $project: { _id: 1, user: 1, scorePercentage: 1, score: 1, maxScore: 1, totalTimeSpent: 1 } },
        ],
        // 10-bucket histogram (kept for any future visualisation; UI not
        // rendering it right now but the data is essentially free here).
        histogram: [
          { $bucket: {
            groupBy: '$scorePercentage',
            boundaries: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 100.0001],
            default: 'other',
            output: { count: { $sum: 1 } },
          }},
        ],
        // Cohort stats. passed = attempts that met the test's passingScore.
        stats: [
          { $group: {
            _id: null,
            total:   { $sum: 1 },
            avg:     { $avg: '$scorePercentage' },
            avgTime: { $avg: '$totalTimeSpent' },
            passed:  { $sum: { $cond: [{ $gte: ['$scorePercentage', passingScore] }, 1, 0] } },
          }},
        ],
      }},
    ]);

    const allScores   = agg.allScores || [];
    const totalTakers = allScores.length;
    const stats       = agg.stats?.[0] || { total: 0, avg: 0, avgTime: 0, passed: 0 };

    // ── Median score (cheap — allScores is sorted desc) ──────────────────
    let classMedian = null;
    if (totalTakers > 0) {
      const mid = Math.floor(totalTakers / 2);
      classMedian = totalTakers % 2 === 0
        ? (allScores[mid - 1].scorePercentage + allScores[mid].scorePercentage) / 2
        : allScores[mid].scorePercentage;
    }

    // ── Median time (resort by time — cheaper than a second aggregation) ─
    let medianTime = null;
    if (totalTakers > 0) {
      const byTime = allScores
        .map((s) => s.totalTimeSpent || 0)
        .sort((a, b) => a - b);
      const mid = Math.floor(byTime.length / 2);
      medianTime = byTime.length % 2 === 0
        ? Math.round((byTime[mid - 1] + byTime[mid]) / 2)
        : byTime[mid];
    }

    // ── My rank + percentile ─────────────────────────────────────────────
    // After dedup, the user appears at most once in allScores — namely
    // their first attempt. myRank reflects first-attempt position.
    const myEntry = allScores.find((s) => s.user.toString() === req.user.id);
    const myIndex = myEntry ? allScores.indexOf(myEntry) : -1;
    const myRank       = myIndex >= 0 ? myIndex + 1 : null;
    const myPercentile = (myRank != null && totalTakers > 1)
      ? Math.round(((totalTakers - myRank) / (totalTakers - 1)) * 100)
      : (myRank === 1 ? 100 : null);

    // myFirstAttempt = the actual attempt that "counts" on the leaderboard.
    // The frontend uses this for the sidebar (Score / Accuracy / Time /
    // Percentile / vs-comparisons) so those fields are consistent with the
    // rank above — even when the user is viewing a different attempt.
    const myFirstAttempt = myEntry
      ? {
          _id:             myEntry._id,
          score:           myEntry.score,
          maxScore:        myEntry.maxScore,
          scorePercentage: Math.round((myEntry.scorePercentage || 0) * 10) / 10,
          totalTimeSpent:  myEntry.totalTimeSpent || 0,
        }
      : null;
    // True when the attempt being viewed IS the user's first attempt (so
    // the frontend can skip the "based on first attempt" disclaimer).
    const isFirstAttempt = myFirstAttempt
      ? myFirstAttempt._id.toString() === attemptId
      : false;

    // ── Histogram bucket array ───────────────────────────────────────────
    const bucketLabels = ['0-10', '10-20', '20-30', '30-40', '40-50', '50-60', '60-70', '70-80', '80-90', '90-100'];
    const histMap = {};
    (agg.histogram || []).forEach((b) => {
      const lo = typeof b._id === 'number' ? Math.floor(b._id / 10) * 10 : null;
      if (lo !== null && lo <= 90) histMap[`${lo}-${lo + 10}`] = b.count;
      else if (b._id === 100) histMap['90-100'] = (histMap['90-100'] || 0) + b.count;
    });
    const scoreHistogram = bucketLabels.map((label) => ({
      bucket: label,
      count:  histMap[label] || 0,
    }));

    res.status(200).json({
      success: true,
      data: {
        leaderboard: {
          top:         agg.top || [],
          totalTakers,
          avgScore:    Math.round(stats.avg || 0),
          avgTime:     Math.round(stats.avgTime || 0),
          passRate:    totalTakers > 0 ? Math.round((stats.passed / totalTakers) * 100) : null,
        },
        myRank,
        myPercentile,
        myFirstAttempt,    // the leaderboard-counted attempt (null if no completed attempts somehow)
        isFirstAttempt,    // is the currently-viewed attempt the leaderboard one?
        classMedian: classMedian != null ? Math.round(classMedian) : null,
        medianTime,
        scoreHistogram,
      },
    });
  } catch (err) {
    console.error('getAttemptAnalytics error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Get test attempt details
 * @route GET /api/user-tests/:attemptId
 * @access Private
 */
exports.getTestAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;

    const attempt = await UserTestAttempt.findById(attemptId)
      .populate('test')
      .populate({ path: 'questionAttempts.mcqId', model: 'MCQ' });

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Test attempt not found' });
    }
    if (attempt.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this test attempt' });
    }

    res.status(200).json({ success: true, data: attempt });
  } catch (error) {
    console.error('Error getting test attempt:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Submit answer for a single question (kept for backward compatibility)
 * The new flow sends all answers in a single completeTest call instead.
 * @route PUT /api/user-tests/:attemptId/question/:questionIndex
 * @access Private
 */
exports.submitAnswer = async (req, res) => {
  try {
    const { attemptId, questionIndex } = req.params;
    const { selectedOption } = req.body;

    const attempt = await UserTestAttempt.findById(attemptId);
    if (!attempt) return res.status(404).json({ success: false, message: 'Test attempt not found' });
    if (attempt.user.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });
    if (attempt.status !== 'in-progress') return res.status(400).json({ success: false, message: 'Test attempt is not in progress' });

    const questionIdx = parseInt(questionIndex);
    if (questionIdx < 0 || questionIdx >= attempt.questionAttempts.length) {
      return res.status(400).json({ success: false, message: 'Invalid question index' });
    }
    if (selectedOption && !['A', 'B', 'C', 'D', 'E'].includes(selectedOption)) {
      return res.status(400).json({ success: false, message: 'Invalid option selected' });
    }

    const qa = attempt.questionAttempts[questionIdx];

    // Use stored correctOption; fall back to MCQ lookup for legacy attempts
    let correctOptionLetter = qa.correctOption;
    let explanation = '';
    if (!correctOptionLetter) {
      const mcq = await MCQ.findById(qa.mcqId);
      if (!mcq) return res.status(404).json({ success: false, message: 'Question not found' });
      correctOptionLetter = mcq.options.find((opt) => opt.isCorrect)?.optionLetter;
      explanation = mcq.explanationText || '';
    }

    const isCorrect = selectedOption === correctOptionLetter;
    qa.selectedOption = selectedOption;
    qa.isCorrect = isCorrect;
    attempt.currentQuestionIndex = questionIdx;

    // Compute score inline (no pre-save hook)
    const correct = attempt.questionAttempts.filter((q) => q.isCorrect).length;
    attempt.score = correct;
    attempt.maxScore = attempt.questionAttempts.length;
    attempt.scorePercentage = attempt.maxScore > 0 ? (correct / attempt.maxScore) * 100 : 0;

    await attempt.save();

    res.status(200).json({
      success: true,
      message: 'Answer submitted successfully',
      data: { isCorrect, correctOption: correctOptionLetter, explanation, attempt },
    });
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Report a question in a test
 * @route PUT /api/user-tests/:attemptId/report/:questionIndex
 * @access Private
 */
exports.reportQuestion = async (req, res) => {
  try {
    const { attemptId, questionIndex } = req.params;
    const { reportReason } = req.body;

    const attempt = await UserTestAttempt.findById(attemptId);
    if (!attempt) return res.status(404).json({ success: false, message: 'Test attempt not found' });
    if (attempt.user.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });

    const questionIdx = parseInt(questionIndex);
    if (questionIdx < 0 || questionIdx >= attempt.questionAttempts.length) {
      return res.status(400).json({ success: false, message: 'Invalid question index' });
    }

    attempt.questionAttempts[questionIdx].reported = true;
    attempt.questionAttempts[questionIdx].reportReason = reportReason || '';
    await attempt.save();

    try {
      const mcqId = attempt.questionAttempts[questionIdx].mcqId;
      const existing = await MCQReport.findOne({
        mcq: mcqId,
        reportedBy: req.user.id,
        status: { $in: ['open', 'active'] },
      });
      if (!existing && mcqId) {
        const mcq = await MCQ.findById(mcqId);
        await MCQReport.create({
          mcq: mcqId,
          test: attempt.test,
          attempt: attempt._id,
          reportedBy: req.user.id,
          reason: reportReason || 'Question Statement Wrong',
          mcqSubject: mcq?.subject || '',
          mcqChapter: mcq?.unit || '',
          mcqTopic: mcq?.topic || '',
        });
      }
    } catch (_) { /* MCQReport creation is non-blocking */ }

    res.status(200).json({ success: true, message: 'Question reported successfully', data: attempt });
  } catch (error) {
    console.error('Error reporting question:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Save a question for later review
 * @route PUT /api/user-tests/:attemptId/save/:questionIndex
 * @access Private
 */
exports.saveQuestion = async (req, res) => {
  try {
    const { attemptId, questionIndex } = req.params;
    const { notes, taggedCategories } = req.body || {};

    const attempt = await UserTestAttempt.findById(attemptId);
    if (!attempt) return res.status(404).json({ success: false, message: 'Test attempt not found' });
    if (attempt.user.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });

    const questionIdx = parseInt(questionIndex);
    if (questionIdx < 0 || questionIdx >= attempt.questionAttempts.length) {
      return res.status(400).json({ success: false, message: 'Invalid question index' });
    }

    const mcqId = attempt.questionAttempts[questionIdx].mcqId;
    attempt.questionAttempts[questionIdx].saved = true;
    await attempt.save();

    const savedQuestion = await SavedQuestion.findOneAndUpdate(
      { user: req.user.id, mcq: mcqId },
      { user: req.user.id, mcq: mcqId, notes: notes || '', taggedCategories: taggedCategories || [], testId: attempt.test },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, message: 'Question saved successfully', data: { attempt, savedQuestion } });
  } catch (error) {
    console.error('Error saving question:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Pause a test attempt — saves all answers/marks/position in a single batch write.
 * Status stays 'in-progress' so the student can resume later.
 * @route PUT /api/user-tests/:attemptId/pause
 * @access Private
 * Body: { answers?: [{questionIndex, selectedOption, markedForReview}], currentQuestionIndex?, timeSpent? }
 */
exports.pauseTest = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { answers, currentQuestionIndex, timeSpent } = req.body;

    const attempt = await UserTestAttempt.findById(attemptId);
    if (!attempt) return res.status(404).json({ success: false, message: 'Attempt not found' });
    if (attempt.user.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });
    if (attempt.status !== 'in-progress') return res.status(400).json({ success: false, message: 'Attempt not in progress' });

    // Apply batch answers (same logic as completeTest, but keep status in-progress)
    if (Array.isArray(answers) && answers.length > 0) {
      const missingIds = attempt.questionAttempts
        .filter((qa) => !qa.correctOption)
        .map((qa) => qa.mcqId);

      const fallbackMap = {};
      if (missingIds.length > 0) {
        const mcqs = await MCQ.find({ _id: { $in: missingIds } }).select('_id options').lean();
        for (const m of mcqs) {
          const co = m.options?.find((o) => o.isCorrect)?.optionLetter;
          if (co) fallbackMap[m._id.toString()] = co;
        }
      }

      for (const ans of answers) {
        const idx = ans.questionIndex;
        if (idx == null || idx < 0 || idx >= attempt.questionAttempts.length) continue;
        const qa = attempt.questionAttempts[idx];
        if (ans.selectedOption  !== undefined) qa.selectedOption  = ans.selectedOption;
        if (ans.markedForReview !== undefined) qa.markedForReview = ans.markedForReview;
        // Compute isCorrect so tutor-mode feedback is restored correctly on resume
        const correctOpt = qa.correctOption || fallbackMap[qa.mcqId.toString()];
        if (correctOpt) qa.isCorrect = qa.selectedOption != null && qa.selectedOption === correctOpt;
      }
    }

    if (currentQuestionIndex != null) attempt.currentQuestionIndex = currentQuestionIndex;

    // Save time spent so timer resumes from the paused point (not wall-clock)
    if (timeSpent != null && timeSpent > 0) attempt.totalTimeSpent = timeSpent;

    // Keep answeredCount accurate while the attempt is paused so Test History
    // shows "12/20" instead of "0/20". Pure in-memory count over the array
    // we already walked above — zero extra DB cost. completeTest already
    // does this; pause was missing it.
    attempt.answeredCount = attempt.questionAttempts.filter((qa) => qa.selectedOption != null).length;

    await attempt.save();

    res.json({ success: true, message: 'Test paused' });
  } catch (error) {
    console.error('pauseTest error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Complete a test attempt — accepts a full answers batch for zero mid-test API calls.
 * @route PUT /api/user-tests/:attemptId/complete
 * @access Private
 * Body: { totalTimeSpent?, answers?: [{questionIndex, selectedOption, markedForReview}] }
 */
exports.completeTest = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { totalTimeSpent, answers } = req.body;

    const attempt = await UserTestAttempt.findById(attemptId);
    if (!attempt) return res.status(404).json({ success: false, message: 'Test attempt not found' });
    if (attempt.user.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });
    if (attempt.status !== 'in-progress') return res.status(400).json({ success: false, message: 'Test attempt is not in progress' });

    // Apply batch answers when provided (new client flow)
    if (Array.isArray(answers) && answers.length > 0) {
      // Single batch fetch for any legacy QAs that are missing correctOption
      const missingIds = attempt.questionAttempts
        .filter((qa) => !qa.correctOption)
        .map((qa) => qa.mcqId);

      const fallbackMap = {};
      if (missingIds.length > 0) {
        const mcqs = await MCQ.find({ _id: { $in: missingIds } }).select('_id options').lean();
        for (const m of mcqs) {
          const co = m.options?.find((o) => o.isCorrect)?.optionLetter;
          if (co) fallbackMap[m._id.toString()] = co;
        }
      }

      for (const ans of answers) {
        const idx = ans.questionIndex;
        if (idx == null || idx < 0 || idx >= attempt.questionAttempts.length) continue;
        const qa = attempt.questionAttempts[idx];
        if (ans.selectedOption  !== undefined) qa.selectedOption  = ans.selectedOption;
        if (ans.markedForReview !== undefined) qa.markedForReview = ans.markedForReview;

        const correctOpt = qa.correctOption || fallbackMap[qa.mcqId.toString()];
        qa.isCorrect = qa.selectedOption != null && qa.selectedOption === correctOpt;
      }
    }

    // Compute score inline — no pre-save hook required
    const correctAnswers  = attempt.questionAttempts.filter((qa) => qa.isCorrect).length;
    attempt.score         = correctAnswers;
    attempt.maxScore      = attempt.questionAttempts.length;
    attempt.answeredCount = attempt.questionAttempts.filter((qa) => qa.selectedOption !== null).length;
    attempt.scorePercentage = attempt.maxScore > 0 ? (correctAnswers / attempt.maxScore) * 100 : 0;

    attempt.status  = 'completed';
    attempt.endTime = new Date();
    if (totalTimeSpent) attempt.totalTimeSpent = totalTimeSpent;

    await attempt.save();

    updateUserMcqHistory(attempt);  // fire-and-forget — does not block the response
    updateMcqOptionStats(attempt);  // fire-and-forget — increments per-option pick counts

    // Dashboard summary cache for this user is now stale (test stats changed
    // — students DO refresh the dashboard right after finishing a test to see
    // their new score). Cheap: just deletes one Map entry.
    // Admin cache is NOT invalidated — admins refresh manually for fresh KPIs.
    try {
      require('../utils/dashboardCache').invalidateUser(req.user.id);
    } catch { /* never fail the response on a cache miss */ }

    const totalQuestions   = attempt.questionAttempts.length;
    const answeredQuestions = attempt.questionAttempts.filter((q) => q.selectedOption !== null).length;
    const accuracy          = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    res.status(200).json({
      success: true,
      message: 'Test completed successfully',
      data: {
        attempt,
        summary: {
          totalQuestions,
          answeredQuestions,
          correctAnswers,
          accuracy,
          totalTimeSpent:  attempt.totalTimeSpent,
          score:           attempt.score,
          maxScore:        attempt.maxScore,
          scorePercentage: attempt.scorePercentage,
        },
      },
    });
  } catch (error) {
    console.error('Error completing test:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Get user test history — server-side pagination, filtering, and no questionAttempts in list.
 * @route GET /api/user-tests/history?page=1&limit=20&status=&mode=&search=&subject=&chapter=&topic=&qbId=&date=
 * @access Private
 */
exports.getUserTestHistory = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;
    const isFirstPage = page === 1;

    // ── Build filter on UserTestAttempt directly ────────────────────────────
    // Thanks to the test-snapshot fields (testTitle, testSubjects, …,
    // questionBankId) we can apply every filter on UserTestAttempt without
    // ever joining Test. That kills the old "Test.find first, then filter
    // attempts" round-trip.
    const q = { user: req.user.id };
    if (req.query.status && req.query.status !== 'all') q.status = req.query.status;
    if (req.query.mode   && req.query.mode   !== 'all') q.mode   = req.query.mode;

    if (req.query.date && req.query.date !== 'all') {
      const now = Date.now();
      if (req.query.date === 'today') {
        const d = new Date(); d.setHours(0, 0, 0, 0);
        q.createdAt = { $gte: d };
      } else if (req.query.date === 'week') {
        q.createdAt = { $gte: new Date(now - 7  * 86400000) };
      } else if (req.query.date === 'month') {
        q.createdAt = { $gte: new Date(now - 30 * 86400000) };
      }
    }

    const { search, subject, chapter, topic, qbId } = req.query;
    if (search)                       q.testTitle      = { $regex: search, $options: 'i' };
    if (subject && subject !== 'all') q.testSubjects   = subject;
    if (chapter && chapter !== 'all') q.testChapters   = chapter;
    if (topic   && topic   !== 'all') q.testTopics     = topic;
    if (qbId    && qbId    !== 'all') q.questionBankId = qbId;

    // ── Page-2+ fast path: ONE query total ─────────────────────────────────
    // Pull `limit + 1` rows so we know whether more pages exist (hasMore)
    // without the cost of a separate countDocuments(). Stats + filterOptions
    // were sent on page 1 — frontend caches them and reuses on subsequent pages.
    const PROJECTION = 'test mode status score maxScore scorePercentage answeredCount ' +
                       'startTime endTime totalTimeSpent createdAt ' +
                       'testTitle testSubjects testChapters testTopics ' +
                       'questionBankId questionBankTitle totalQuestions';

    if (!isFirstPage) {
      const docs = await UserTestAttempt.find(q)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit + 1) // +1 sentinel for hasMore detection
        .select(PROJECTION)
        .lean();
      const hasMore = docs.length > limit;
      return res.status(200).json({
        success: true,
        data:    hasMore ? docs.slice(0, limit) : docs,
        page,
        hasMore,
      });
    }

    // ── Page 1: TWO queries total ──────────────────────────────────────────
    // 1) Attempts find (with hasMore sentinel)
    // 2) One $facet aggregation that computes stats + filter options together
    //
    // All of this runs against UserTestAttempt only — no joins. Filter options
    // are derived from the same denormalised arrays the History row reads from.
    const oid = new mongoose.Types.ObjectId(req.user.id);

    const [docs, [metaAgg]] = await Promise.all([
      UserTestAttempt.find(q)
        .sort({ createdAt: -1 })
        .limit(limit + 1)
        .select(PROJECTION)
        .lean(),

      // ONE aggregation, three branches via $facet — all on UserTestAttempt.
      UserTestAttempt.aggregate([
        { $match: { user: oid } },
        {
          $facet: {
            stats: [
              { $group: {
                  _id:       null,
                  total:     { $sum: 1 },
                  completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                  abandoned: { $sum: { $cond: [{ $eq: ['$status', 'abandoned'] }, 1, 0] } },
                  sumScore:  { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$scorePercentage', 0] } },
              }},
            ],
            subjects: [
              { $unwind: '$testSubjects' },
              { $group: { _id: '$testSubjects' } },
              { $match: { _id: { $nin: [null, ''] } } },
              { $sort:  { _id: 1 } },
            ],
            chapters: [
              { $unwind: '$testChapters' },
              { $group: { _id: '$testChapters' } },
              { $match: { _id: { $nin: [null, ''] } } },
              { $sort:  { _id: 1 } },
            ],
            topics: [
              { $unwind: '$testTopics' },
              { $group: { _id: '$testTopics' } },
              { $match: { _id: { $nin: [null, ''] } } },
              { $sort:  { _id: 1 } },
            ],
            qbs: [
              { $match: { questionBankId: { $ne: null } } },
              { $group: { _id: '$questionBankId', title: { $first: '$questionBankTitle' } } },
              { $sort:  { title: 1 } },
            ],
          },
        },
      ]),
    ]);

    const hasMore = docs.length > limit;
    const data    = hasMore ? docs.slice(0, limit) : docs;

    const s = metaAgg?.stats?.[0] || { total: 0, completed: 0, abandoned: 0, sumScore: 0 };
    const stats = {
      total:     s.total,
      completed: s.completed,
      abandoned: s.abandoned,
      avgScore:  s.completed > 0 ? Math.round(s.sumScore / s.completed) : 0,
    };
    const filterOptions = {
      subjects: (metaAgg?.subjects || []).map((x) => x._id),
      chapters: (metaAgg?.chapters || []).map((x) => x._id),
      topics:   (metaAgg?.topics   || []).map((x) => x._id),
      qbs:      (metaAgg?.qbs      || []).map((x) => ({ id: String(x._id), title: x.title || '' })),
    };

    return res.status(200).json({
      success: true,
      data,
      page,
      hasMore,
      stats,
      filterOptions,
    });
  } catch (error) {
    console.error('Error getting test history:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Get saved questions
 * @route GET /api/user-tests/saved-questions
 * @access Private
 */
exports.getSavedQuestions = async (req, res) => {
  try {
    const savedQuestions = await SavedQuestion.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate('mcq')
      .populate('testId', 'title subject topic unit');

    res.status(200).json({ success: true, count: savedQuestions.length, data: savedQuestions });
  } catch (error) {
    console.error('Error getting saved questions:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Toggle mark-for-review on a question
 * @route PUT /api/user-tests/:attemptId/mark/:questionIndex
 * @access Private
 */
exports.toggleMarkForReview = async (req, res) => {
  try {
    const { attemptId, questionIndex } = req.params;
    const attempt = await UserTestAttempt.findById(attemptId);
    if (!attempt) return res.status(404).json({ success: false, message: 'Attempt not found' });
    if (attempt.user.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });

    const idx = parseInt(questionIndex);
    if (idx < 0 || idx >= attempt.questionAttempts.length) return res.status(400).json({ success: false, message: 'Invalid index' });

    attempt.questionAttempts[idx].markedForReview = !attempt.questionAttempts[idx].markedForReview;
    await attempt.save();

    res.status(200).json({ success: true, markedForReview: attempt.questionAttempts[idx].markedForReview });
  } catch (error) {
    console.error('Error toggling mark:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Remove saved question by MCQ ID
 * @route DELETE /api/user-tests/saved-questions/mcq/:mcqId
 * @access Private
 */
exports.removeSavedQuestionByMcqId = async (req, res) => {
  try {
    const { mcqId } = req.params;
    await SavedQuestion.findOneAndDelete({ user: req.user.id, mcq: mcqId });
    res.status(200).json({ success: true, message: 'Removed from saved' });
  } catch (error) {
    console.error('Error removing saved question:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Remove a saved question
 * @route DELETE /api/user-tests/saved-questions/:savedQuestionId
 * @access Private
 */
exports.removeSavedQuestion = async (req, res) => {
  try {
    const { savedQuestionId } = req.params;

    const savedQuestion = await SavedQuestion.findById(savedQuestionId);
    if (!savedQuestion) return res.status(404).json({ success: false, message: 'Saved question not found' });
    if (savedQuestion.user.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });

    await savedQuestion.deleteOne();
    res.status(200).json({ success: true, message: 'Saved question removed successfully' });
  } catch (error) {
    console.error('Error removing saved question:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
