const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  startTest,
  getTestAttempt,
  getActiveAttempt,
  submitAnswer,
  reportQuestion,
  saveQuestion,
  toggleMarkForReview,
  pauseTest,
  completeTest,
  getUserTestHistory,
  getSavedQuestions,
  removeSavedQuestionByMcqId,
  removeSavedQuestion
} = require('../controllers/userTestController');

router.use(protect);

// Static routes MUST come before /:attemptId to avoid Express mismatching
router.get('/history', getUserTestHistory);
router.get('/active', getActiveAttempt);
router.get('/saved-questions', getSavedQuestions);
router.delete('/saved-questions/mcq/:mcqId', removeSavedQuestionByMcqId);
router.delete('/saved-questions/:savedQuestionId', removeSavedQuestion);

// Test attempt routes
router.post('/start', startTest);
router.get('/:attemptId', getTestAttempt);
router.put('/:attemptId/question/:questionIndex', submitAnswer);
router.put('/:attemptId/report/:questionIndex', reportQuestion);
router.put('/:attemptId/save/:questionIndex', saveQuestion);
router.put('/:attemptId/mark/:questionIndex', toggleMarkForReview);
router.put('/:attemptId/pause', pauseTest);
router.put('/:attemptId/complete', completeTest);

module.exports = router;
