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

// Slimmer populate used for LIST endpoints — drops `closedBy` and
// `messages.sender` because:
//   • Lists never render closedBy (only the detail header could, and it
//     doesn't right now).
//   • Each message already carries `senderName` and `senderRole` denormalised
//     at write-time (see addMessage), so the populate is redundant.
// Net: 2 fewer round trips per list response.
const LIST_POPULATE = [
  { path: 'mcq', select: MCQ_POPULATE },
  { path: 'reportedBy', select: 'fullName email role' },
  { path: 'handledBy', select: 'fullName role' },
];

// Parse the `status` query param. Accepts:
//   undefined / ''  → no filter
//   'all'           → no filter
//   'open'          → status: 'open'
//   'open,active'   → status: { $in: ['open', 'active'] }
// Returns an object you spread into the Mongo filter (so {} when no filter).
const parseStatusParam = (raw) => {
  if (!raw || raw === 'all') return {};
  const parts = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { status: parts[0] };
  return { status: { $in: parts } };
};

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
// Student's own reports.
//
// Optimised response shape:
//   • Page 1 → single $facet aggregation returns list + stats + filterOptions
//             in ONE round trip. Then 3 batched populates for the visible rows.
//             Net: 4 trips (was 9).
//   • Page 2+ → just find + populates. No stats / filterOptions / count.
//             Net: 4 trips (was 9).
//   • countDocuments dropped — pagination is hasMore-driven (fetch limit+1,
//     trim if oversize, set hasMore flag).
exports.getMyReports = async (req, res) => {
  try {
    const { subject, chapter, topic, questionBank, satisfied, page = 1 } = req.query;
    const limit = 20;
    const pageNum = parseInt(page) || 1;
    const skip = (pageNum - 1) * limit;
    const isFirstPage = pageNum === 1;
    const uid = new mongoose.Types.ObjectId(req.user.id);

    const filter = { reportedBy: uid, ...parseStatusParam(req.query.status) };
    if (subject)      filter.mcqSubject      = subject;
    if (chapter)      filter.mcqChapter      = chapter;
    if (topic)        filter.mcqTopic        = topic;
    if (questionBank) filter.mcqQuestionBank = questionBank;
    if (satisfied === 'true')  filter.studentSatisfied = true;
    if (satisfied === 'false') filter.studentSatisfied = false;

    if (isFirstPage) {
      // ── One trip: list + stats + filterOptions via $facet ────────────────
      const [aggResult] = await MCQReport.aggregate([
        { $facet: {
          // The actual page slice. We fetch limit+1 so we can derive hasMore.
          list: [
            { $match: filter },
            { $sort: { createdAt: -1 } },
            { $limit: limit + 1 },
          ],
          // Status + feedback breakdown across ALL of the user's reports
          // (no extra filters). Powers the KPI tiles. We compute every
          // counter inside ONE $group via $sum-conditionals so this branch
          // makes a single pass over the same docs — zero extra DB cost
          // versus the prior status-only breakdown.
          stats: [
            { $match: { reportedBy: uid } },
            { $group: {
              _id: null,
              total:        { $sum: 1 },
              open:         { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
              active:       { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
              closed:       { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
              satisfied:    { $sum: { $cond: [{ $eq: ['$studentSatisfied', true] }, 1, 0] } },
              notSatisfied: { $sum: { $cond: [{ $eq: ['$studentSatisfied', false] }, 1, 0] } },
            }},
          ],
          // Distinct filter option values across the visible scope.
          // $addToSet inside $group dedupes server-side; no second pass.
          filters: [
            { $match: { reportedBy: uid } },
            { $group: {
              _id: null,
              subjects: { $addToSet: '$mcqSubject' },
              chapters: { $addToSet: '$mcqChapter' },
              topics:   { $addToSet: '$mcqTopic' },
              qbs:      { $addToSet: '$mcqQuestionBank' },
            }},
          ],
        }},
      ]);

      let listDocs = aggResult.list || [];
      const hasMore = listDocs.length > limit;
      if (hasMore) listDocs = listDocs.slice(0, limit);

      // Hydrate references on just the page rows. Aggregation returns plain
      // docs, so Model.populate is the explicit form.
      await MCQReport.populate(listDocs, LIST_POPULATE);

      // stats branch is now a single $group({ _id: null }) doc.
      const statsDoc = (aggResult.stats && aggResult.stats[0]) || {};
      const stats = {
        total:        statsDoc.total        || 0,
        open:         statsDoc.open         || 0,
        active:       statsDoc.active       || 0,
        closed:       statsDoc.closed       || 0,
        satisfied:    statsDoc.satisfied    || 0,
        notSatisfied: statsDoc.notSatisfied || 0,
      };

      const filtersDoc = (aggResult.filters && aggResult.filters[0]) || {};
      const sortedDistinct = (arr) =>
        [...new Set((arr || []).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      const filterOptions = {
        subjects:      sortedDistinct(filtersDoc.subjects),
        chapters:      sortedDistinct(filtersDoc.chapters),
        topics:        sortedDistinct(filtersDoc.topics),
        questionBanks: sortedDistinct(filtersDoc.qbs),
      };

      return res.json({
        success: true,
        data: listDocs,
        page: pageNum,
        hasMore,
        stats,
        filterOptions,
      });
    }

    // ── Pages 2+ — plain find + populates only ────────────────────────────
    const docs = await MCQReport.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1)
      .populate(LIST_POPULATE);

    const hasMore = docs.length > limit;
    return res.json({
      success: true,
      data: hasMore ? docs.slice(0, limit) : docs,
      page: pageNum,
      hasMore,
    });
  } catch (err) {
    console.error('getMyReports error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/mcq-reports ─────────────────────────────────────────────────────
// Teacher: sees open reports + reports they handle
// Admin: sees everything
//
// Optimised the same way as getMyReports:
//   • Page 1 → one $facet aggregation (list + filterOptions) + populates
//   • Page 2+ → just find + populates
//   • hasMore pagination (no countDocuments)
//
// Teacher visibility rules are preserved exactly:
//   • Base scope: status='open' OR handledBy=me
//   • status=open       → only unassigned-open queue
//   • status=open,active→ open OR (active assigned to me)
//   • status=closed     → only my own closed
//   • status=active     → only my own active (already covered by base scope)
exports.getAllReports = async (req, res) => {
  try {
    const { subject, chapter, topic, questionBank, satisfied, handledBy, page = 1 } = req.query;
    const limit = 20;
    const pageNum = parseInt(page) || 1;
    const skip = (pageNum - 1) * limit;
    const isFirstPage = pageNum === 1;
    const isAdmin = req.user.role === 'admin';
    const myId = req.user.id;

    // Parsed status — may be empty {}, or { status: 'x' }, or { status: { $in: [...] } }.
    const statusFilter = parseStatusParam(req.query.status);
    const statusList = statusFilter.status
      ? (Array.isArray(statusFilter.status?.$in) ? statusFilter.status.$in : [statusFilter.status])
      : [];

    // Visible scope (admin = all; teacher = open + own).
    const visibleScope = isAdmin ? {} : { $or: [{ status: 'open' }, { handledBy: myId }] };

    const filter = { ...visibleScope };

    if (!isAdmin && statusList.length > 0) {
      const wantsOpen = statusList.includes('open');
      const wantsActive = statusList.includes('active');
      const wantsClosed = statusList.includes('closed');

      if (wantsOpen && !wantsActive && !wantsClosed) {
        // Open only — the unassigned queue.
        filter.$or = [{ status: 'open' }];
      } else if (wantsOpen && wantsActive && !wantsClosed) {
        // Open + my active.
        filter.$or = [{ status: 'open' }, { handledBy: myId, status: 'active' }];
      } else {
        // Any combination that includes closed (or active-only) is scoped
        // to "things I've handled", since teachers can't see other people's
        // active/closed reports.
        delete filter.$or;
        filter.handledBy = myId;
        filter.status = statusList.length === 1 ? statusList[0] : { $in: statusList };
      }
    } else if (isAdmin && statusList.length > 0) {
      filter.status = statusList.length === 1 ? statusList[0] : { $in: statusList };
    }

    if (subject)      filter.mcqSubject      = subject;
    if (chapter)      filter.mcqChapter      = chapter;
    if (topic)        filter.mcqTopic        = topic;
    if (questionBank) filter.mcqQuestionBank = questionBank;
    if (satisfied === 'true')  filter.studentSatisfied = true;
    if (satisfied === 'false') filter.studentSatisfied = false;
    if (handledBy && isAdmin) {
      try { filter.handledBy = new mongoose.Types.ObjectId(handledBy); } catch { /* ignore */ }
    }

    if (isFirstPage) {
      const [aggResult] = await MCQReport.aggregate([
        { $facet: {
          list: [
            { $match: filter },
            { $sort: { updatedAt: -1 } },
            { $limit: limit + 1 },
          ],
          filters: [
            { $match: visibleScope },
            { $group: {
              _id: null,
              subjects: { $addToSet: '$mcqSubject' },
              chapters: { $addToSet: '$mcqChapter' },
              topics:   { $addToSet: '$mcqTopic' },
              qbs:      { $addToSet: '$mcqQuestionBank' },
            }},
          ],
        }},
      ]);

      let listDocs = aggResult.list || [];
      const hasMore = listDocs.length > limit;
      if (hasMore) listDocs = listDocs.slice(0, limit);

      await MCQReport.populate(listDocs, LIST_POPULATE);

      const filtersDoc = (aggResult.filters && aggResult.filters[0]) || {};
      const sortedDistinct = (arr) =>
        [...new Set((arr || []).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      const filterOptions = {
        subjects:      sortedDistinct(filtersDoc.subjects),
        chapters:      sortedDistinct(filtersDoc.chapters),
        topics:        sortedDistinct(filtersDoc.topics),
        questionBanks: sortedDistinct(filtersDoc.qbs),
      };

      return res.json({
        success: true,
        data: listDocs,
        page: pageNum,
        hasMore,
        filterOptions,
      });
    }

    const docs = await MCQReport.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit + 1)
      .populate(LIST_POPULATE);

    const hasMore = docs.length > limit;
    return res.json({
      success: true,
      data: hasMore ? docs.slice(0, limit) : docs,
      page: pageNum,
      hasMore,
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
