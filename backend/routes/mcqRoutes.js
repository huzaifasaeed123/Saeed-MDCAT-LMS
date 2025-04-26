// File: routes/mcqRoutes.js

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { validateMCQ } = require('../utils/validation');
const {
  createMCQ,
  getMCQsForTest,
  getMCQ,
  updateMCQ,
  deleteMCQ,
  uploadDocument,
  getImportStatus,
} = require('../controllers/mcqController');
// All routes require authentication
router.use(protect);

// MCQ routes with validation
router.post('/', authorize('admin', 'teacher'), validateMCQ, createMCQ);
router.get('/test/:testId', getMCQsForTest);
router.get('/:id', getMCQ);
router.put('/:id', authorize('admin', 'teacher'), validateMCQ, updateMCQ);
router.delete('/:id', authorize('admin', 'teacher'), deleteMCQ);


// Only admins and teachers can import MCQs
router.post('/import-document', authorize('admin', 'teacher'), uploadDocument);
router.get('/import-status/:importId', authorize('admin', 'teacher'), getImportStatus);
module.exports = router;