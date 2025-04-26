const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  startTest,
  getTestAttempt,
  submitAnswer,
  reportQuestion,
  saveQuestion,
  completeTest,
  getUserTestHistory,
  getSavedQuestions,
  removeSavedQuestion
} = require('../controllers/userTestController');

// Apply auth middleware to all routes
router.use(protect);

// Test attempt routes
router.post('/start', startTest);
router.get('/:attemptId', getTestAttempt);
router.put('/:attemptId/question/:questionIndex', submitAnswer);
router.put('/:attemptId/report/:questionIndex', reportQuestion);
router.put('/:attemptId/save/:questionIndex', saveQuestion);
router.put('/:attemptId/complete', completeTest);
router.get('/history', getUserTestHistory);

// Saved questions routes
router.get('/saved-questions', getSavedQuestions);
router.delete('/saved-questions/:savedQuestionId', removeSavedQuestion);

module.exports = router;