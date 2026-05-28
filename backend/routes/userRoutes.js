const express  = require('express');
const multer   = require('multer');
const { check } = require('express-validator');
const {
  getUsers, getUser, createUser, updateUser, deleteUser,
  updateProfile, bulkUploadUsers,
} = require('../controllers/userController');

const {
  updateFeatureAccess,
  replaceCourseAccess,
  grantCourse, revokeCourse,
  grantAllCourses, revokeAllCourses,
  bulkApplyAccess,
  bulkGrantCourseAccess,
} = require('../controllers/userAccessController');

const { protect }   = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

const router = express.Router();

// Multer — store Excel in memory (no disk write needed, just parse the buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx and .xls files are allowed'));
    }
  },
});

const userValidation = [
  check('fullName',      'Full name is required').not().isEmpty(),
  check('email',         'Please include a valid email').isEmail(),
  check('contactNumber', 'Please include a valid contact number').matches(/^\+?[0-9]{10,14}$/),
  check('password',      'Password must be at least 6 characters').isLength({ min: 6 }),
  check('role',          'Role must be student, teacher, or admin').isIn(['student', 'teacher', 'admin']),
];

// Update validation — every field optional, but if provided must be valid.
// `optional({ checkFalsy: true })` lets the client omit a field OR send an empty
// string without tripping validation (handy for partial PUTs from forms).
const userUpdateValidation = [
  check('fullName').optional({ checkFalsy: true }).notEmpty().withMessage('Full name cannot be empty'),
  check('email').optional({ checkFalsy: true }).isEmail().withMessage('Please include a valid email'),
  check('contactNumber').optional({ checkFalsy: true }).matches(/^\+?[0-9]{10,14}$/).withMessage('Please include a valid contact number'),
  check('password').optional({ checkFalsy: true }).isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  check('role').optional({ checkFalsy: true }).isIn(['student', 'teacher', 'admin']).withMessage('Role must be student, teacher, or admin'),
];

// Self-update (must be before protect.use so it doesn't require admin)
router.put('/profile', protect, updateProfile);

router.use(protect);

// Bulk upload — admin only
router.post('/bulk-upload', authorize('admin'), upload.single('file'), bulkUploadUsers);

// CRUD
router.route('/')
  .get(authorize('admin'), getUsers)
  .post(authorize('admin'), userValidation, createUser);

// ── Bulk access (admin only) — MUST be before /:id routes ──────────────────
// PATCH /access/bulk          body: { feature, value, role? }
// PATCH /course-access/bulk   body: { courseIds, value, role?, filters? }
router.patch('/access/bulk',        authorize('admin'), bulkApplyAccess);
router.patch('/course-access/bulk', authorize('admin'), bulkGrantCourseAccess);

router.route('/:id')
  .get(authorize('admin'), getUser)
  .put(authorize('admin'), userUpdateValidation, updateUser)
  .delete(authorize('admin'), deleteUser);

// ── Per-user access management (admin only) ────────────────────────────────
// PATCH /:id/access        — set one or more feature flags (partial update)
//                           — body may also include coursesGrantAll (boolean)
// PUT   /:id/course-access — replace the entire courseAccess array
// POST  /:id/course-access/grant-all  | revoke-all
// POST  /:id/course-access/:courseId  — grant a single course
// DELETE /:id/course-access/:courseId — revoke a single course
router.patch('/:id/access',                          authorize('admin'), updateFeatureAccess);
router.put(  '/:id/course-access',                   authorize('admin'), replaceCourseAccess);
router.post( '/:id/course-access/grant-all',         authorize('admin'), grantAllCourses);
router.post( '/:id/course-access/revoke-all',        authorize('admin'), revokeAllCourses);
router.post(  '/:id/course-access/:courseId',        authorize('admin'), grantCourse);
router.delete('/:id/course-access/:courseId',        authorize('admin'), revokeCourse);

module.exports = router;
