const UserTestAttempt = require('../models/UserTestAttempt');
const SavedQuestion = require('../models/SavedQuestion');
const Test = require('../models/TestModel');
const MCQ = require('../models/McqModel');

/**
 * Start a new test attempt
 * @route POST /api/user-tests/start
 * @access Private
 */
exports.startTest = async (req, res) => {
  try {
    const { testId, mode } = req.body;
    
    if (!testId || !mode) {
      return res.status(400).json({
        success: false,
        message: 'Test ID and mode are required'
      });
    }
    
    // Validate mode
    if (mode !== 'tutor' && mode !== 'timer') {
      return res.status(400).json({
        success: false,
        message: 'Mode must be either tutor or timer'
      });
    }
    
    // Check if test exists
    //Below Can Comment
    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }
    
    // Check if test is published
    if (test.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Test is not published'
      });
    }
    
    // Check if there's an in-progress attempt for this test
    const existingAttempt = await UserTestAttempt.findOne({
      user: req.user.id,
      test: testId,
      status: 'in-progress'
    });
    
    if (existingAttempt) {
      // Return existing attempt
      return res.status(200).json({
        success: true,
        message: 'Found existing test attempt',
        data: existingAttempt
      });
    }
    
    // Get all MCQs for this test
    const mcqs = await MCQ.find({ testId });
    
    if (mcqs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Test has no questions'
      });
    }
    
    // Create a new attempt
    const questionAttempts = mcqs.map(mcq => ({
      mcqId: mcq._id,
      selectedOption: null,
      isCorrect: false,
      timeSpent: 0,
      reported: false,
      saved: false
    }));
    
    const newAttempt = await UserTestAttempt.create({
      user: req.user.id,
      test: testId,
      mode,
      startTime: new Date(),
      maxScore: mcqs.length,
      questionAttempts
    });
    
    res.status(201).json({
      success: true,
      message: 'Test attempt started successfully',
      data: newAttempt
    });
  } catch (error) {
    console.error('Error starting test:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

/**
 * Get test attempt details
 * @route GET /api/user-tests/:attemptId
 * @access Private
 */
exports.getTestAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;
    
    const attempt = await UserTestAttempt.findById(attemptId)
      .populate('test')
      .populate({
        path: 'questionAttempts.mcqId',
        model: 'MCQ'
      });
    
    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Test attempt not found'
      });
    }
    
    // Verify that this attempt belongs to the current user
    if (attempt.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this test attempt'
      });
    }
    
    res.status(200).json({
      success: true,
      data: attempt
    });
  } catch (error) {
    console.error('Error getting test attempt:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

/**
 * Submit answer for a question
 * @route PUT /api/user-tests/:attemptId/question/:questionIndex
 * @access Private
 */
exports.submitAnswer = async (req, res) => {
  try {
    const { attemptId, questionIndex } = req.params;
    const { selectedOption, timeSpent } = req.body;
    
    // Find the test attempt
    const attempt = await UserTestAttempt.findById(attemptId);
    
    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Test attempt not found'
      });
    }
    
    // Verify that this attempt belongs to the current user
    if (attempt.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this test attempt'
      });
    }
    
    // Check if test is still in progress
    if (attempt.status !== 'in-progress') {
      return res.status(400).json({
        success: false,
        message: 'Test attempt is not in progress'
      });
    }
    
    // Validate question index
    const questionIdx = parseInt(questionIndex);
    if (questionIdx < 0 || questionIdx >= attempt.questionAttempts.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid question index'
      });
    }
    
    // Validate selectedOption (can be null for skipped questions)
    if (selectedOption && !['A', 'B', 'C', 'D', 'E'].includes(selectedOption)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid option selected'
      });
    }
    
    // Get the MCQ to check if answer is correct
    const questionAttempt = attempt.questionAttempts[questionIdx];
    const mcq = await MCQ.findById(questionAttempt.mcqId);
    
    if (!mcq) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }
    
    // Find the correct option
    const correctOption = mcq.options.find(opt => opt.isCorrect);
    const isCorrect = selectedOption === correctOption?.optionLetter;
    
    // Update the question attempt
    attempt.questionAttempts[questionIdx].selectedOption = selectedOption;
    attempt.questionAttempts[questionIdx].isCorrect = isCorrect;
    attempt.questionAttempts[questionIdx].timeSpent = timeSpent || 0;
    
    // Update current question index if moving to next question
    attempt.currentQuestionIndex = questionIdx;
    
    // Update total time spent
    attempt.totalTimeSpent = attempt.questionAttempts.reduce(
      (total, q) => total + (q.timeSpent || 0),
      0
    );
    
    await attempt.save();
    
    res.status(200).json({
      success: true,
      message: 'Answer submitted successfully',
      data: {
        isCorrect,
        correctOption: correctOption?.optionLetter,
        explanation: mcq.explanationText,
        attempt: attempt
      }
    });
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

/**
 * Report a question in a test
 * @route PUT /api/user-tests/:attemptId/report/:questionIndex
 * @access Private
 */
exports.reportQuestion = async (req, res) => {
  try {
    const { attemptId, questionIndex } = req.params;
    const { reportReason } = req.body;
    
    // Find the test attempt
    const attempt = await UserTestAttempt.findById(attemptId);
    
    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Test attempt not found'
      });
    }
    
    // Verify that this attempt belongs to the current user
    if (attempt.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this test attempt'
      });
    }
    
    // Validate question index
    const questionIdx = parseInt(questionIndex);
    if (questionIdx < 0 || questionIdx >= attempt.questionAttempts.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid question index'
      });
    }
    
    // Update the question attempt with report
    attempt.questionAttempts[questionIdx].reported = true;
    attempt.questionAttempts[questionIdx].reportReason = reportReason || '';
    
    await attempt.save();
    
    res.status(200).json({
      success: true,
      message: 'Question reported successfully',
      data: attempt
    });
  } catch (error) {
    console.error('Error reporting question:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

/**
 * Save a question for later review
 * @route PUT /api/user-tests/:attemptId/save/:questionIndex
 * @access Private
 */
exports.saveQuestion = async (req, res) => {
  try {
    const { attemptId, questionIndex } = req.params;
    const { notes, taggedCategories } = req.body;
    
    // Find the test attempt
    const attempt = await UserTestAttempt.findById(attemptId);
    
    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Test attempt not found'
      });
    }
    
    // Verify that this attempt belongs to the current user
    if (attempt.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this test attempt'
      });
    }
    
    // Validate question index
    const questionIdx = parseInt(questionIndex);
    if (questionIdx < 0 || questionIdx >= attempt.questionAttempts.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid question index'
      });
    }
    
    // Get question details
    const questionAttempt = attempt.questionAttempts[questionIdx];
    const mcqId = questionAttempt.mcqId;
    
    // Mark as saved in the attempt
    attempt.questionAttempts[questionIdx].saved = true;
    await attempt.save();
    
    // Add to saved questions collection (or update if already exists)
    const savedQuestion = await SavedQuestion.findOneAndUpdate(
      { user: req.user.id, mcq: mcqId },
      {
        user: req.user.id,
        mcq: mcqId,
        notes: notes || '',
        taggedCategories: taggedCategories || [],
        testId: attempt.test
      },
      { upsert: true, new: true }
    );
    
    res.status(200).json({
      success: true,
      message: 'Question saved successfully',
      data: {
        attempt,
        savedQuestion
      }
    });
  } catch (error) {
    console.error('Error saving question:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

/**
 * Complete a test attempt
 * @route PUT /api/user-tests/:attemptId/complete
 * @access Private
 */
exports.completeTest = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { totalTimeSpent } = req.body;
    
    // Find the test attempt
    const attempt = await UserTestAttempt.findById(attemptId);
    
    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Test attempt not found'
      });
    }
    
    // Verify that this attempt belongs to the current user
    if (attempt.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this test attempt'
      });
    }
    
    // Check if test is still in progress
    if (attempt.status !== 'in-progress') {
      return res.status(400).json({
        success: false,
        message: 'Test attempt is not in progress'
      });
    }
    
    // Update test attempt status and end time
    attempt.status = 'completed';
    attempt.endTime = new Date();
    
    // Update total time spent if provided
    if (totalTimeSpent) {
      attempt.totalTimeSpent = totalTimeSpent;
    }
    
    await attempt.save();
    
    // Generate summary statistics
    const totalQuestions = attempt.questionAttempts.length;
    const answeredQuestions = attempt.questionAttempts.filter(q => q.selectedOption !== null).length;
    const correctAnswers = attempt.questionAttempts.filter(q => q.isCorrect).length;
    const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
    
    res.status(200).json({
      success: true,
      message: 'Test completed successfully',
      data: {
        attempt,
        summary: {
          totalQuestions,
          answeredQuestions,
          correctAnswers,
          accuracy,
          totalTimeSpent: attempt.totalTimeSpent,
          score: attempt.score,
          maxScore: attempt.maxScore,
          scorePercentage: attempt.scorePercentage
        }
      }
    });
  } catch (error) {
    console.error('Error completing test:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

/**
 * Get user test history
 * @route GET /api/user-tests/history
 * @access Private
 */
exports.getUserTestHistory = async (req, res) => {
  try {
    const attempts = await UserTestAttempt.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate('test', 'title subject topic unit');
    
    res.status(200).json({
      success: true,
      count: attempts.length,
      data: attempts
    });
  } catch (error) {
    console.error('Error getting test history:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

/**
 * Get saved questions
 * @route GET /api/user-tests/saved-questions
 * @access Private
 */
exports.getSavedQuestions = async (req, res) => {
  try {
    const savedQuestions = await SavedQuestion.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate('mcq')
      .populate('testId', 'title subject topic unit');
    
    res.status(200).json({
      success: true,
      count: savedQuestions.length,
      data: savedQuestions
    });
  } catch (error) {
    console.error('Error getting saved questions:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

/**
 * Remove a saved question
 * @route DELETE /api/user-tests/saved-questions/:savedQuestionId
 * @access Private
 */
exports.removeSavedQuestion = async (req, res) => {
  try {
    const { savedQuestionId } = req.params;
    
    const savedQuestion = await SavedQuestion.findById(savedQuestionId);
    
    if (!savedQuestion) {
      return res.status(404).json({
        success: false,
        message: 'Saved question not found'
      });
    }
    
    // Verify that this saved question belongs to the current user
    if (savedQuestion.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this saved question'
      });
    }
    
    await savedQuestion.deleteOne();
    
    res.status(200).json({
      success: true,
      message: 'Saved question removed successfully'
    });
  } catch (error) {
    console.error('Error removing saved question:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};  