// File: controllers/mcqController.js
const MCQ = require('../models/McqModel');
const Test = require('../models/TestModel');
const MCQReport = require('../models/MCQReport');
const QuestionBank = require('../models/QuestionBankModel');
const mongoose = require('mongoose');
const { syncTestClassification } = require('./testController');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { extractMCQsFromDoc, convertToBackendFormat } = require('../utils/mcqDocParser');
const qbCountsCache = require('../utils/qbCountsCache');

// ── Denormalised classification backfill ────────────────────────────────────
// The user side (Test Player chips, Test Result per-topic analytics) reads the
// MCQ's STRING fields subject/unit/topic directly — no qb-id → title resolution
// happens there, by design (keeps those hot reads join-free). So whenever an
// MCQ carries QB classification ids, its string fields MUST mirror the QB's
// titles. Bulk import already sends the titles; this helper guarantees the
// single-MCQ create/update path does too, and self-heals any caller that sends
// ids without titles.
//
// Mutates `data` in place. Only fills a string when it's missing/empty so an
// admin who deliberately typed a custom value isn't overwritten. Best-effort:
// a failed QB lookup leaves the data untouched (never blocks the save).
// `force` (used on UPDATE): re-resolve the strings even when present, because
// the admin may have RECLASSIFIED the MCQ (picked new ids) and the form often
// still carries the old title strings. On CREATE we pass force=false so an
// admin-typed custom string isn't overwritten.
const fillClassificationStrings = async (data, { force = false } = {}) => {
  try {
    if (!data || !data.questionBankId) return;
    const needsSubject = data.qbSubjectId && (force || !data.subject);
    const needsChapter = data.qbChapterId && (force || !data.unit);
    const needsTopic   = data.qbTopicId   && (force || !data.topic);
    if (!needsSubject && !needsChapter && !needsTopic) return;

    const qb = await QuestionBank.findById(data.questionBankId).lean();
    if (!qb) return;

    const subj = (qb.subjects || []).find((s) => String(s._id) === String(data.qbSubjectId));
    if (!subj) return;
    if (needsSubject) data.subject = subj.title;

    const chap = data.qbChapterId
      ? (subj.chapters || []).find((c) => String(c._id) === String(data.qbChapterId))
      : null;
    if (chap && needsChapter) data.unit = chap.title;

    const top = (chap && data.qbTopicId)
      ? (chap.topics || []).find((t) => String(t._id) === String(data.qbTopicId))
      : null;
    if (top && needsTopic) data.topic = top.title;
  } catch (err) {
    // Non-fatal — leave strings as-is; the save still proceeds.
    console.error('fillClassificationStrings error:', err?.message || err);
  }
};

// Create new MCQ
exports.createMCQ = async (req, res) => {
  try {
    const mcqData = {
      ...req.body,
      author: req.user.fullName,
    };

    // Mirror QB titles into the denormalised subject/unit/topic strings the
    // user side reads. No-op if they were already sent (e.g. bulk import).
    await fillClassificationStrings(mcqData);

    const mcq = await MCQ.create(mcqData);

    // Attach to a Test only when a testId was supplied. A QB-only MCQ (added
    // straight into a Question Bank) has no testId and lives purely in the QB
    // — exactly like a bulk-imported MCQ. Previously this path 404'd because
    // it unconditionally looked up a test, which both errored AND left the
    // freshly-created MCQ orphaned.
    let test = null;
    if (req.body.testId) {
      test = await Test.findById(req.body.testId);
      if (!test) {
        // Roll back the orphaned MCQ so a bad testId can't leave junk behind.
        await MCQ.findByIdAndDelete(mcq._id);
        return res.status(404).json({
          success: false,
          message: 'Test not found'
        });
      }

      test.mcqs.push(mcq._id);
      test.totalQuestions = test.mcqs.length;
      await test.save();

      syncTestClassification(test._id).catch(console.error);
    }

    // QB count cache: this MCQ either carries its own questionBankId or
    // inherits one from the parent test (auto-test MCQs). Either way the
    // QB total + per-topic counts just changed — invalidate so the next
    // /question-banks and /topic-counts read rebuild fresh.
    qbCountsCache.invalidate(mcq.questionBankId || test?.questionBankId);

    res.status(201).json({
      success: true,
      data: mcq
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get all MCQs for a test
// Supports both test-owned MCQs (testId field) and QB-sourced MCQs (test.mcqs array)
exports.getMCQsForTest = async (req, res) => {
  try {
    const { testId } = req.params;

    // Primary: find MCQs that have testId pointing to this test.
    // Secondary _id sort keeps order stable when many share a createdAt.
    let mcqs = await MCQ.find({ testId }).sort({ createdAt: 1, _id: 1 });

    // Fallback: auto-generated tests store MCQ refs in test.mcqs but MCQs don't
    // have the testId set. Populate from the test's mcqs array instead.
    if (mcqs.length === 0) {
      const test = await Test.findById(testId).populate('mcqs');
      if (test && Array.isArray(test.mcqs) && test.mcqs.length > 0) {
        mcqs = test.mcqs.filter(m => m && m._id); // populated objects only
      }
    }

    res.status(200).json({
      success: true,
      count: mcqs.length,
      data: mcqs,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get single MCQ
exports.getMCQ = async (req, res) => {
  try {
    const mcq = await MCQ.findById(req.params.id);
    
    if (!mcq) {
      return res.status(404).json({
        success: false,
        message: 'MCQ not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: mcq
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Update MCQ
exports.updateMCQ = async (req, res) => {
  try {
    const mcq = await MCQ.findById(req.params.id);
    
    if (!mcq) {
      return res.status(404).json({
        success: false,
        message: 'MCQ not found'
      });
    }
    
    // Only allow author to update
    // if (mcq.author !== req.user.fullName && req.user.role !== 'admin') {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Not authorized to update this MCQ'
    //   });
    // }
    
    // Manual revision tracking
    const updatedData = {
      ...req.body,
      revisionCount: (mcq.revisionCount || 0) + 1,
      lastRevised: new Date()
    };

    // Keep the denormalised subject/unit/topic strings in sync with the QB
    // ids. force=true so a reclassification (new ids, stale title strings from
    // the form) refreshes the strings to the new titles.
    await fillClassificationStrings(updatedData, { force: true });

    // Using findByIdAndUpdate to update the MCQ
    const updatedMCQ = await MCQ.findByIdAndUpdate(
      req.params.id,
      updatedData,
      {
        new: true,
        runValidators: true
      }
    );

    // QB count cache: if the MCQ's questionBankId or qbTopicId changed, both
    // the old and new QB totals are stale. Invalidating both is cheap (just
    // Map.delete) and avoids subtle bugs when admins move an MCQ between QBs.
    qbCountsCache.invalidateMany([mcq.questionBankId, updatedMCQ?.questionBankId]);

    res.status(200).json({
      success: true,
      data: updatedMCQ
    });
  } catch (error) {
    console.error('Error updating MCQ:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Delete MCQ
exports.deleteMCQ = async (req, res) => {
  try {
    const mcq = await MCQ.findById(req.params.id);
    
    if (!mcq) {
      return res.status(404).json({
        success: false,
        message: 'MCQ not found'
      });
    }
    
    // // Only allow author to delete
    // if (mcq.author !== req.user.fullName && req.user.role !== 'admin') {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Not authorized to delete this MCQ'
    //   });
    // }
    
    // Remove MCQ from test
    const test = await Test.findById(mcq.testId);
    if (test) {
      test.mcqs = test.mcqs.filter(id => id.toString() !== mcq._id.toString());
      test.totalQuestions = test.mcqs.length;
      await test.save();
    }

    await mcq.deleteOne();

    // QB count cache: invalidate the MCQ's QB (and the parent test's QB if
    // the MCQ didn't carry one directly) so subsequent reads rebuild fresh.
    qbCountsCache.invalidate(mcq.questionBankId || test?.questionBankId);

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};



//Below All Functionlaities is about MCQs Bulk Upload

// backend/controllers/mcqImportController.js

// Set up multer storage for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueFilename = `${uuidv4()}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, uniqueFilename);
  }
});

// Create multer upload middleware
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB
  },
  fileFilter: (req, file, cb) => {
    // Only accept .docx files
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Only .docx files are allowed'), false);
    }
  }
}).single('file');

// Store ongoing import operations
const importOperations = {};

// Idempotency guard: maps a client-supplied importKey → the importId we created
// for it. A duplicate request (axios replay after token refresh, proxy/network
// retry, double-submit) carries the SAME key, so we return the original importId
// instead of starting a second extraction — preventing duplicate MCQs.
// Entries are pruned after a TTL so the map can't grow unbounded.
const seenImportKeys = new Map(); // importKey → { importId, at }
const IMPORT_KEY_TTL_MS = 30 * 60 * 1000; // 30 min — well past any retry window
const pruneImportKeys = () => {
  const now = Date.now();
  for (const [k, v] of seenImportKeys) {
    if (now - v.at > IMPORT_KEY_TTL_MS) seenImportKeys.delete(k);
  }
};

/**
 * Handle document upload and start MCQ extraction
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.uploadDocument = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Idempotency: if this exact submit was already accepted, don't process the
    // re-uploaded copy again — discard its temp file and return the original
    // importId so the client keeps polling the SAME operation.
    const importKey = req.body.importKey;
    if (importKey) {
      pruneImportKeys();
      const prior = seenImportKeys.get(importKey);
      if (prior) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(200).json({
          success: true,
          message: 'Duplicate upload ignored; original import is in progress.',
          importId: prior.importId,
          duplicate: true,
        });
      }
    }

    const { testId, questionBankId, qbSubjectId, qbChapterId, qbTopicId } = req.body;

    // Parse multi-classification list (optional, sent as JSON string)
    let classifications = [];
    if (req.body.classifications) {
      try { classifications = JSON.parse(req.body.classifications); } catch (_) {}
    }

    // Primary QB fields: explicit params → first classification → test's existing QB
    const primaryCls = classifications[0] || {};
    const primaryQbId      = questionBankId      || primaryCls.questionBankId || null;
    const primarySubjectId = qbSubjectId         || primaryCls.qbSubjectId    || null;
    const primaryChapterId = qbChapterId         || primaryCls.qbChapterId    || null;
    const primaryTopicId   = qbTopicId           || primaryCls.qbTopicId      || null;

    // testId is sufficient on its own; QB required only if no testId
    if (!testId && !primaryQbId) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Either testId or a Question Bank selection is required',
      });
    }

    try {
      let test = null;
      if (testId) {
        test = await Test.findById(testId);
        if (!test) {
          fs.unlinkSync(req.file.path);
          return res.status(404).json({ success: false, message: 'Test not found' });
        }
      }

      // Generate a unique import ID
      const importId = uuidv4();

      // Get additional MCQ information from request body
      const mcqInfo = {
        author: req.body.author || req.user.fullName || 'Document Import',
        subject: req.body.subject || '',
        unit: req.body.unit || '',
        topic: req.body.topic || '',
        subTopic: req.body.subTopic || '',
        session: req.body.session || '',
        difficulty: req.body.difficulty || 'Medium',
        isPublic: true,
        // Primary QB fields (for MCQ storage)
        questionBankId: primaryQbId   || (test && test.questionBankId) || null,
        qbSubjectId:    primarySubjectId || (test && test.qbSubjectId) || null,
        qbChapterId:    primaryChapterId || (test && test.qbChapterId) || null,
        qbTopicId:      primaryTopicId   || (test && test.qbTopicId)   || null,
        // All classifications (for test tagging)
        classifications,
      };

      // Store import operation info
      importOperations[importId] = {
        status: 'processing',
        file: req.file.path,
        testId: testId || null,
        mcqInfo,
        startTime: new Date(),
        importedCount: 0,
      };

      // Register the idempotency key BEFORE kicking off processing so a
      // near-simultaneous replay (which is the realistic race) is caught.
      if (importKey) seenImportKeys.set(importKey, { importId, at: Date.now() });

      // Start extraction process in the background
      processDocument(importId, req.file.path, testId || null, test, mcqInfo);
      
      // Return import ID for status checking
      return res.status(200).json({
        success: true,
        message: 'File uploaded successfully. MCQ extraction in progress.',
        importId
      });
    } catch (error) {
      console.error('Error handling document upload:', error);
      
      // Clean up the uploaded file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(500).json({
        success: false,
        message: 'Failed to process document. Please try again.'
      });
    }
  });
};

/**
 * Process the uploaded document
 * @param {string} importId - Import operation ID
 * @param {string} filePath - Path to the uploaded file
 * @param {string} testId - Test ID
 * @param {Object} test - Test object
 * @param {Object} mcqInfo - Additional MCQ information
 */
async function processDocument(importId, filePath, testId, test, mcqInfo) {
  try {
    // Images will be saved to this directory
    const imageDir = path.join(__dirname, '../uploads/images');
    
    // Extract MCQs from document
    const extractedMcqs = await extractMCQsFromDoc(filePath, imageDir);
    
    // Convert to backend format with additional information
    const mcqsToImport = convertToBackendFormat(extractedMcqs, testId, mcqInfo);
    
    // Insert MCQs to database
    const importedMcqs = await MCQ.insertMany(mcqsToImport);

    // QB count cache: a bulk import can land MCQs across multiple QBs (the
    // converter pulls questionBankId per-row). Collect the unique set and
    // invalidate them all in one shot — Map.delete is O(1) per entry.
    const touchedQbs = [...new Set(
      importedMcqs
        .map((m) => m.questionBankId?.toString())
        .filter(Boolean)
    )];
    // Also invalidate the parent test's QB in case the imported rows didn't
    // carry their own questionBankId (legacy converter behaviour).
    if (test?.questionBankId) touchedQbs.push(test.questionBankId.toString());
    qbCountsCache.invalidateMany(touchedQbs);

    // Update test with new MCQs (only if a test was provided)
    const mcqIds = importedMcqs.map((mcq) => mcq._id);
    if (test) {
      test.mcqs.push(...mcqIds);
      test.totalQuestions = test.mcqs.length;
      await test.save();

      // Sync QB-resolved classification from MCQs
      await syncTestClassification(testId);

      // Also merge any extra classifications supplied by the user
      if (Array.isArray(mcqInfo.classifications) && mcqInfo.classifications.length) {
        const extraSubjects = mcqInfo.classifications.map((c) => c.subjectTitle).filter(Boolean);
        const extraChapters = mcqInfo.classifications.map((c) => c.chapterTitle).filter(Boolean);
        const extraTopics   = mcqInfo.classifications.map((c) => c.topicTitle).filter(Boolean);
        if (extraSubjects.length || extraChapters.length || extraTopics.length) {
          const cur = await Test.findById(testId);
          if (cur) {
            await Test.findByIdAndUpdate(testId, {
              subjects: [...new Set([...(cur.subjects || []), ...extraSubjects])].filter(Boolean),
              chapters: [...new Set([...(cur.chapters || []), ...extraChapters])].filter(Boolean),
              topics:   [...new Set([...(cur.topics   || []), ...extraTopics  ])].filter(Boolean),
            });
          }
        }
      }
    }
    
    // Update import operation status
    importOperations[importId] = {
      ...importOperations[importId],
      status: 'completed',
      endTime: new Date(),
      importedCount: importedMcqs.length
    };
    
    console.log(`Import ${importId} completed: ${importedMcqs.length} MCQs imported`);
    
    // Clean up temporary file after 5 minutes
    setTimeout(() => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        // Remove import operation after 1 hour
        setTimeout(() => {
          delete importOperations[importId];
        }, 60 * 60 * 1000);
      } catch (error) {
        console.error('Error cleaning up temporary file:', error);
      }
    }, 5 * 60 * 1000);
  } catch (error) {
    console.error(`Error processing document ${importId}:`, error);
    
    // Update import operation status
    importOperations[importId] = {
      ...importOperations[importId],
      status: 'error',
      endTime: new Date(),
      error: error.message
    };
    
    // Clean up temporary file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

// GET /api/mcqs/question-bank/:qbId
//   ?page=1&limit=20&subjectId=&chapterId=&topicId=&search=
//   &difficulty=Easy|Medium|Hard&visibility=public|private
//   &hasImage=1&minRevisions=N&minReports=N
//   &wrongPct=50&minAttempts=100
//
// `search` does a case-insensitive substring match over the question text and
// the option texts. Omit subjectId/chapterId/topicId to search the WHOLE bank
// (used by the QB-wide "Search MCQs" entry point).
//
// Additional filters (all optional, AND-combined):
//   • difficulty   — exact match on the difficulty enum.
//   • visibility   — 'public' (isPublic !== false) / 'private' (isPublic === false).
//   • hasImage=1   — MCQs that embed at least one <img> in the question, any
//                    option, or the explanation (images live inline in the rich
//                    text — there is no dedicated image field).
//   • minRevisions — revisionCount >= N.
//   • minReports   — MCQs with >= N OPEN/ACTIVE student reports. Resolved by a
//                    pre-aggregation over the report collection, then folded
//                    into the same query via _id: { $in }.
//   • wrongPct + minAttempts — "hard for students" filter. Selects MCQs where
//                    at least `wrongPct`% of attempts picked a WRONG option AND
//                    the MCQ has at least `minAttempts` total attempts. Derived
//                    live from statistics.optionsSelections (the correct option
//                    is whichever option has isCorrect:true) — we do NOT rely on
//                    the legacy statistics.correctPercentage field, which is
//                    never written.
//   • university   — case-insensitive substring match on the (past-paper)
//                    university/board string field.
//   • year         — case-insensitive substring match on the year string field
//                    (stored as text, e.g. "2024" or "2024-25").
exports.getMCQsForQuestionBank = async (req, res) => {
  try {
    const { qbId } = req.params;
    const { subjectId, chapterId, topicId, search, difficulty, visibility, hasImage, university, year } = req.query;

    const filter = { questionBankId: new mongoose.Types.ObjectId(qbId) };
    if (topicId)        filter.qbTopicId   = new mongoose.Types.ObjectId(topicId);
    else if (chapterId) filter.qbChapterId = new mongoose.Types.ObjectId(chapterId);
    else if (subjectId) filter.qbSubjectId = new mongoose.Types.ObjectId(subjectId);

    // Collect $and clauses so independent text-based conditions (search +
    // hasImage) don't clobber each other's $or.
    const andClauses = [];

    if (search && search.trim()) {
      // Escape regex specials so a query like "H2O (g)" is treated literally.
      const safe = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(safe, 'i');
      andClauses.push({ $or: [
        { questionText: rx },
        { 'options.optionText': rx },
      ]});
    }

    if (['Easy', 'Medium', 'Hard'].includes(difficulty)) {
      filter.difficulty = difficulty;
    }

    if (visibility === 'public')  filter.isPublic = { $ne: false };
    if (visibility === 'private') filter.isPublic = false;

    // Past-paper provenance — case-insensitive substring match so "2024" also
    // matches "2024-25" and "UHS" matches "UHS Lahore".
    if (university && university.trim()) {
      const safe = university.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.university = new RegExp(safe, 'i');
    }
    if (year && year.trim()) {
      const safe = year.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.year = new RegExp(safe, 'i');
    }

    if (hasImage === '1') {
      // Images are <img> tags inside the rich text — match across all three
      // HTML-bearing fields.
      const imgRx = /<img\b/i;
      andClauses.push({ $or: [
        { questionText: imgRx },
        { 'options.optionText': imgRx },
        { explanationText: imgRx },
      ]});
    }

    const minRevisions = parseInt(req.query.minRevisions);
    if (Number.isFinite(minRevisions) && minRevisions > 0) {
      filter.revisionCount = { $gte: minRevisions };
    }

    const minReports = parseInt(req.query.minReports);
    if (Number.isFinite(minReports) && minReports > 0) {
      // Find every MCQ carrying >= minReports open/active reports, then
      // constrain the main query to that id set. We don't filter the
      // aggregation by QB (the denormalized mcqQuestionBankId may be absent on
      // legacy reports) — the main query's questionBankId already scopes the
      // result to this bank, so cross-QB ids in the $in are simply never
      // matched. One extra aggregation, still one endpoint.
      const reported = await MCQReport.aggregate([
        { $match: { status: { $in: ['open', 'active'] } } },
        { $group: { _id: '$mcq', count: { $sum: 1 } } },
        { $match: { count: { $gte: minReports } } },
      ]);
      // Use an $and id-clause (not filter._id =) so it intersects with the
      // wrong-option filter below instead of overwriting it.
      andClauses.push({ _id: { $in: reported.map((r) => r._id) } });
    }

    // "Hard for students" — % who picked a wrong option, gated by a minimum
    // attempt count so a single unlucky attempt doesn't surface. Computed from
    // optionsSelections: wrongPct = (total - <count of the correct letter>) / total.
    const wrongPct     = parseFloat(req.query.wrongPct);
    const minAttempts  = parseInt(req.query.minAttempts);
    const wantWrong    = Number.isFinite(wrongPct) && wrongPct > 0;
    const wantAttempts = Number.isFinite(minAttempts) && minAttempts > 0;
    if (wantWrong || wantAttempts) {
      const total = '$statistics.optionsSelections.total';
      // Pick the selection count of whichever option has isCorrect:true. If an
      // MCQ somehow has no correct option flagged, correctCount falls back to 0
      // (so it counts as 100% wrong — surfaced, which is the safe direction for
      // a QA filter).
      const correctLetter = {
        $let: {
          vars: {
            opt: { $arrayElemAt: [
              { $filter: { input: '$options', as: 'o', cond: { $eq: ['$$o.isCorrect', true] } } },
              0,
            ]},
          },
          in: '$$opt.optionLetter',
        },
      };
      const correctCount = {
        $switch: {
          branches: [
            { case: { $eq: [correctLetter, 'A'] }, then: '$statistics.optionsSelections.A' },
            { case: { $eq: [correctLetter, 'B'] }, then: '$statistics.optionsSelections.B' },
            { case: { $eq: [correctLetter, 'C'] }, then: '$statistics.optionsSelections.C' },
            { case: { $eq: [correctLetter, 'D'] }, then: '$statistics.optionsSelections.D' },
            { case: { $eq: [correctLetter, 'E'] }, then: '$statistics.optionsSelections.E' },
          ],
          default: 0,
        },
      };
      const match = { $expr: { $and: [] } };
      // Always require a positive total when either sub-filter is on (avoids
      // divide-by-zero and excludes never-attempted MCQs from this view).
      match.$expr.$and.push({ $gt: [{ $ifNull: [total, 0] }, 0] });
      if (wantAttempts) {
        match.$expr.$and.push({ $gte: [{ $ifNull: [total, 0] }, minAttempts] });
      }
      if (wantWrong) {
        // (total - correctCount) / total * 100 >= wrongPct
        match.$expr.$and.push({
          $gte: [
            { $multiply: [
              { $divide: [
                { $subtract: [{ $ifNull: [total, 0] }, { $ifNull: [correctCount, 0] }] },
                { $ifNull: [total, 1] },
              ]},
              100,
            ]},
            wrongPct,
          ],
        });
      }
      const hard = await MCQ.aggregate([
        { $match: { questionBankId: new mongoose.Types.ObjectId(qbId) } },
        { $match: match },
        { $project: { _id: 1 } },
      ]);
      andClauses.push({ _id: { $in: hard.map((r) => r._id) } });
    }

    if (andClauses.length > 0) filter.$and = andClauses;

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const [mcqs, total, statsAgg] = await Promise.all([
      // Secondary sort on _id makes pagination STABLE: many MCQs share the same
      // createdAt (e.g. one bulk import batch), and sorting on createdAt alone
      // is non-deterministic across skip/limit windows — pages would overlap or
      // repeat. _id is unique + monotonic, so it guarantees disjoint pages.
      MCQ.find(filter).sort({ createdAt: 1, _id: 1 }).skip(skip).limit(limit),
      MCQ.countDocuments(filter),
      MCQ.aggregate([
        { $match: filter },
        { $group: {
          _id:     null,
          easy:    { $sum: { $cond: [{ $eq: ['$difficulty', 'Easy'] },  1, 0] } },
          hard:    { $sum: { $cond: [{ $eq: ['$difficulty', 'Hard'] },  1, 0] } },
          private: { $sum: { $cond: [{ $eq: ['$isPublic', false] }, 1, 0] } },
        }},
      ]),
    ]);

    const agg = statsAgg[0] || { easy: 0, hard: 0, private: 0 };
    const stats = {
      easy:    agg.easy,
      medium:  total - agg.easy - agg.hard,
      hard:    agg.hard,
      private: agg.private,
    };

    res.status(200).json({
      success: true,
      count:   mcqs.length,
      total,
      page,
      pages:   Math.ceil(total / limit) || 1,
      stats,
      data:    mcqs,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// GET /api/mcqs/question-bank/:qbId/topic-counts
// Returns per-level MCQ counts so the generator can show availability for a
// selected subject / chapter / topic WITHOUT a bottom-up topic sum (which used
// to drop MCQs that stop at subject/chapter and have no topic):
//   {
//     bySubject: { [subjectId]: count },   // every MCQ with that qbSubjectId
//     byChapter: { [chapterId]: count },   // every MCQ with that qbChapterId
//     byTopic:   { [topicId]:   count },   // every MCQ with that qbTopicId
//   }
// Each level is counted DIRECTLY by its own id (top-down), so the number shown
// for a subject equals the pool generateTest actually draws from (it also
// filters by qbSubjectId/qbChapterId/qbTopicId). The frontend reads the map for
// the selected level — it must NOT sum across levels.
//
// Served from qbCountsCache. Same response for every user, so one cached entry
// serves the whole site. Invalidated on any MCQ create/update/delete that
// touches this QB (see CRUD handlers above).
exports.getTopicCounts = async (req, res) => {
  try {
    const { qbId } = req.params;

    const cached = qbCountsCache.getTopicCounts(qbId);
    if (cached) {
      return res.json({ success: true, data: cached, cached: true });
    }

    // ONE aggregation, grouped by the (subject, chapter, topic) triple. From
    // these rows we build all three per-level maps in JS — still a single
    // collection scan, single cache entry per qbId, same invalidation.
    const agg = await MCQ.aggregate([
      { $match: { questionBankId: new mongoose.Types.ObjectId(qbId) } },
      { $group: {
        _id: { subject: '$qbSubjectId', chapter: '$qbChapterId', topic: '$qbTopicId' },
        count: { $sum: 1 },
      }},
    ]);

    const bySubject = {};
    const byChapter = {};
    const byTopic   = {};
    for (const r of agg) {
      const { subject, chapter, topic } = r._id || {};
      if (subject) bySubject[subject.toString()] = (bySubject[subject.toString()] || 0) + r.count;
      if (chapter) byChapter[chapter.toString()] = (byChapter[chapter.toString()] || 0) + r.count;
      if (topic)   byTopic[topic.toString()]     = (byTopic[topic.toString()]     || 0) + r.count;
    }

    const data = { bySubject, byChapter, byTopic };
    qbCountsCache.setTopicCounts(qbId, data);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getImportStatus = (req, res) => {
  const { importId } = req.params;
  
  if (!importId || !importOperations[importId]) {
    return res.status(404).json({
      success: false,
      message: 'Import operation not found'
    });
  }
  
  const operation = importOperations[importId];
  
  return res.status(200).json({
    success: true,
    status: operation.status,
    startTime: operation.startTime,
    endTime: operation.endTime,
    importedCount: operation.importedCount,
    message: operation.status === 'error' ? operation.error : undefined
  });
};