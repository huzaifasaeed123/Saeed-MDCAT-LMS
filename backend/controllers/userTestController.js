const mongoose = require('mongoose');
const UserTestAttempt = require('../models/UserTestAttempt');
const UserMcqHistory  = require('../models/UserMcqHistory');
const SavedQuestion = require('../models/SavedQuestion');
const Test = require('../models/TestModel');
const MCQ = require('../models/McqModel');
const MCQReport = require('../models/MCQReport');


/**
 * Build bulkWrite ops for one attempt — used by both updateUserMcqHistory and backfill.
 * Uses $set + $inc + $setOnInsert (no pipeline syntax) for broad MongoDB compatibility.
 * markedForReview/saved are sticky: once true they are never reverted to false.
 */
const _buildHistoryOps = (userId, questionAttempts, mcqMap, now) => {
  const ops = [];
  for (const qa of questionAttempts) {
    const mcq = mcqMap[qa.mcqId?.toString()];
    if (!mcq?.questionBankId) continue;

    const lastResult = !qa.selectedOption ? 'omitted' : qa.isCorrect ? 'correct' : 'incorrect';
    const isMarked   = !!qa.markedForReview;
    const isSaved    = !!qa.saved;

    const setFields = {
      questionBankId:  mcq.questionBankId,
      qbSubjectId:     mcq.qbSubjectId  || null,
      qbChapterId:     mcq.qbChapterId  || null,
      qbTopicId:       mcq.qbTopicId    || null,
      lastResult,
      lastAttemptedAt: now,
    };
    // Only write sticky flags when true — $setOnInsert initialises them to false on new docs
    if (isMarked) setFields.markedForReview = true;
    if (isSaved)  setFields.saved           = true;

    const setOnInsert = {};
    if (!isMarked) setOnInsert.markedForReview = false;
    if (!isSaved)  setOnInsert.saved           = false;

    const update = {
      $set: setFields,
      $inc: {
        totalAttempts:  1,
        correctCount:   lastResult === 'correct'   ? 1 : 0,
        incorrectCount: lastResult === 'incorrect' ? 1 : 0,
        omittedCount:   lastResult === 'omitted'   ? 1 : 0,
      },
    };
    if (Object.keys(setOnInsert).length > 0) update.$setOnInsert = setOnInsert;

    ops.push({
      updateOne: {
        filter: { user: userId, mcq: qa.mcqId },
        update,
        upsert: true,
      },
    });
  }
  return ops;
};

/** Fire-and-forget after completeTest — tracks result for each MCQ in this attempt. */
const updateUserMcqHistory = async (attempt) => {
  try {
    const mcqIds = attempt.questionAttempts.map((qa) => qa.mcqId).filter(Boolean);
    if (mcqIds.length === 0) {
      console.warn('[MCQHistory] No mcqIds found in attempt');
      return;
    }

    // Fetch MCQ classification; only fetch test QB if some MCQs need the fallback
    const mcqs = await MCQ.find({ _id: { $in: mcqIds } })
      .select('_id questionBankId qbSubjectId qbChapterId qbTopicId')
      .lean();

    const needsFallback = mcqs.some((m) => !m.questionBankId);
    const fallbackQbId  = needsFallback
      ? (await Test.findById(attempt.test).select('questionBankId').lean())?.questionBankId || null
      : null;

    // Patch each MCQ entry — if MCQ lacks questionBankId, use the test's QB
    const mcqMap = {};
    for (const m of mcqs) {
      mcqMap[m._id.toString()] = {
        ...m,
        questionBankId: m.questionBankId || fallbackQbId,
      };
    }

    const ops = _buildHistoryOps(attempt.user, attempt.questionAttempts, mcqMap, new Date());
    if (ops.length > 0) {
      await UserMcqHistory.bulkWrite(ops, { ordered: false });
      console.log(`[MCQHistory] Updated ${ops.length} records for user ${attempt.user}`);
    } else {
      console.warn(`[MCQHistory] No ops — no questionBankId available (attemptId: ${attempt._id})`);
    }
  } catch (err) {
    console.error('[MCQHistory] updateUserMcqHistory error:', err);
  }
};

/**
 * Backfill UserMcqHistory from ALL past completed attempts for a user.
 * Uses pure $set (idempotent) — safe to run multiple times.
 * Processes oldest→newest so lastResult/lastAttemptedAt reflect the most recent attempt.
 * Falls back to the test's questionBankId when the MCQ document lacks one (legacy data).
 */
const backfillUserMcqHistory = async (userId) => {
  try {
    const attempts = await UserTestAttempt.find({ user: userId, status: 'completed' })
      .sort({ createdAt: 1 })
      .select('createdAt test questionAttempts.mcqId questionAttempts.selectedOption questionAttempts.isCorrect questionAttempts.markedForReview questionAttempts.saved')
      .lean();

    if (attempts.length === 0) return;

    // Build a map of test → questionBankId so MCQs without their own QB can fall back to it
    const testIds = [...new Set(attempts.map((a) => a.test?.toString()).filter(Boolean))];
    const testDocs = await Test.find({ _id: { $in: testIds } }).select('_id questionBankId').lean();
    const testQbMap = {};
    for (const t of testDocs) {
      if (t.questionBankId) testQbMap[t._id.toString()] = t.questionBankId;
    }

    // Aggregate final per-MCQ stats across all past attempts
    const statsMap = {}; // mcqId.toString() → accumulated stats + fallback QB
    for (const attempt of attempts) {
      const ts         = attempt.createdAt ? new Date(attempt.createdAt) : new Date();
      const testQbId   = testQbMap[attempt.test?.toString()] || null;
      for (const qa of attempt.questionAttempts) {
        if (!qa.mcqId) continue;
        const key = qa.mcqId.toString();
        if (!statsMap[key]) {
          statsMap[key] = {
            mcqId: qa.mcqId,
            testQbId,   // fallback — used if MCQ.questionBankId is null
            totalAttempts: 0, correctCount: 0, incorrectCount: 0, omittedCount: 0,
            lastResult: 'omitted', lastAttemptedAt: ts,
            markedForReview: false, saved: false,
          };
        }
        const s   = statsMap[key];
        const res = !qa.selectedOption ? 'omitted' : qa.isCorrect ? 'correct' : 'incorrect';
        s.totalAttempts++;
        if (res === 'correct')   s.correctCount++;
        if (res === 'incorrect') s.incorrectCount++;
        if (res === 'omitted')   s.omittedCount++;
        s.lastResult        = res;
        s.lastAttemptedAt   = ts;
        if (qa.markedForReview) s.markedForReview = true;
        if (qa.saved)           s.saved           = true;
      }
    }

    // Fetch QB classification from MCQ documents
    const allIds = Object.values(statsMap).map((s) => s.mcqId);
    const mcqs   = await MCQ.find({ _id: { $in: allIds } })
      .select('_id questionBankId qbSubjectId qbChapterId qbTopicId')
      .lean();
    const mcqMap = {};
    for (const m of mcqs) mcqMap[m._id.toString()] = m;

    let written = 0, skipped = 0;
    const bulkOps = [];
    for (const [key, s] of Object.entries(statsMap)) {
      const mcq  = mcqMap[key];
      const qbId = mcq?.questionBankId || s.testQbId || null;
      if (!qbId) { skipped++; continue; }

      written++;
      bulkOps.push({
        updateOne: {
          filter: { user: userId, mcq: s.mcqId },
          update: {
            $set: {
              user:            userId,
              mcq:             s.mcqId,
              questionBankId:  qbId,
              qbSubjectId:     mcq?.qbSubjectId  || null,
              qbChapterId:     mcq?.qbChapterId  || null,
              qbTopicId:       mcq?.qbTopicId    || null,
              lastResult:      s.lastResult,
              lastAttemptedAt: s.lastAttemptedAt,
              totalAttempts:   s.totalAttempts,
              correctCount:    s.correctCount,
              incorrectCount:  s.incorrectCount,
              omittedCount:    s.omittedCount,
              markedForReview: s.markedForReview,
              saved:           s.saved,
            },
          },
          upsert: true,
        },
      });

      if (bulkOps.length >= 500) {
        await UserMcqHistory.bulkWrite(bulkOps.splice(0), { ordered: false });
      }
    }
    if (bulkOps.length > 0) {
      await UserMcqHistory.bulkWrite(bulkOps, { ordered: false });
    }
    console.log(`[MCQHistory] Backfill complete for user ${userId}: written=${written}, skipped=${skipped}, total=${Object.keys(statsMap).length} MCQs from ${attempts.length} attempts`);
  } catch (err) {
    console.error('[MCQHistory] backfillUserMcqHistory error:', err);
  }
};

exports.backfillUserMcqHistory = backfillUserMcqHistory;

/**
 * Fire-and-forget after completeTest — increments per-option selection counts on each MCQ.
 * Stores: statistics.optionsSelections.A/B/C/D/E (pick counts) + .total (all attempts incl. omitted).
 */
const updateMcqOptionStats = async (attempt) => {
  try {
    const ops = [];
    for (const qa of attempt.questionAttempts) {
      if (!qa.mcqId) continue;
      const inc = { 'statistics.optionsSelections.total': 1 };
      if (qa.selectedOption) {
        inc[`statistics.optionsSelections.${qa.selectedOption}`] = 1;
      }
      ops.push({
        updateOne: {
          filter: { _id: qa.mcqId },
          update: { $inc: inc },
        },
      });
    }
    if (ops.length > 0) {
      await MCQ.bulkWrite(ops, { ordered: false });
    }
  } catch (err) {
    console.error('[MCQStats] updateMcqOptionStats error:', err);
  }
};

/**
 * Start a new test attempt
 * @route POST /api/user-tests/start
 * @access Private
 */
exports.startTest = async (req, res) => {
  try {
    const { testId, mode, totalDurationSec } = req.body;

    if (!testId || !mode) {
      return res.status(400).json({ success: false, message: 'Test ID and mode are required' });
    }
    if (mode !== 'tutor' && mode !== 'timer') {
      return res.status(400).json({ success: false, message: 'Mode must be either tutor or timer' });
    }

    // Single fetch — populate mcqs to avoid a second Test.findById call
    const test = await Test.findById(testId).populate('mcqs');
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }
    if (test.status !== 'published' && test.createdBy?.toString() !== req.user.id) {
      return res.status(400).json({ success: false, message: 'Test is not published' });
    }

    // Resume existing in-progress attempt
    const existingAttempt = await UserTestAttempt.findOne({
      user: req.user.id,
      test: testId,
      status: 'in-progress',
    });
    if (existingAttempt) {
      const populated = await UserTestAttempt.findById(existingAttempt._id)
        .populate('test')
        .populate({ path: 'questionAttempts.mcqId', model: 'MCQ' });
      return res.status(200).json({
        success: true,
        message: 'Found existing test attempt',
        data: populated,
      });
    }

    // Fall back to legacy testId-field MCQs if test.mcqs is empty
    const mcqs = test.mcqs?.length > 0 ? test.mcqs : await MCQ.find({ testId });

    if (mcqs.length === 0) {
      return res.status(400).json({ success: false, message: 'Test has no questions' });
    }

    // Embed correctOption in each questionAttempt so frontend can validate locally
    const questionAttempts = mcqs.map((mcq) => {
      const correct = mcq.options?.find((o) => o.isCorrect);
      return {
        mcqId:           mcq._id,
        correctOption:   correct?.optionLetter ?? null,
        selectedOption:  null,
        isCorrect:       false,
        reported:        false,
        saved:           false,
        markedForReview: false,
      };
    });

    const newAttempt = await UserTestAttempt.create({
      user:             req.user.id,
      test:             testId,
      mode,
      startTime:        new Date(),
      maxScore:         mcqs.length,
      questionAttempts,
      totalDurationSec: totalDurationSec || null,
    });

    const populatedAttempt = await UserTestAttempt.findById(newAttempt._id)
      .populate('test')
      .populate({ path: 'questionAttempts.mcqId', model: 'MCQ' });

    res.status(201).json({
      success: true,
      message: 'Test attempt started successfully',
      data: populatedAttempt,
    });
  } catch (error) {
    console.error('Error starting test:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Get the active (in-progress) attempt for a specific test — lightweight, no MCQ population.
 * Used by TestStartPage to check for an unfinished attempt without fetching full history.
 * @route GET /api/user-tests/active?testId=xxx
 * @access Private
 */
exports.getActiveAttempt = async (req, res) => {
  try {
    const { testId } = req.query;
    if (!testId) return res.status(400).json({ success: false, message: 'testId query param required' });

    const attempt = await UserTestAttempt.findOne({
      user:   req.user.id,
      test:   testId,
      status: 'in-progress',
    }).select('_id mode status questionAttempts startTime').lean();

    if (!attempt) return res.json({ success: true, data: null });

    const answeredCount = attempt.questionAttempts.filter((qa) => qa.selectedOption).length;
    const totalCount    = attempt.questionAttempts.length;

    res.json({
      success: true,
      data: {
        _id:          attempt._id,
        mode:         attempt.mode,
        status:       attempt.status,
        startTime:    attempt.startTime,
        answeredCount,
        totalCount,
      },
    });
  } catch (error) {
    console.error('getActiveAttempt error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
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
      .populate({ path: 'questionAttempts.mcqId', model: 'MCQ' });

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Test attempt not found' });
    }
    if (attempt.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this test attempt' });
    }

    res.status(200).json({ success: true, data: attempt });
  } catch (error) {
    console.error('Error getting test attempt:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Submit answer for a single question (kept for backward compatibility)
 * The new flow sends all answers in a single completeTest call instead.
 * @route PUT /api/user-tests/:attemptId/question/:questionIndex
 * @access Private
 */
exports.submitAnswer = async (req, res) => {
  try {
    const { attemptId, questionIndex } = req.params;
    const { selectedOption } = req.body;

    const attempt = await UserTestAttempt.findById(attemptId);
    if (!attempt) return res.status(404).json({ success: false, message: 'Test attempt not found' });
    if (attempt.user.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });
    if (attempt.status !== 'in-progress') return res.status(400).json({ success: false, message: 'Test attempt is not in progress' });

    const questionIdx = parseInt(questionIndex);
    if (questionIdx < 0 || questionIdx >= attempt.questionAttempts.length) {
      return res.status(400).json({ success: false, message: 'Invalid question index' });
    }
    if (selectedOption && !['A', 'B', 'C', 'D', 'E'].includes(selectedOption)) {
      return res.status(400).json({ success: false, message: 'Invalid option selected' });
    }

    const qa = attempt.questionAttempts[questionIdx];

    // Use stored correctOption; fall back to MCQ lookup for legacy attempts
    let correctOptionLetter = qa.correctOption;
    let explanation = '';
    if (!correctOptionLetter) {
      const mcq = await MCQ.findById(qa.mcqId);
      if (!mcq) return res.status(404).json({ success: false, message: 'Question not found' });
      correctOptionLetter = mcq.options.find((opt) => opt.isCorrect)?.optionLetter;
      explanation = mcq.explanationText || '';
    }

    const isCorrect = selectedOption === correctOptionLetter;
    qa.selectedOption = selectedOption;
    qa.isCorrect = isCorrect;
    attempt.currentQuestionIndex = questionIdx;

    // Compute score inline (no pre-save hook)
    const correct = attempt.questionAttempts.filter((q) => q.isCorrect).length;
    attempt.score = correct;
    attempt.maxScore = attempt.questionAttempts.length;
    attempt.scorePercentage = attempt.maxScore > 0 ? (correct / attempt.maxScore) * 100 : 0;

    await attempt.save();

    res.status(200).json({
      success: true,
      message: 'Answer submitted successfully',
      data: { isCorrect, correctOption: correctOptionLetter, explanation, attempt },
    });
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
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

    const attempt = await UserTestAttempt.findById(attemptId);
    if (!attempt) return res.status(404).json({ success: false, message: 'Test attempt not found' });
    if (attempt.user.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });

    const questionIdx = parseInt(questionIndex);
    if (questionIdx < 0 || questionIdx >= attempt.questionAttempts.length) {
      return res.status(400).json({ success: false, message: 'Invalid question index' });
    }

    attempt.questionAttempts[questionIdx].reported = true;
    attempt.questionAttempts[questionIdx].reportReason = reportReason || '';
    await attempt.save();

    try {
      const mcqId = attempt.questionAttempts[questionIdx].mcqId;
      const existing = await MCQReport.findOne({
        mcq: mcqId,
        reportedBy: req.user.id,
        status: { $in: ['open', 'active'] },
      });
      if (!existing && mcqId) {
        const mcq = await MCQ.findById(mcqId);
        await MCQReport.create({
          mcq: mcqId,
          test: attempt.test,
          attempt: attempt._id,
          reportedBy: req.user.id,
          reason: reportReason || 'Question Statement Wrong',
          mcqSubject: mcq?.subject || '',
          mcqChapter: mcq?.unit || '',
          mcqTopic: mcq?.topic || '',
        });
      }
    } catch (_) { /* MCQReport creation is non-blocking */ }

    res.status(200).json({ success: true, message: 'Question reported successfully', data: attempt });
  } catch (error) {
    console.error('Error reporting question:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
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
    const { notes, taggedCategories } = req.body || {};

    const attempt = await UserTestAttempt.findById(attemptId);
    if (!attempt) return res.status(404).json({ success: false, message: 'Test attempt not found' });
    if (attempt.user.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });

    const questionIdx = parseInt(questionIndex);
    if (questionIdx < 0 || questionIdx >= attempt.questionAttempts.length) {
      return res.status(400).json({ success: false, message: 'Invalid question index' });
    }

    const mcqId = attempt.questionAttempts[questionIdx].mcqId;
    attempt.questionAttempts[questionIdx].saved = true;
    await attempt.save();

    const savedQuestion = await SavedQuestion.findOneAndUpdate(
      { user: req.user.id, mcq: mcqId },
      { user: req.user.id, mcq: mcqId, notes: notes || '', taggedCategories: taggedCategories || [], testId: attempt.test },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, message: 'Question saved successfully', data: { attempt, savedQuestion } });
  } catch (error) {
    console.error('Error saving question:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Pause a test attempt — saves all answers/marks/position in a single batch write.
 * Status stays 'in-progress' so the student can resume later.
 * @route PUT /api/user-tests/:attemptId/pause
 * @access Private
 * Body: { answers?: [{questionIndex, selectedOption, markedForReview}], currentQuestionIndex?, timeSpent? }
 */
exports.pauseTest = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { answers, currentQuestionIndex, timeSpent } = req.body;

    const attempt = await UserTestAttempt.findById(attemptId);
    if (!attempt) return res.status(404).json({ success: false, message: 'Attempt not found' });
    if (attempt.user.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });
    if (attempt.status !== 'in-progress') return res.status(400).json({ success: false, message: 'Attempt not in progress' });

    // Apply batch answers (same logic as completeTest, but keep status in-progress)
    if (Array.isArray(answers) && answers.length > 0) {
      const missingIds = attempt.questionAttempts
        .filter((qa) => !qa.correctOption)
        .map((qa) => qa.mcqId);

      const fallbackMap = {};
      if (missingIds.length > 0) {
        const mcqs = await MCQ.find({ _id: { $in: missingIds } }).select('_id options').lean();
        for (const m of mcqs) {
          const co = m.options?.find((o) => o.isCorrect)?.optionLetter;
          if (co) fallbackMap[m._id.toString()] = co;
        }
      }

      for (const ans of answers) {
        const idx = ans.questionIndex;
        if (idx == null || idx < 0 || idx >= attempt.questionAttempts.length) continue;
        const qa = attempt.questionAttempts[idx];
        if (ans.selectedOption  !== undefined) qa.selectedOption  = ans.selectedOption;
        if (ans.markedForReview !== undefined) qa.markedForReview = ans.markedForReview;
        // Compute isCorrect so tutor-mode feedback is restored correctly on resume
        const correctOpt = qa.correctOption || fallbackMap[qa.mcqId.toString()];
        if (correctOpt) qa.isCorrect = qa.selectedOption != null && qa.selectedOption === correctOpt;
      }
    }

    if (currentQuestionIndex != null) attempt.currentQuestionIndex = currentQuestionIndex;

    // Save time spent so timer resumes from the paused point (not wall-clock)
    if (timeSpent != null && timeSpent > 0) attempt.totalTimeSpent = timeSpent;

    await attempt.save();

    res.json({ success: true, message: 'Test paused' });
  } catch (error) {
    console.error('pauseTest error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Complete a test attempt — accepts a full answers batch for zero mid-test API calls.
 * @route PUT /api/user-tests/:attemptId/complete
 * @access Private
 * Body: { totalTimeSpent?, answers?: [{questionIndex, selectedOption, markedForReview}] }
 */
exports.completeTest = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { totalTimeSpent, answers } = req.body;

    const attempt = await UserTestAttempt.findById(attemptId);
    if (!attempt) return res.status(404).json({ success: false, message: 'Test attempt not found' });
    if (attempt.user.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });
    if (attempt.status !== 'in-progress') return res.status(400).json({ success: false, message: 'Test attempt is not in progress' });

    // Apply batch answers when provided (new client flow)
    if (Array.isArray(answers) && answers.length > 0) {
      // Single batch fetch for any legacy QAs that are missing correctOption
      const missingIds = attempt.questionAttempts
        .filter((qa) => !qa.correctOption)
        .map((qa) => qa.mcqId);

      const fallbackMap = {};
      if (missingIds.length > 0) {
        const mcqs = await MCQ.find({ _id: { $in: missingIds } }).select('_id options').lean();
        for (const m of mcqs) {
          const co = m.options?.find((o) => o.isCorrect)?.optionLetter;
          if (co) fallbackMap[m._id.toString()] = co;
        }
      }

      for (const ans of answers) {
        const idx = ans.questionIndex;
        if (idx == null || idx < 0 || idx >= attempt.questionAttempts.length) continue;
        const qa = attempt.questionAttempts[idx];
        if (ans.selectedOption  !== undefined) qa.selectedOption  = ans.selectedOption;
        if (ans.markedForReview !== undefined) qa.markedForReview = ans.markedForReview;

        const correctOpt = qa.correctOption || fallbackMap[qa.mcqId.toString()];
        qa.isCorrect = qa.selectedOption != null && qa.selectedOption === correctOpt;
      }
    }

    // Compute score inline — no pre-save hook required
    const correctAnswers  = attempt.questionAttempts.filter((qa) => qa.isCorrect).length;
    attempt.score         = correctAnswers;
    attempt.maxScore      = attempt.questionAttempts.length;
    attempt.answeredCount = attempt.questionAttempts.filter((qa) => qa.selectedOption !== null).length;
    attempt.scorePercentage = attempt.maxScore > 0 ? (correctAnswers / attempt.maxScore) * 100 : 0;

    attempt.status  = 'completed';
    attempt.endTime = new Date();
    if (totalTimeSpent) attempt.totalTimeSpent = totalTimeSpent;

    await attempt.save();

    updateUserMcqHistory(attempt);  // fire-and-forget — does not block the response
    updateMcqOptionStats(attempt);  // fire-and-forget — increments per-option pick counts

    const totalQuestions   = attempt.questionAttempts.length;
    const answeredQuestions = attempt.questionAttempts.filter((q) => q.selectedOption !== null).length;
    const accuracy          = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

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
          totalTimeSpent:  attempt.totalTimeSpent,
          score:           attempt.score,
          maxScore:        attempt.maxScore,
          scorePercentage: attempt.scorePercentage,
        },
      },
    });
  } catch (error) {
    console.error('Error completing test:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Get user test history — server-side pagination, filtering, and no questionAttempts in list.
 * @route GET /api/user-tests/history?page=1&limit=20&status=&mode=&search=&subject=&chapter=&topic=&qbId=&date=
 * @access Private
 */
exports.getUserTestHistory = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    // Attempt-level filters (direct fields on UserTestAttempt)
    const attemptQuery = { user: req.user.id };
    if (req.query.status && req.query.status !== 'all') attemptQuery.status = req.query.status;
    if (req.query.mode   && req.query.mode   !== 'all') attemptQuery.mode   = req.query.mode;

    if (req.query.date && req.query.date !== 'all') {
      const now = Date.now();
      if (req.query.date === 'today') {
        const d = new Date(); d.setHours(0, 0, 0, 0);
        attemptQuery.createdAt = { $gte: d };
      } else if (req.query.date === 'week') {
        attemptQuery.createdAt = { $gte: new Date(now - 7 * 86400000) };
      } else if (req.query.date === 'month') {
        attemptQuery.createdAt = { $gte: new Date(now - 30 * 86400000) };
      }
    }

    // Test-level filters — resolve matching Test IDs first, then filter attempts
    const { search, subject, chapter, topic, qbId } = req.query;
    const hasTestFilter = search || (subject && subject !== 'all') || (chapter && chapter !== 'all') ||
                          (topic && topic !== 'all') || (qbId && qbId !== 'all');
    if (hasTestFilter) {
      const testQuery = {};
      if (search)                        testQuery.title         = { $regex: search, $options: 'i' };
      if (subject && subject !== 'all')  testQuery.subjects      = subject;
      if (chapter && chapter !== 'all')  testQuery.chapters      = chapter;
      if (topic   && topic   !== 'all')  testQuery.topics        = topic;
      if (qbId    && qbId    !== 'all')  testQuery.questionBankId = qbId;
      const matchingIds = await Test.find(testQuery).select('_id').lean();
      attemptQuery.test = { $in: matchingIds.map((t) => t._id) };
    }

    // Paginated data — only selectedOption from questionAttempts (rest is excluded)
    const [rawAttempts, total] = await Promise.all([
      UserTestAttempt.find(attemptQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('test mode status score maxScore scorePercentage startTime endTime totalTimeSpent createdAt questionAttempts.selectedOption')
        .populate({
          path: 'test',
          select: 'title subjects chapters topics subject unit questionBankId',
          populate: { path: 'questionBankId', select: 'title' },
        })
        .lean(),
      UserTestAttempt.countDocuments(attemptQuery),
    ]);

    // Replace questionAttempts array with a single answeredCount scalar
    const attempts = rawAttempts.map((a) => {
      const answeredCount = (a.questionAttempts || []).filter((qa) => qa.selectedOption).length;
      const { questionAttempts: _omit, ...rest } = a;
      return { ...rest, answeredCount };
    });

    // Summary stats — computed from ALL user attempts (unaffected by current filter)
    const [statsAgg] = await UserTestAttempt.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(req.user.id) } },
      { $group: {
        _id:       null,
        total:     { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        sumScore:  { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$scorePercentage', 0] } },
      }},
    ]);
    const s = statsAgg || { total: 0, completed: 0, sumScore: 0 };
    const stats = {
      total:     s.total,
      completed: s.completed,
      avgScore:  s.completed > 0 ? Math.round(s.sumScore / s.completed) : 0,
    };

    // Filter options — distinct values from ALL user's test history (for dropdowns)
    const allTestIds = await UserTestAttempt.distinct('test', { user: req.user.id });
    const allTests   = await Test.find({ _id: { $in: allTestIds } })
      .select('subjects chapters topics subject unit questionBankId')
      .populate('questionBankId', 'title')
      .lean();

    const subjs = new Set(), chaps = new Set(), tops = new Set();
    const qbMap = {};
    allTests.forEach((t) => {
      (t.subjects || []).forEach((v) => v && subjs.add(v));
      if (t.subject) subjs.add(t.subject);
      (t.chapters || []).forEach((v) => v && chaps.add(v));
      if (t.unit) chaps.add(t.unit);
      (t.topics || []).forEach((v) => v && tops.add(v));
      const qb = t.questionBankId;
      if (qb) qbMap[(qb._id || qb).toString()] = qb.title || (qb._id || qb).toString();
    });
    const filterOptions = {
      subjects: [...subjs].sort(),
      chapters: [...chaps].sort(),
      topics:   [...tops].sort(),
      qbs:      Object.entries(qbMap)
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([id, title]) => ({ id, title })),
    };

    res.status(200).json({
      success:       true,
      data:          attempts,
      total,
      page,
      pages:         Math.ceil(total / limit) || 1,
      stats,
      filterOptions,
    });
  } catch (error) {
    console.error('Error getting test history:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
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

    res.status(200).json({ success: true, count: savedQuestions.length, data: savedQuestions });
  } catch (error) {
    console.error('Error getting saved questions:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Toggle mark-for-review on a question
 * @route PUT /api/user-tests/:attemptId/mark/:questionIndex
 * @access Private
 */
exports.toggleMarkForReview = async (req, res) => {
  try {
    const { attemptId, questionIndex } = req.params;
    const attempt = await UserTestAttempt.findById(attemptId);
    if (!attempt) return res.status(404).json({ success: false, message: 'Attempt not found' });
    if (attempt.user.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });

    const idx = parseInt(questionIndex);
    if (idx < 0 || idx >= attempt.questionAttempts.length) return res.status(400).json({ success: false, message: 'Invalid index' });

    attempt.questionAttempts[idx].markedForReview = !attempt.questionAttempts[idx].markedForReview;
    await attempt.save();

    res.status(200).json({ success: true, markedForReview: attempt.questionAttempts[idx].markedForReview });
  } catch (error) {
    console.error('Error toggling mark:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Remove saved question by MCQ ID
 * @route DELETE /api/user-tests/saved-questions/mcq/:mcqId
 * @access Private
 */
exports.removeSavedQuestionByMcqId = async (req, res) => {
  try {
    const { mcqId } = req.params;
    await SavedQuestion.findOneAndDelete({ user: req.user.id, mcq: mcqId });
    res.status(200).json({ success: true, message: 'Removed from saved' });
  } catch (error) {
    console.error('Error removing saved question:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
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
    if (!savedQuestion) return res.status(404).json({ success: false, message: 'Saved question not found' });
    if (savedQuestion.user.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });

    await savedQuestion.deleteOne();
    res.status(200).json({ success: true, message: 'Saved question removed successfully' });
  } catch (error) {
    console.error('Error removing saved question:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
