const express = require('express');
const router  = express.Router();
const { protect }   = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const {
  getQuestionBanks,
  getQuestionBank,
  createQuestionBank,
  updateQuestionBank,
  deleteQuestionBank,
  getMcqCount,
  getUserMcqCounts,
  generateTest,
} = require('../controllers/questionBankController');

router.use(protect);

// Auto-test generation (POST before /:id to avoid param conflict)
router.post('/generate-test', generateTest); // all authenticated users (students create practice tests)

// MCQ count endpoints for a QB
router.get('/:id/mcq-count', getMcqCount);
router.get('/:id/user-mcq-counts', getUserMcqCounts); // per-mode breakdown for current user

// QB CRUD
router.get('/',     getQuestionBanks);
router.post('/',    authorize('admin'), createQuestionBank);
router.get('/:id',  getQuestionBank);
router.put('/:id',  authorize('admin'), updateQuestionBank);
router.delete('/:id', authorize('admin'), deleteQuestionBank);

module.exports = router;
