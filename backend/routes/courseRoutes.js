const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { requireFeature, requireCourseAccess } = require('../middleware/featureGate');
const {
  getCourses,
  getCourse,
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

// ── Admin-only mutations ──────────────────────────────────────────────────
router.post(  '/',     authorize('admin'), createCourse);
router.put(   '/:id',  authorize('admin'), updateCourse);
router.delete('/:id',  authorize('admin'), deleteCourse);

module.exports = router;
