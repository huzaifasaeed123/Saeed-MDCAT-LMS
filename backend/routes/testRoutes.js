// Place this file in: routes/testRoutes.js

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createTest,
  getTests,
  getTest,
  updateTest,
  deleteTest,
  publishTest
} = require('../controllers/testController');

// All routes require authentication
router.use(protect);

// Test routes
router.post('/', authorize('admin', 'teacher'), createTest);
router.get('/', getTests);
router.get('/:id', getTest);
router.put('/:id', authorize('admin', 'teacher'), updateTest);
router.delete('/:id', authorize('admin', 'teacher'), deleteTest);
router.put('/:id/publish', authorize('admin', 'teacher'), publishTest);

module.exports = router;