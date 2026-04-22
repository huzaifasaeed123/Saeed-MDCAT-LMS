// File: controllers/mcqController.js
const MCQ = require('../models/McqModel');
const Test = require('../models/TestModel');
const mongoose = require('mongoose');
const { syncTestClassification } = require('./testController');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { extractMCQsFromDoc, convertToBackendFormat } = require('../utils/mcqDocParser');

// Create new MCQ
exports.createMCQ = async (req, res) => {
  try {
    const mcqData = {
      ...req.body,
      author: req.user.fullName,
    };

    const mcq = await MCQ.create(mcqData);
    
    // Update test with new MCQ
    const test = await Test.findById(req.body.testId);
    if (!test) {
      return res.status(404).json({ 
        success: false, 
        message: 'Test not found' 
      });
    }
    
    test.mcqs.push(mcq._id);
    test.totalQuestions = test.mcqs.length;
    await test.save();

    syncTestClassification(test._id).catch(console.error);

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

    // Primary: find MCQs that have testId pointing to this test
    let mcqs = await MCQ.find({ testId }).sort({ createdAt: 1 });

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
    
    // Using findByIdAndUpdate to update the MCQ
    const updatedMCQ = await MCQ.findByIdAndUpdate(
      req.params.id,
      updatedData,
      {
        new: true,
        runValidators: true
      }
    );
    
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
// Query: subjectId, chapterId, topicId (all optional — progressively narrower)
exports.getMCQsForQuestionBank = async (req, res) => {
  try {
    const { qbId } = req.params;
    const { subjectId, chapterId, topicId } = req.query;

    const filter = { questionBankId: new mongoose.Types.ObjectId(qbId) };
    if (topicId)        filter.qbTopicId   = new mongoose.Types.ObjectId(topicId);
    else if (chapterId) filter.qbChapterId = new mongoose.Types.ObjectId(chapterId);
    else if (subjectId) filter.qbSubjectId = new mongoose.Types.ObjectId(subjectId);

    const mcqs = await MCQ.find(filter).sort({ createdAt: 1 });
    res.status(200).json({ success: true, count: mcqs.length, data: mcqs });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// GET /api/mcqs/question-bank/:qbId/topic-counts
// Returns { [topicId]: count } for every topic in the QB
exports.getTopicCounts = async (req, res) => {
  try {
    const { qbId } = req.params;
    const agg = await MCQ.aggregate([
      { $match: { questionBankId: new mongoose.Types.ObjectId(qbId) } },
      { $group: { _id: '$qbTopicId', count: { $sum: 1 } } },
    ]);
    const counts = {};
    agg.forEach((r) => { if (r._id) counts[r._id.toString()] = r.count; });
    res.json({ success: true, data: counts });
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