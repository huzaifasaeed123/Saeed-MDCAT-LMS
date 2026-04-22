const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const {
  createReport,
  getMyReports,
  getAllReports,
  getAdminSummary,
  getTeacherStats,
  getTeacherOwnSummary,
  getReportsForMcq,
  getCountsByMcqs,
  addMessage,
  assignReport,
  closeReport,
  submitFeedback,
} = require('../controllers/mcqReportController');

// ── Static routes MUST come before /:id ──────────────────────────────────────
router.post('/', protect, createReport);
router.get('/my', protect, getMyReports);
router.get('/admin/summary', protect, authorize('admin'), getAdminSummary);
router.get('/admin/teacher-stats', protect, authorize('admin'), getTeacherStats);
router.get('/teacher/summary', protect, authorize('admin', 'teacher'), getTeacherOwnSummary);
router.get('/counts', protect, authorize('admin', 'teacher'), getCountsByMcqs);
router.get('/for-mcq/:mcqId', protect, authorize('admin', 'teacher'), getReportsForMcq);
router.get('/', protect, authorize('admin', 'teacher'), getAllReports);

// ── Dynamic routes ────────────────────────────────────────────────────────────
router.post('/:id/messages', protect, addMessage);
router.put('/:id/assign', protect, authorize('admin', 'teacher'), assignReport);
router.put('/:id/close', protect, closeReport);
router.put('/:id/feedback', protect, submitFeedback);

module.exports = router;
