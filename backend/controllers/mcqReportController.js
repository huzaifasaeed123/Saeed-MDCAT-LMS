const mongoose = require('mongoose');
const MCQReport = require('../models/MCQReport');
const MCQ = require('../models/McqModel');
const UserTestAttempt = require('../models/UserTestAttempt');
const User = require('../models/User');
const QuestionBank = require('../models/QuestionBankModel');

// Populate fields used across multiple endpoints
const MCQ_POPULATE = 'questionText options subject unit topic difficulty explanationText questionBankId testId';
const FULL_POPULATE = [
  { path: 'mcq', select: MCQ_POPULATE },
  { path: 'reportedBy', select: 'fullName email role' },
  { path: 'handledBy', select: 'fullName role email' },
  { path: 'closedBy', select: 'fullName role' },
  { path: 'messages.sender', select: 'fullName role' },
];

// ── POST /api/mcq-reports ─────────────────────────────────────────────────────
exports.createReport = async (req, res) => {
  try {
    const { mcqId, testId, attemptId, questionIndex, reason, details } = req.body;

    if (!mcqId || !reason) {
      return res.status(400).json({ success: false, message: 'mcqId and reason are required' });
    }

    const mcq = await MCQ.findById(mcqId);
    if (!mcq) return res.status(404).json({ success: false, message: 'MCQ not found' });

    // Prevent duplicate open/active reports from same student for same MCQ
    const existing = await MCQReport.findOne({
      mcq: mcqId,
      reportedBy: req.user.id,
      status: { $in: ['open', 'active'] },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: 'You already have an open report for this question' });
    }

    // Look up QB name for denormalized filter
    let qbName = '';
    let qbObjectId = null;
    if (mcq.questionBankId) {
      try {
        const qb = await QuestionBank.findById(mcq.questionBankId).select('name');
        qbName = qb?.name || '';
        qbObjectId = mcq.questionBankId;
      } catch (_) {}
    }

    const report = await MCQReport.create({
      mcq: mcqId,
      test: testId || null,
      attempt: attemptId || null,
      reportedBy: req.user.id,
      reason,
      details: details || '',
      mcqSubject: mcq.subject || '',
      mcqChapter: mcq.unit || '',
      mcqTopic: mcq.topic || '',
      mcqQuestionBank: qbName,
      mcqQuestionBankId: qbObjectId,
    });

    // Mirror the report on the UserTestAttempt so TestPlayerPage UI updates
    if (attemptId && questionIndex !== undefined && questionIndex !== null) {
      const idx = parseInt(questionIndex);
      await UserTestAttempt.findByIdAndUpdate(attemptId, {
        [`questionAttempts.${idx}.reported`]: true,
        [`questionAttempts.${idx}.reportReason`]: `${reason}${details ? ': ' + details : ''}`,
      });
    }

    res.status(201).json({ success: true, data: report });
  } catch (err) {
    console.error('createReport error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/mcq-reports/my ───────────────────────────────────────────────────
// Student's own reports with filters + pagination + stats in single response
exports.getMyReports = async (req, res) => {
  try {
    const { status, subject, chapter, topic, questionBank, satisfied, page = 1 } = req.query;
    const limit = 20;
    const skip = (parseInt(page) - 1) * limit;
    const uid = req.user.id;

    const filter = { reportedBy: uid };
    if (status && status !== 'all') filter.status = status;
    if (subject)      filter.mcqSubject      = subject;
    if (chapter)      filter.mcqChapter      = chapter;
    if (topic)        filter.mcqTopic        = topic;
    if (questionBank) filter.mcqQuestionBank = questionBank;
    if (satisfied === 'true')  filter.studentSatisfied = true;
    if (satisfied === 'false') filter.studentSatisfied = false;

    const [reports, total, statsRaw, allForFilters] = await Promise.all([
      MCQReport.find(filter)
        .populate(FULL_POPULATE)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      MCQReport.countDocuments(filter),
      // Stats always across ALL student reports (unfiltered)
      MCQReport.aggregate([
        { $match: { reportedBy: new mongoose.Types.ObjectId(uid) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      // Filter option values from all student reports
      MCQReport.find({ reportedBy: uid }).select('mcqSubject mcqChapter mcqTopic mcqQuestionBank'),
    ]);

    const stats = { total: 0, open: 0, active: 0, closed: 0 };
    statsRaw.forEach(s => {
      stats[s._id] = s.count;
      stats.total += s.count;
    });

    const subjects      = [...new Set(allForFilters.map(r => r.mcqSubject).filter(Boolean))].sort();
    const chapters      = [...new Set(allForFilters.map(r => r.mcqChapter).filter(Boolean))].sort();
    const topics        = [...new Set(allForFilters.map(r => r.mcqTopic).filter(Boolean))].sort();
    const questionBanks = [...new Set(allForFilters.map(r => r.mcqQuestionBank).filter(Boolean))].sort();

    res.json({
      success: true,
      data: reports,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      stats,
      filterOptions: { subjects, chapters, topics, questionBanks },
    });
  } catch (err) {
    console.error('getMyReports error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/mcq-reports ─────────────────────────────────────────────────────
// Teacher: sees open reports + reports they handle
// Admin: sees everything
exports.getAllReports = async (req, res) => {
  try {
    const { status, subject, chapter, topic, questionBank, satisfied, handledBy, page = 1 } = req.query;
    const limit = 20;
    const skip = (parseInt(page) - 1) * limit;

    const isAdmin = req.user.role === 'admin';

    let baseFilter = {};
    if (!isAdmin) {
      baseFilter.$or = [{ status: 'open' }, { handledBy: req.user.id }];
    }

    const filter = { ...baseFilter };
    if (status && status !== 'all') {
      if (!isAdmin) {
        if (status === 'open') {
          filter.$or = [{ status: 'open' }];
        } else {
          delete filter.$or;
          filter.handledBy = req.user.id;
          filter.status = status;
        }
      } else {
        filter.status = status;
      }
    }
    if (subject)      filter.mcqSubject      = subject;
    if (chapter)      filter.mcqChapter      = chapter;
    if (topic)        filter.mcqTopic        = topic;
    if (questionBank) filter.mcqQuestionBank = questionBank;
    if (satisfied === 'true')  filter.studentSatisfied = true;
    if (satisfied === 'false') filter.studentSatisfied = false;
    if (handledBy && isAdmin) filter.handledBy = handledBy;

    // Build visible scope for filter options
    const visibleScope = isAdmin ? {} : { $or: [{ status: 'open' }, { handledBy: req.user.id }] };

    const [reports, total, allVisible] = await Promise.all([
      MCQReport.find(filter)
        .populate(FULL_POPULATE)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      MCQReport.countDocuments(filter),
      MCQReport.find(visibleScope).select('mcqSubject mcqChapter mcqTopic mcqQuestionBank'),
    ]);

    const subjects      = [...new Set(allVisible.map(r => r.mcqSubject).filter(Boolean))].sort();
    const chapters      = [...new Set(allVisible.map(r => r.mcqChapter).filter(Boolean))].sort();
    const topics        = [...new Set(allVisible.map(r => r.mcqTopic).filter(Boolean))].sort();
    const questionBanks = [...new Set(allVisible.map(r => r.mcqQuestionBank).filter(Boolean))].sort();

    res.json({
      success: true,
      data: reports,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      filterOptions: { subjects, chapters, topics, questionBanks },
    });
  } catch (err) {
    console.error('getAllReports error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/mcq-reports/admin/summary ───────────────────────────────────────
exports.getAdminSummary = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [total, open, active, closed, todayNew, satisfied, notSatisfied] = await Promise.all([
      MCQReport.countDocuments(),
      MCQReport.countDocuments({ status: 'open' }),
      MCQReport.countDocuments({ status: 'active' }),
      MCQReport.countDocuments({ status: 'closed' }),
      MCQReport.countDocuments({ createdAt: { $gte: startOfDay } }),
      MCQReport.countDocuments({ studentSatisfied: true }),
      MCQReport.countDocuments({ studentSatisfied: false }),
    ]);

    res.json({ success: true, data: { total, open, active, closed, todayNew, satisfied, notSatisfied } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/mcq-reports/admin/teacher-stats ──────────────────────────────────
exports.getTeacherStats = async (req, res) => {
  try {
    const stats = await MCQReport.aggregate([
      { $match: { handledBy: { $ne: null } } },
      {
        $group: {
          _id: '$handledBy',
          totalHandled: { $sum: 1 },
          active:       { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          closed:       { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
          satisfied:    { $sum: { $cond: [{ $eq: ['$studentSatisfied', true] }, 1, 0] } },
          notSatisfied: { $sum: { $cond: [{ $eq: ['$studentSatisfied', false] }, 1, 0] } },
          lastActivity: { $max: '$updatedAt' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          name: '$user.fullName',
          email: '$user.email',
          role: '$user.role',
          totalHandled: 1,
          active: 1,
          closed: 1,
          satisfied: 1,
          notSatisfied: 1,
          lastActivity: 1,
        },
      },
      { $sort: { totalHandled: -1 } },
    ]);

    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/mcq-reports/teacher/summary ─────────────────────────────────────
exports.getTeacherOwnSummary = async (req, res) => {
  try {
    const uid = req.user.id;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [openAll, myActive, myClosed, myTotal, newToday] = await Promise.all([
      MCQReport.countDocuments({ status: 'open' }),
      MCQReport.countDocuments({ handledBy: uid, status: 'active' }),
      MCQReport.countDocuments({ handledBy: uid, status: 'closed' }),
      MCQReport.countDocuments({ handledBy: uid }),
      MCQReport.countDocuments({ status: 'open', createdAt: { $gte: startOfDay } }),
    ]);

    res.json({ success: true, data: { openAll, myActive, myClosed, myTotal, newToday } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/mcq-reports/for-mcq/:mcqId ──────────────────────────────────────
// Teacher/admin: get all reports for a specific MCQ (used in sequential editors)
exports.getReportsForMcq = async (req, res) => {
  try {
    const reports = await MCQReport.find({ mcq: req.params.mcqId })
      .populate('reportedBy', 'fullName role email')
      .populate('handledBy', 'fullName role')
      .populate('messages.sender', 'fullName role')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/mcq-reports/counts ───────────────────────────────────────────────
// Teacher/admin: get open/active report counts for a list of MCQ IDs (for MCQ list badges)
exports.getCountsByMcqs = async (req, res) => {
  try {
    const { mcqIds } = req.query;
    if (!mcqIds) return res.json({ success: true, data: {} });

    const ids = mcqIds.split(',').filter(Boolean).map(id => {
      try { return new mongoose.Types.ObjectId(id); } catch { return null; }
    }).filter(Boolean);

    if (ids.length === 0) return res.json({ success: true, data: {} });

    const results = await MCQReport.aggregate([
      { $match: { mcq: { $in: ids }, status: { $in: ['open', 'active'] } } },
      { $group: { _id: '$mcq', count: { $sum: 1 } } },
    ]);

    const data = {};
    results.forEach(r => { data[r._id.toString()] = r.count; });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/mcq-reports/:id/messages ───────────────────────────────────────
exports.addMessage = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }

    const report = await MCQReport.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

    const isOwner = report.reportedBy.toString() === req.user.id;
    const isStaff = req.user.role === 'admin' || req.user.role === 'teacher';

    if (!isOwner && !isStaff) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (report.status === 'closed') {
      return res.status(400).json({ success: false, message: 'Cannot add messages to a closed report' });
    }

    report.messages.push({
      sender: req.user.id,
      senderName: req.user.fullName,
      senderRole: req.user.role,
      text: text.trim(),
    });

    // First staff reply: auto-activate + assign to this staff member
    if (isStaff && report.status === 'open') {
      report.status = 'active';
      if (!report.handledBy) report.handledBy = req.user.id;
    }

    await report.save();
    await report.populate(FULL_POPULATE);

    res.json({ success: true, data: report });
  } catch (err) {
    console.error('addMessage error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /api/mcq-reports/:id/assign ──────────────────────────────────────────
exports.assignReport = async (req, res) => {
  try {
    const report = await MCQReport.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    if (report.status === 'closed') {
      return res.status(400).json({ success: false, message: 'Cannot assign a closed report' });
    }

    report.handledBy = req.user.id;
    report.status = 'active';
    await report.save();

    // Full populate so frontend can display MCQ data after assign
    await report.populate(FULL_POPULATE);

    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /api/mcq-reports/:id/close ───────────────────────────────────────────
exports.closeReport = async (req, res) => {
  try {
    const report = await MCQReport.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

    const isOwner = report.reportedBy.toString() === req.user.id;
    const isStaff = req.user.role === 'admin' || req.user.role === 'teacher';

    if (!isOwner && !isStaff) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    report.status = 'closed';
    report.closedBy = req.user.id;
    report.closedAt = new Date();
    await report.save();

    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /api/mcq-reports/:id/feedback ────────────────────────────────────────
exports.submitFeedback = async (req, res) => {
  try {
    const { satisfied } = req.body;
    const report = await MCQReport.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

    if (report.reportedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the reporter can submit feedback' });
    }

    report.studentSatisfied = !!satisfied;
    await report.save();

    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
