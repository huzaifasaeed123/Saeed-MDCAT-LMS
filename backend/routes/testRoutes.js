// Place this file in: routes/testRoutes.js

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const {
  createTest,
  getTests,
  getTest,
  updateTest,
  deleteTest,
  publishTest,
  addMcqsToTest,
  getTestStats,
  exportTestStats,
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
router.post('/:id/add-mcqs', authorize('admin', 'teacher'), addMcqsToTest);

// Admin/teacher analytics — cold paths, no impact on student hot APIs.
router.get('/:id/stats',         authorize('admin', 'teacher'), getTestStats);
router.get('/:id/stats/export',  authorize('admin', 'teacher'), exportTestStats);

module.exports = router;