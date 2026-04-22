// Place this file in: controllers/testController.js

const Test = require('../models/TestModel');
const MCQ = require('../models/McqModel');
const QuestionBank = require('../models/QuestionBankModel');
const UserTestAttempt = require('../models/UserTestAttempt');

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
    const query = {};

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

    const tests = await Test.find(query)
      .populate('createdBy', 'fullName')
      .populate('questionBankId', 'title')
      .populate('courseId', 'title')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: tests.length,
      data: tests
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get single test with MCQs
exports.getTest = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id)
      .populate('createdBy', 'fullName')
      .populate('questionBankId', 'title')
      .populate('courseId', 'title')
      .populate('mcqs');
    
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: test
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
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