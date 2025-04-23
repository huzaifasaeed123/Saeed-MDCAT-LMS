// Place this file in: routes/mcqRoutes.js

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const {
  createMCQ,
  getMCQsForTest,
  getMCQ,
  updateMCQ,
  deleteMCQ
} = require('../controllers/mcqController');

// All routes require authentication
router.use(protect);

// MCQ routes
router.post('/', authorize('admin', 'teacher'), createMCQ);
router.get('/test/:testId', getMCQsForTest);
router.get('/:id', getMCQ);
router.put('/:id', authorize('admin', 'teacher'), updateMCQ);
router.delete('/:id', authorize('admin', 'teacher'), deleteMCQ);

module.exports = router;