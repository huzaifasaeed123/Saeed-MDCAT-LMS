const QuestionBank    = require('../models/QuestionBankModel');
const MCQ             = require('../models/McqModel');
const Test            = require('../models/TestModel');
const UserMcqHistory  = require('../models/UserMcqHistory');
const mongoose        = require('mongoose');
const { syncTestClassification } = require('./testController');
const { backfillUserMcqHistory } = require('./userTestController');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isRealId = (id) =>
  id && mongoose.Types.ObjectId.isValid(id) && !String(id).startsWith('tmp_');

const cleanTopic = (t) => {
  const out = {
    title: t.title || '',
    order: typeof t.order === 'number' ? t.order : 0,
  };
  if (isRealId(t._id)) out._id = t._id;
  return out;
};

const cleanChapter = (c) => {
  const out = {
    title: c.title || '',
    order: typeof c.order === 'number' ? c.order : 0,
    topics: (c.topics || []).map(cleanTopic),
  };
  if (isRealId(c._id)) out._id = c._id;
  return out;
};

const cleanSubjects = (subjects = []) =>
  subjects.map((s) => {
    const out = {
      title: s.title || '',
      order: typeof s.order === 'number' ? s.order : 0,
      chapters: (s.chapters || []).map(cleanChapter),
    };
    if (isRealId(s._id)) out._id = s._id;
    return out;
  });

// ─── CRUD ─────────────────────────────────────────────────────────────────────

// GET /api/question-banks  — list (no subjects for performance)
exports.getQuestionBanks = async (req, res) => {
  try {
    const qbs = await QuestionBank.find()
      .populate('createdBy', 'fullName')
      .select('-subjects')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: qbs.length, data: qbs });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/question-banks/:id  — full QB with hierarchy
exports.getQuestionBank = async (req, res) => {
  try {
    const qb = await QuestionBank.findById(req.params.id).populate('createdBy', 'fullName');
    if (!qb) return res.status(404).json({ success: false, message: 'Question Bank not found' });
    res.json({ success: true, data: qb });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// POST /api/question-banks
exports.createQuestionBank = async (req, res) => {
  try {
    const payload = { ...req.body, createdBy: req.user._id };
    if (payload.subjects) payload.subjects = cleanSubjects(payload.subjects);
    const qb = await QuestionBank.create(payload);
    res.status(201).json({ success: true, data: qb });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// PUT /api/question-banks/:id
exports.updateQuestionBank = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.subjects) payload.subjects = cleanSubjects(payload.subjects);
    const qb = await QuestionBank.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });
    if (!qb) return res.status(404).json({ success: false, message: 'Question Bank not found' });
    res.json({ success: true, data: qb });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// DELETE /api/question-banks/:id
exports.deleteQuestionBank = async (req, res) => {
  try {
    const qb = await QuestionBank.findByIdAndDelete(req.params.id);
    if (!qb) return res.status(404).json({ success: false, message: 'Question Bank not found' });
    res.json({ success: true, message: 'Question Bank deleted' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ─── MCQ Count ────────────────────────────────────────────────────────────────

// GET /api/question-banks/:id/mcq-count
// Query params: subjectId, chapterId, topicId (all optional — each narrows the count)
exports.getMcqCount = async (req, res) => {
  try {
    const { id } = req.params;
    const { subjectId, chapterId, topicId } = req.query;

    const filter = { questionBankId: new mongoose.Types.ObjectId(id) };
    if (topicId)        filter.qbTopicId   = new mongoose.Types.ObjectId(topicId);
    else if (chapterId) filter.qbChapterId = new mongoose.Types.ObjectId(chapterId);
    else if (subjectId) filter.qbSubjectId = new mongoose.Types.ObjectId(subjectId);

    const count = await MCQ.countDocuments(filter);
    res.json({ success: true, count });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ─── User MCQ Counts (per-mode breakdown for AutoTestGenerator) ──────────────

// GET /api/question-banks/:id/user-mcq-counts
// Query: topicIds (comma-sep), chapterIds (comma-sep), subjectIds (comma-sep)
// Returns: { total, unused, incorrect, correct, omitted, marked }
exports.getUserMcqCounts = async (req, res) => {
  try {
    const { id } = req.params;
    const userId  = new mongoose.Types.ObjectId(req.user._id);  // cast: JWT id is a string, aggregate $match needs ObjectId
    const qbOid   = new mongoose.Types.ObjectId(id);

    const toIds = (val) => {
      if (!val) return [];
      return (Array.isArray(val) ? val : val.split(','))
        .filter(Boolean)
        .map((v) => new mongoose.Types.ObjectId(v.trim()));
    };

    const topicIds   = toIds(req.query.topicIds);
    const chapterIds = toIds(req.query.chapterIds);
    const subjectIds = toIds(req.query.subjectIds);

    // Scope filter — mirrors the MCQ query in generateTest
    const mcqFilter  = { questionBankId: qbOid };
    const histFilter = { user: userId, questionBankId: qbOid };

    if (topicIds.length > 0) {
      mcqFilter.qbTopicId   = { $in: topicIds };
      histFilter.qbTopicId  = { $in: topicIds };
    } else if (chapterIds.length > 0) {
      mcqFilter.qbChapterId  = { $in: chapterIds };
      histFilter.qbChapterId = { $in: chapterIds };
    } else if (subjectIds.length > 0) {
      mcqFilter.qbSubjectId  = { $in: subjectIds };
      histFilter.qbSubjectId = { $in: subjectIds };
    }

    // Helper: run both aggregations in parallel and return structured result
    const runHistAggs = () => Promise.all([
      UserMcqHistory.aggregate([
        { $match: histFilter },
        { $group: {
          _id:            null,
          attemptedCount: { $sum: 1 },
          incorrectCount: { $sum: { $cond: [{ $eq: ['$lastResult', 'incorrect'] }, 1, 0] } },
          correctCount:   { $sum: { $cond: [{ $eq: ['$lastResult', 'correct']   }, 1, 0] } },
          omittedCount:   { $sum: { $cond: [{ $eq: ['$lastResult', 'omitted']   }, 1, 0] } },
          markedCount:    { $sum: { $cond: ['$markedForReview', 1, 0] } },
        }},
      ]),
      // Per-topic breakdown — always QB-level (no scope), used by frontend for client-side subject/chapter counts
      UserMcqHistory.aggregate([
        { $match: { user: userId, questionBankId: qbOid } },
        { $group: {
          _id:       '$qbTopicId',
          attempted: { $sum: 1 },
          incorrect: { $sum: { $cond: [{ $eq: ['$lastResult', 'incorrect'] }, 1, 0] } },
          correct:   { $sum: { $cond: [{ $eq: ['$lastResult', 'correct']   }, 1, 0] } },
          omitted:   { $sum: { $cond: [{ $eq: ['$lastResult', 'omitted']   }, 1, 0] } },
          marked:    { $sum: { $cond: ['$markedForReview', 1, 0] } },
        }},
      ]),
    ]);

    const [total, [histAgg, topicAgg]] = await Promise.all([
      MCQ.countDocuments(mcqFilter),
      runHistAggs(),
    ]);

    let h = histAgg[0] || { attemptedCount: 0, incorrectCount: 0, correctCount: 0, omittedCount: 0, markedCount: 0 };
    let rawTopicAgg = topicAgg;

    // One-time backfill: runs only when user has zero UserMcqHistory records at all.
    if (h.attemptedCount === 0) {
      const anyHistory = await UserMcqHistory.countDocuments({ user: userId });
      if (anyHistory === 0) {
        await backfillUserMcqHistory(userId);
        const [freshHistAgg, freshTopicAgg] = await runHistAggs();
        h = freshHistAgg[0] || h;
        rawTopicAgg = freshTopicAgg;
      }
    }

    // Build byTopic map — frontend uses this for client-side subject/chapter counting
    const byTopic = {};
    for (const t of rawTopicAgg) {
      if (t._id) byTopic[t._id.toString()] = {
        attempted: t.attempted,
        incorrect: t.incorrect,
        correct:   t.correct,
        omitted:   t.omitted,
        marked:    t.marked,
      };
    }

    res.json({
      success: true,
      data: {
        total,
        unused:    total - h.attemptedCount,
        incorrect: h.incorrectCount,
        correct:   h.correctCount,
        omitted:   h.omittedCount,
        marked:    h.markedCount,
        byTopic,   // { topicId: { attempted, incorrect, correct, omitted, marked } }
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ─── Auto-Test Generation ────────────────────────────────────────────────────

// POST /api/question-banks/generate-test
// Body: {
//   questionBankId,
//   subjectIds: [] | string,   // one or many subject IDs (optional)
//   chapterIds: [] | string,   // one or many chapter IDs (optional)
//   topicIds:   [] | string,   // one or many topic IDs   (optional)
//   count, testTitle, description, session, passingScore, difficultyLevel, instructions
// }
exports.generateTest = async (req, res) => {
  try {
    const {
      questionBankId,
      count,
      description,
      passingScore,
      difficultyLevel,
      instructions,
      existingTestId,   // optional — if provided, add MCQs to this test instead of creating a new one
    } = req.body;

    let testTitle = req.body.testTitle || '';

    if (!questionBankId || !count) {
      return res.status(400).json({
        success: false,
        message: 'questionBankId and count are required',
      });
    }

    // Normalise multi-value arrays (frontend may send a single string or an array)
    const toIds = (val) => {
      if (!val) return [];
      const arr = Array.isArray(val) ? val : [val];
      return arr.filter(Boolean).map((id) => new mongoose.Types.ObjectId(id));
    };

    const subjectIds    = toIds(req.body.subjectIds);
    const chapterIds    = toIds(req.body.chapterIds);
    const topicIds      = toIds(req.body.topicIds);
    const questionMode  = Array.isArray(req.body.questionMode) ? req.body.questionMode.filter(Boolean) : [];

    // Build MCQ filter — most specific scope wins (topic > chapter > subject > bank)
    const qbOid = new mongoose.Types.ObjectId(questionBankId);
    const filter = { questionBankId: qbOid };

    if (topicIds.length > 0)        filter.qbTopicId   = { $in: topicIds };
    else if (chapterIds.length > 0) filter.qbChapterId = { $in: chapterIds };
    else if (subjectIds.length > 0) filter.qbSubjectId = { $in: subjectIds };

    // ── Apply Question Mode filter (unused / incorrect / correct / omitted / marked) ──
    if (questionMode.length > 0) {
      const userId = new mongoose.Types.ObjectId(req.user._id);

      // Scope filter reused for UserMcqHistory queries
      const scopeHist = { user: userId, questionBankId: qbOid };
      if (topicIds.length > 0)        scopeHist.qbTopicId   = { $in: topicIds };
      else if (chapterIds.length > 0) scopeHist.qbChapterId = { $in: chapterIds };
      else if (subjectIds.length > 0) scopeHist.qbSubjectId = { $in: subjectIds };

      const needsUnused = questionMode.includes('unused');
      const histModes   = questionMode.filter((m) => m !== 'unused');
      const eligibleIds = new Set();

      // History-based modes (incorrect / correct / omitted / marked)
      if (histModes.length > 0) {
        const or = [];
        if (histModes.includes('incorrect')) or.push({ lastResult: 'incorrect' });
        if (histModes.includes('correct'))   or.push({ lastResult: 'correct' });
        if (histModes.includes('omitted'))   or.push({ lastResult: 'omitted' });
        if (histModes.includes('marked'))    or.push({ markedForReview: true });
        const hist = await UserMcqHistory.find({ ...scopeHist, $or: or }).select('mcq').lean();
        hist.forEach((h) => eligibleIds.add(h.mcq.toString()));
      }

      // Unused = MCQs in scope the user has never attempted
      if (needsUnused) {
        const attempted = await UserMcqHistory.find(scopeHist).select('mcq').lean();
        const attemptedSet = new Set(attempted.map((h) => h.mcq.toString()));
        const allInScope   = await MCQ.find(filter).select('_id').lean();
        allInScope.forEach((m) => {
          if (!attemptedSet.has(m._id.toString())) eligibleIds.add(m._id.toString());
        });
      }

      if (eligibleIds.size === 0) {
        return res.status(400).json({
          success: false,
          message: 'No MCQs found for the selected question modes',
        });
      }

      filter._id = { $in: [...eligibleIds].map((id) => new mongoose.Types.ObjectId(id)) };
    }

    const available = await MCQ.countDocuments(filter);
    if (available === 0) {
      return res.status(400).json({
        success: false,
        message: 'No MCQs found for the selected criteria',
      });
    }

    // Auto-generate test title when creating a new test without a supplied title
    if (!existingTestId && !testTitle) {
      const userTestCount = await Test.countDocuments({ createdBy: req.user._id });
      testTitle = `Test${10001 + userTestCount}`;
    }

    const pickCount = Math.min(Number(count), available);

    // Random sample via aggregation $sample (correctly casted ObjectId filter)
    const pickedMcqs = await MCQ.aggregate([
      { $match: filter },
      { $sample: { size: pickCount } },
      { $project: { _id: 1 } },
    ]);
    const mcqIds = pickedMcqs.map((m) => m._id);

    let test;

    if (existingTestId) {
      // Add MCQs to the existing test
      test = await Test.findById(existingTestId);
      if (!test) return res.status(404).json({ success: false, message: 'Test not found' });
      const existing = new Set(test.mcqs.map((id) => id.toString()));
      const toAdd = mcqIds.filter((id) => !existing.has(id.toString()));
      test.mcqs.push(...toAdd);
      test.totalQuestions = test.mcqs.length;
      if (!test.questionBankId) test.questionBankId = questionBankId;
      await test.save();
    } else {
      // Resolve QB title for display
      const qb = await QuestionBank.findById(questionBankId).select('title');
      test = await Test.create({
        title: testTitle,
        description: description || '',
        passingScore: Number(passingScore) || 50,
        difficultyLevel: difficultyLevel || 'Medium',
        instructions: instructions || '',
        totalQuestions: mcqIds.length,
        mcqs: mcqIds,
        createdBy: req.user._id,
        questionBankId,
        status: 'published',
        isPublished: true,
      });
    }

    // Sync subjects/chapters/topics from the selected MCQs
    await syncTestClassification(test._id);

    const updated = await Test.findById(test._id)
      .populate('questionBankId', 'title')
      .populate('courseId', 'title');

    res.status(existingTestId ? 200 : 201).json({ success: true, data: updated });
  } catch (err) {
    console.error('generateTest error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
};
