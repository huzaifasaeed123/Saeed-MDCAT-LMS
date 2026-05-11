// Place this file in: controllers/testController.js

const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Test = require('../models/TestModel');
const MCQ = require('../models/McqModel');
const QuestionBank = require('../models/QuestionBankModel');
const UserTestAttempt = require('../models/UserTestAttempt');
const User = require('../models/User');

/**
 * Reads every MCQ attached to a test, resolves QB hierarchy names,
 * and writes unique subjects/chapters/topics arrays back onto the test.
 * Called fire-and-forget after MCQs are added or removed.
 */
const syncTestClassification = async (testId) => {
  try {
    const test = await Test.findById(testId).populate('mcqs');
    if (!test) return;

    const subjects = new Set();
    const chapters = new Set();
    const topics   = new Set();

    // Group QB-linked MCQs by QB to minimise DB round-trips
    const qbMap = {};
    for (const mcq of test.mcqs) {
      if (mcq.subject) subjects.add(mcq.subject);
      if (mcq.unit)    chapters.add(mcq.unit);
      if (mcq.topic)   topics.add(mcq.topic);
      if (mcq.questionBankId) {
        const key = mcq.questionBankId.toString();
        if (!qbMap[key]) qbMap[key] = [];
        qbMap[key].push(mcq);
      }
    }

    for (const [qbId, mcqs] of Object.entries(qbMap)) {
      const qb = await QuestionBank.findById(qbId);
      if (!qb) continue;
      for (const mcq of mcqs) {
        if (!mcq.qbSubjectId) continue;
        const subj = qb.subjects.id(mcq.qbSubjectId);
        if (!subj) continue;
        subjects.add(subj.title);
        if (mcq.qbChapterId) {
          const chap = subj.chapters.id(mcq.qbChapterId);
          if (chap) {
            chapters.add(chap.title);
            if (mcq.qbTopicId) {
              const top = chap.topics.id(mcq.qbTopicId);
              if (top) topics.add(top.title);
            }
          }
        }
      }
    }

    await Test.findByIdAndUpdate(testId, {
      subjects: [...subjects].filter(Boolean),
      chapters: [...chapters].filter(Boolean),
      topics:   [...topics].filter(Boolean),
    });
  } catch (err) {
    console.error('syncTestClassification error:', err);
  }
};

exports.syncTestClassification = syncTestClassification;

// Create new test
exports.createTest = async (req, res) => {
  try {
    const testData = {
      ...req.body,
      createdBy: req.user._id
    };

    const test = await Test.create(testData);
    
    res.status(201).json({
      success: true,
      data: test
    });
  } catch (error) {
    console.log('Error creating test:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get all tests
exports.getTests = async (req, res) => {
  try {
    // Lightweight metadata-only mode for populating filter dropdowns (no pagination, minimal fields)
    if (req.query.metaOnly === '1') {
      const metaTests = await Test.find({})
        .select('_id subjects chapters topics subject unit questionBankId')
        .populate('questionBankId', 'title')
        .lean();
      return res.json({ success: true, data: metaTests });
    }

    const query = {};

    if (req.query.search) query.title = { $regex: req.query.search, $options: 'i' };
    if (req.query.status) query.status = req.query.status;

    if (req.query.subject) query.subjects = req.query.subject;
    if (req.query.chapter) {
      query.$and = [...(query.$and || []), { chapters: req.query.chapter }];
    }
    if (req.query.topic) {
      query.$and = [...(query.$and || []), { topics: req.query.topic }];
    }

    if (req.query.questionBankId) query.questionBankId = req.query.questionBankId;
    if (req.query.courseId)       query.courseId       = req.query.courseId;

    if (req.query.dateFrom || req.query.dateTo) {
      query.createdAt = {};
      if (req.query.dateFrom) query.createdAt.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) {
        const d = new Date(req.query.dateTo);
        d.setHours(23, 59, 59, 999);
        query.createdAt.$lte = d;
      }
    }

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(200, parseInt(req.query.limit) || 0); // 0 = no limit (backward compat)
    const skip  = limit > 0 ? (page - 1) * limit : 0;

    let q = Test.find(query)
      .populate('createdBy', 'fullName')
      .populate('questionBankId', 'title')
      .populate('courseId', 'title')
      .sort({ createdAt: -1 });

    if (limit > 0) q = q.skip(skip).limit(limit);

    const [tests, total] = await Promise.all([q, limit > 0 ? Test.countDocuments(query) : null]);

    res.status(200).json({
      success: true,
      count: tests.length,
      total: total ?? tests.length,
      page,
      pages: limit > 0 ? Math.ceil((total ?? tests.length) / limit) : 1,
      data: tests,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get single test — ?summary=1 returns metadata only (no MCQ objects, much lighter)
exports.getTest = async (req, res) => {
  try {
    let q = Test.findById(req.params.id)
      .populate('createdBy', 'fullName')
      .populate('questionBankId', 'title')
      .populate('courseId', 'title');

    if (req.query.summary !== '1') {
      q = q.populate('mcqs');
    }

    const test = await q;
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }

    res.status(200).json({ success: true, data: test });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Update test
exports.updateTest = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }
    
    // Only allow creator to update
    // if (test.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Not authorized to update this test'
    //   });
    // }
    
    const updatedTest = await Test.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );
    
    res.status(200).json({
      success: true,
      data: updatedTest
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Delete test
exports.deleteTest = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }
    
    // Only allow creator to delete
    // if (test.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Not authorized to delete this test'
    //   });
    // }
    
    // Delete MCQs owned by this test and all student attempt records
    await MCQ.deleteMany({ testId: test._id });
    await UserTestAttempt.deleteMany({ test: test._id });

    await test.deleteOne();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// POST /api/tests/:id/add-mcqs
// Body: { mcqIds: [ObjectId] }
// Adds existing MCQs (from QB) to a test's mcqs array without touching their testId
exports.addMcqsToTest = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

    const { mcqIds } = req.body;
    if (!Array.isArray(mcqIds) || mcqIds.length === 0) {
      return res.status(400).json({ success: false, message: 'mcqIds array is required' });
    }

    // Add only new (non-duplicate) IDs
    const existing = new Set(test.mcqs.map((id) => id.toString()));
    const toAdd = mcqIds.filter((id) => !existing.has(id.toString()));
    test.mcqs.push(...toAdd);
    test.totalQuestions = test.mcqs.length;
    await test.save();

    // Async — fire and forget
    syncTestClassification(test._id).catch(console.error);

    res.json({ success: true, added: toAdd.length, totalQuestions: test.totalQuestions });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Publish test
exports.publishTest = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }
    
    if (test.mcqs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot publish test with no MCQs'
      });
    }
    
    test.status = 'published';
    test.isPublished = true;
    await test.save();

    // Sync subjects/chapters/topics from MCQs before returning
    await syncTestClassification(test._id);

    const updated = await Test.findById(test._id)
      .populate('questionBankId', 'title')
      .populate('courseId', 'title');

    res.status(200).json({
      success: true,
      data: updated
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ─── Admin/Teacher: Test Stats ─────────────────────────────────────────────
// Internal aggregator — shared by the JSON endpoint and the Excel export so
// both views are guaranteed identical numbers. Pulls everything in ONE
// $facet pipeline against UserTestAttempt: attempts list, summary, score
// histogram, top scorers, and per-MCQ pick distribution.
const _buildTestStats = async (testId) => {
  const oid = new mongoose.Types.ObjectId(testId);

  const [test, facetResult] = await Promise.all([
    Test.findById(testId).select('title passingScore mcqs totalQuestions createdAt').lean(),
    UserTestAttempt.aggregate([
      { $match: { test: oid } },
      {
        $facet: {
          // Per-attempt rows (used for top scorers + Excel "Attempts" sheet)
          attempts: [
            { $project: {
              user: 1, mode: 1, status: 1, score: 1, maxScore: 1, scorePercentage: 1,
              totalTimeSpent: 1, startTime: 1, endTime: 1, createdAt: 1, answeredCount: 1,
              reportedCount:  { $size: { $filter: { input: '$questionAttempts', as: 'qa', cond: { $eq: ['$$qa.reported', true] } } } },
              correctCount:   { $size: { $filter: { input: '$questionAttempts', as: 'qa', cond: { $eq: ['$$qa.isCorrect', true] } } } },
            }},
          ],
          // High-level summary in a single pass
          summary: [
            { $group: {
              _id: null,
              total:        { $sum: 1 },
              completed:    { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
              inProgress:   { $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] } },
              abandoned:    { $sum: { $cond: [{ $eq: ['$status', 'abandoned'] }, 1, 0] } },
              tutorMode:    { $sum: { $cond: [{ $eq: ['$mode', 'tutor'] }, 1, 0] } },
              timerMode:    { $sum: { $cond: [{ $eq: ['$mode', 'timer'] }, 1, 0] } },
              uniqueUsers:  { $addToSet: '$user' },
              completedPct: { $push: { $cond: [{ $eq: ['$status', 'completed'] }, '$scorePercentage', null] } },
              completedTime:{ $push: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalTimeSpent',  null] } },
              firstAttempt: { $min: '$createdAt' },
              lastAttempt:  { $max: '$createdAt' },
            }},
            { $project: {
              _id: 0, total: 1, completed: 1, inProgress: 1, abandoned: 1,
              tutorMode: 1, timerMode: 1,
              uniqueUsers:  { $size: '$uniqueUsers' },
              firstAttempt: 1, lastAttempt: 1,
              // Strip nulls from the percentile/time arrays so avg/min/max ignore in-progress rows
              completedPct:  { $filter: { input: '$completedPct',  as: 'v', cond: { $ne: ['$$v', null] } } },
              completedTime: { $filter: { input: '$completedTime', as: 'v', cond: { $ne: ['$$v', null] } } },
            }},
          ],
          // Per-MCQ pick distribution across ALL attempts
          perQuestion: [
            { $unwind: '$questionAttempts' },
            { $group: {
              _id: '$questionAttempts.mcqId',
              correctOption: { $first: '$questionAttempts.correctOption' },
              total:         { $sum: 1 },
              pickA:         { $sum: { $cond: [{ $eq: ['$questionAttempts.selectedOption', 'A'] }, 1, 0] } },
              pickB:         { $sum: { $cond: [{ $eq: ['$questionAttempts.selectedOption', 'B'] }, 1, 0] } },
              pickC:         { $sum: { $cond: [{ $eq: ['$questionAttempts.selectedOption', 'C'] }, 1, 0] } },
              pickD:         { $sum: { $cond: [{ $eq: ['$questionAttempts.selectedOption', 'D'] }, 1, 0] } },
              pickE:         { $sum: { $cond: [{ $eq: ['$questionAttempts.selectedOption', 'E'] }, 1, 0] } },
              omitted:       { $sum: { $cond: [{ $eq: ['$questionAttempts.selectedOption', null] }, 1, 0] } },
              correctCount:  { $sum: { $cond: [{ $eq: ['$questionAttempts.isCorrect', true] }, 1, 0] } },
              reportedCount: { $sum: { $cond: [{ $eq: ['$questionAttempts.reported', true] }, 1, 0] } },
            }},
          ],
        },
      },
    ]),
  ]);

  if (!test) return null;

  const f = facetResult[0] || { attempts: [], summary: [], perQuestion: [] };
  const summaryRow = f.summary[0] || {
    total: 0, completed: 0, inProgress: 0, abandoned: 0,
    tutorMode: 0, timerMode: 0, uniqueUsers: 0,
    firstAttempt: null, lastAttempt: null, completedPct: [], completedTime: [],
  };

  // ── Stats derived in-memory from the aggregation result ────────────────
  const pcts  = summaryRow.completedPct;
  const times = summaryRow.completedTime;
  const passingScore = test.passingScore || 0;

  const sum = (arr) => arr.reduce((a, b) => a + (b || 0), 0);
  const median = (arr) => {
    if (arr.length === 0) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
  };

  const summary = {
    totalAttempts:    summaryRow.total,
    completedCount:   summaryRow.completed,
    inProgressCount:  summaryRow.inProgress,
    abandonedCount:   summaryRow.abandoned,
    tutorModeCount:   summaryRow.tutorMode,
    timerModeCount:   summaryRow.timerMode,
    uniqueStudents:   summaryRow.uniqueUsers,
    firstAttemptAt:   summaryRow.firstAttempt,
    lastAttemptAt:    summaryRow.lastAttempt,
    avgScorePct:      pcts.length ? +(sum(pcts) / pcts.length).toFixed(2) : 0,
    minScorePct:      pcts.length ? Math.min(...pcts) : 0,
    maxScorePct:      pcts.length ? Math.max(...pcts) : 0,
    medianScorePct:   pcts.length ? +median(pcts).toFixed(2) : 0,
    avgTimeSec:       times.length ? Math.round(sum(times) / times.length) : 0,
    passRate:         pcts.length ? +((pcts.filter((p) => p >= passingScore).length / pcts.length) * 100).toFixed(2) : 0,
    passingScore,
  };

  // Score histogram — 10 buckets of width 10
  const histogram = Array.from({ length: 10 }, (_, i) => ({
    range: `${i * 10}-${(i + 1) * 10}`,
    count: 0,
  }));
  for (const p of pcts) {
    const idx = Math.min(9, Math.max(0, Math.floor(p / 10)));
    histogram[idx].count++;
  }

  // ── Hydrate user names (top scorers + per-attempt rows) in ONE find ────
  const userIds = [...new Set(f.attempts.map((a) => a.user?.toString()).filter(Boolean))]
    .map((id) => new mongoose.Types.ObjectId(id));
  const users   = await User.find({ _id: { $in: userIds } })
    .select('_id fullName email')
    .lean();
  const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

  const completedAttempts = f.attempts
    .filter((a) => a.status === 'completed')
    .map((a) => ({
      attemptId:   a._id,
      userId:      a.user,
      userName:    userMap[a.user?.toString()]?.fullName || '',
      userEmail:   userMap[a.user?.toString()]?.email    || '',
      mode:        a.mode,
      score:       a.score,
      maxScore:    a.maxScore,
      scorePercentage: a.scorePercentage,
      totalTimeSpent:  a.totalTimeSpent,
      answeredCount:   a.answeredCount,
      correctCount:    a.correctCount,
      reportedCount:   a.reportedCount,
      startTime:       a.startTime,
      endTime:         a.endTime,
      createdAt:       a.createdAt,
    }));

  const topScorers = completedAttempts
    .slice()
    .sort((x, y) => (y.scorePercentage || 0) - (x.scorePercentage || 0)
                  || (x.totalTimeSpent  || 0) - (y.totalTimeSpent  || 0))
    .slice(0, 10);

  // ── Per-question: enrich with MCQ text in ONE find call ────────────────
  const mcqIds = f.perQuestion.map((q) => q._id).filter(Boolean);
  const mcqs   = await MCQ.find({ _id: { $in: mcqIds } })
    .select('_id questionText options subject unit topic')
    .lean();
  const mcqMap = Object.fromEntries(mcqs.map((m) => [m._id.toString(), m]));

  const perQuestion = f.perQuestion.map((q) => {
    const m = mcqMap[q._id?.toString()] || {};
    const correctLetter = q.correctOption
      || m.options?.find((o) => o.isCorrect)?.optionLetter
      || null;
    const denom = q.total || 1;
    return {
      mcqId:         q._id,
      questionText:  m.questionText || '',
      subject:       m.subject || '',
      chapter:       m.unit || '',
      topic:         m.topic || '',
      correctOption: correctLetter,
      total:         q.total,
      correctCount:  q.correctCount,
      correctPct:    +((q.correctCount / denom) * 100).toFixed(2),
      omitted:       q.omitted,
      omittedPct:    +((q.omitted / denom) * 100).toFixed(2),
      reportedCount: q.reportedCount,
      picks: {
        A: q.pickA, B: q.pickB, C: q.pickC, D: q.pickD, E: q.pickE,
        Apct: +((q.pickA / denom) * 100).toFixed(2),
        Bpct: +((q.pickB / denom) * 100).toFixed(2),
        Cpct: +((q.pickC / denom) * 100).toFixed(2),
        Dpct: +((q.pickD / denom) * 100).toFixed(2),
        Epct: +((q.pickE / denom) * 100).toFixed(2),
      },
    };
  });

  return {
    test: { _id: test._id, title: test.title, passingScore, totalQuestions: test.totalQuestions, createdAt: test.createdAt },
    summary,
    histogram,
    topScorers,
    perQuestion,
    completedAttempts,
    rawAttempts: f.attempts, // kept for the detailed-answers Excel sheet
  };
};

// GET /api/tests/:id/stats — JSON view for the admin Stats page.
exports.getTestStats = async (req, res) => {
  try {
    const stats = await _buildTestStats(req.params.id);
    if (!stats) return res.status(404).json({ success: false, message: 'Test not found' });

    // Drop heavy fields that are only used by the Excel exporter.
    const { rawAttempts, ...lite } = stats;
    res.json({ success: true, data: lite });
  } catch (error) {
    console.error('getTestStats error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET /api/tests/:id/stats/export[?detail=1] — streams an .xlsx workbook.
// Default workbook = 3 sheets (Summary, Attempts, Per-Question). Add ?detail=1
// to also include a fourth sheet with one row per (attempt × question).
exports.exportTestStats = async (req, res) => {
  try {
    const stats = await _buildTestStats(req.params.id);
    if (!stats) return res.status(404).json({ success: false, message: 'Test not found' });

    const wb = XLSX.utils.book_new();
    const fmtDate = (d) => d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) : '';
    const fmtSecs = (s) => {
      if (!s) return '00:00';
      const m = Math.floor(s / 60); const sec = s % 60;
      return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };

    // ── Sheet 1: Summary ───────────────────────────────────────────────
    const s = stats.summary;
    const summaryRows = [
      ['Test',                stats.test.title],
      ['Total Questions',     stats.test.totalQuestions || 0],
      ['Passing Score (%)',   s.passingScore],
      ['First Attempt',       fmtDate(s.firstAttemptAt)],
      ['Last Attempt',        fmtDate(s.lastAttemptAt)],
      [],
      ['Total Attempts',      s.totalAttempts],
      ['Completed',           s.completedCount],
      ['In Progress',         s.inProgressCount],
      ['Abandoned',           s.abandonedCount],
      ['Unique Students',     s.uniqueStudents],
      ['Tutor Mode',          s.tutorModeCount],
      ['Timer Mode',          s.timerModeCount],
      [],
      ['Average Score (%)',   s.avgScorePct],
      ['Median Score (%)',    s.medianScorePct],
      ['Min Score (%)',       s.minScorePct],
      ['Max Score (%)',       s.maxScorePct],
      ['Pass Rate (%)',       s.passRate],
      ['Average Time',        fmtSecs(s.avgTimeSec)],
      [],
      ['Score Distribution'],
      ['Range (%)', 'Students'],
      ...stats.histogram.map((h) => [h.range, h.count]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');

    // ── Sheet 2: Attempts (one row per completed attempt) ──────────────
    const attemptHeader = [
      'Student', 'Email', 'Mode', 'Score', 'Max', 'Score %', 'Answered', 'Correct',
      'Reported', 'Time (mm:ss)', 'Started', 'Ended',
    ];
    const attemptRows = stats.completedAttempts.map((a) => [
      a.userName, a.userEmail, a.mode, a.score, a.maxScore, a.scorePercentage,
      a.answeredCount, a.correctCount, a.reportedCount,
      fmtSecs(a.totalTimeSpent), fmtDate(a.startTime), fmtDate(a.endTime),
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([attemptHeader, ...attemptRows]), 'Attempts');

    // ── Sheet 3: Per-Question stats ────────────────────────────────────
    const qHeader = [
      '#', 'Question', 'Subject', 'Chapter', 'Topic', 'Correct Option', 'Total',
      'Correct', 'Correct %', 'Omitted', 'Omitted %', 'Reported',
      'A picks', 'A %', 'B picks', 'B %', 'C picks', 'C %',
      'D picks', 'D %', 'E picks', 'E %',
    ];
    const qRows = stats.perQuestion.map((q, i) => [
      i + 1, q.questionText, q.subject, q.chapter, q.topic, q.correctOption,
      q.total, q.correctCount, q.correctPct, q.omitted, q.omittedPct, q.reportedCount,
      q.picks.A, q.picks.Apct, q.picks.B, q.picks.Bpct,
      q.picks.C, q.picks.Cpct, q.picks.D, q.picks.Dpct, q.picks.E, q.picks.Epct,
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([qHeader, ...qRows]), 'Per-Question');

    // ── Sheet 4 (optional): per-attempt × per-question audit trail ─────
    // Heavy. For a 40k×200 test this would be 8M rows — opt-in only.
    if (req.query.detail === '1') {
      const detailHeader = ['Student', 'Email', 'Attempt', 'Q#', 'Selected', 'Correct', 'Is Correct', 'Reported', 'Marked'];
      const detailRows = [];
      // We need questionAttempts for each attempt; fetch them once.
      const fullAttempts = await UserTestAttempt.find({ test: req.params.id })
        .select('user mode questionAttempts createdAt')
        .lean();
      const userIds = [...new Set(fullAttempts.map((a) => a.user?.toString()))].map((id) => new mongoose.Types.ObjectId(id));
      const users   = await User.find({ _id: { $in: userIds } }).select('_id fullName email').lean();
      const uMap    = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

      for (const a of fullAttempts) {
        const u = uMap[a.user?.toString()] || {};
        a.questionAttempts.forEach((qa, idx) => {
          detailRows.push([
            u.fullName || '', u.email || '', String(a._id), idx + 1,
            qa.selectedOption || '', qa.correctOption || '',
            qa.isCorrect ? 'Yes' : 'No',
            qa.reported  ? 'Yes' : 'No',
            qa.markedForReview ? 'Yes' : 'No',
          ]);
        });
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows]), 'Detailed-Answers');
    }

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    const safeTitle = (stats.test.title || 'test').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 50);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="test-stats-${safeTitle}.xlsx"`);
    res.send(buf);
  } catch (error) {
    console.error('exportTestStats error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};