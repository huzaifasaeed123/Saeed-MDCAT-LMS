const QuestionBank = require('../models/QuestionBankModel');
const MCQ          = require('../models/McqModel');
const Test         = require('../models/TestModel');
const mongoose     = require('mongoose');
const { syncTestClassification } = require('./testController');

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
      testTitle,
      description,
      passingScore,
      difficultyLevel,
      instructions,
      existingTestId,   // optional — if provided, add MCQs to this test instead of creating a new one
    } = req.body;

    if (!questionBankId || !count) {
      return res.status(400).json({
        success: false,
        message: 'questionBankId and count are required',
      });
    }
    if (!existingTestId && !testTitle) {
      return res.status(400).json({
        success: false,
        message: 'testTitle is required when not using an existing test',
      });
    }

    // Normalise multi-value arrays (frontend may send a single string or an array)
    const toIds = (val) => {
      if (!val) return [];
      const arr = Array.isArray(val) ? val : [val];
      return arr.filter(Boolean).map((id) => new mongoose.Types.ObjectId(id));
    };

    const subjectIds = toIds(req.body.subjectIds);
    const chapterIds = toIds(req.body.chapterIds);
    const topicIds   = toIds(req.body.topicIds);

    // Build MCQ filter — most specific scope wins (topic > chapter > subject > bank)
    const qbOid = new mongoose.Types.ObjectId(questionBankId);
    const filter = { questionBankId: qbOid };

    if (topicIds.length > 0)        filter.qbTopicId   = { $in: topicIds };
    else if (chapterIds.length > 0) filter.qbChapterId = { $in: chapterIds };
    else if (subjectIds.length > 0) filter.qbSubjectId = { $in: subjectIds };

    const available = await MCQ.countDocuments(filter);
    if (available === 0) {
      return res.status(400).json({
        success: false,
        message: 'No MCQs found for the selected criteria',
      });
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
