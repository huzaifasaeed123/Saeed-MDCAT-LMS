const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { requireFeature, requireCourseAccess } = require('../middleware/featureGate');
const {
  getCourses,
  getCourse,
  getCourseProgress,
  markResourceComplete,
  unmarkResourceComplete,
  updateLastViewed,
  createCourse,
  updateCourse,
  deleteCourse,
  uploadFeatureImage,
  uploadPdf,
} = require('../controllers/courseController');

router.use(protect);

// Upload routes — must come BEFORE /:id to avoid param conflict
router.post('/upload/feature-image', authorize('admin'), uploadFeatureImage);
router.post('/upload/pdf', authorize('admin'), uploadPdf);

// ── Student endpoints — gated by feature access ────────────────────────────
// GET /          — list (needs 'courses' feature) — students see only the
//                  ones they have access to via the controller filter; admins
//                  see everything.
// GET /:id       — detail (needs 'courses' feature + per-course allowlist)
router.get('/',     requireFeature('courses'), getCourses);
router.get('/:id',  requireFeature('courses'), requireCourseAccess, getCourse);
// Per-user progress for a course — hot path (changes whenever the student
// finishes a test). Cheap: 1 indexed UserTestAttempt query, no Course read.
router.get('/:id/progress', requireFeature('courses'), requireCourseAccess, getCourseProgress);
// Manual completion toggle (videos / notes / external — tests are auto).
router.post  ('/:id/progress/resource/:resourceId', requireFeature('courses'), requireCourseAccess, markResourceComplete);
router.delete('/:id/progress/resource/:resourceId', requireFeature('courses'), requireCourseAccess, unmarkResourceComplete);
// Last-viewed pointer for "Continue Learning" (debounced from the player).
router.patch ('/:id/progress/last',                 requireFeature('courses'), requireCourseAccess, updateLastViewed);

// ── Admin-only mutations ──────────────────────────────────────────────────
router.post(  '/',     authorize('admin'), createCourse);
router.put(   '/:id',  authorize('admin'), updateCourse);
router.delete('/:id',  authorize('admin'), deleteCourse);

module.exports = router;
