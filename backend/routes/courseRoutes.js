const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
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

// CRUD routes
router.get('/', getCourses);
router.post('/', authorize('admin'), createCourse);
router.get('/:id', getCourse);
router.put('/:id', authorize('admin'), updateCourse);
router.delete('/:id', authorize('admin'), deleteCourse);

module.exports = router;
