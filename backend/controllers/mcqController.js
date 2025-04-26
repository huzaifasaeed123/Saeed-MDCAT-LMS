// File: controllers/mcqController.js
const MCQ = require('../models/McqModel');
const Test = require('../models/TestModel');
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
exports.getMCQsForTest = async (req, res) => {
  try {
    const { testId } = req.params;
    const mcqs = await MCQ.find({ testId }).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: mcqs.length,
      data: mcqs
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
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
    fileSize: 10 * 1024 * 1024 // 100 MB
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
    
    const { testId } = req.body;
    if (!testId) {
      // Clean up the uploaded file
      fs.unlinkSync(req.file.path);
      
      return res.status(400).json({
        success: false,
        message: 'Test ID is required'
      });
    }
    
    try {
      // Check if test exists
      const test = await Test.findById(testId);
      if (!test) {
        // Clean up the uploaded file
        fs.unlinkSync(req.file.path);
        
        return res.status(404).json({
          success: false,
          message: 'Test not found'
        });
      }
      
      // Generate a unique import ID
      const importId = uuidv4();
      
      // Get additional MCQ information from request body
      const mcqInfo = {
        author: req.body.author || req.user.fullName || 'Document Import',
        subject: req.body.subject || test.subject || '',
        unit: req.body.unit || test.unit || '',
        topic: req.body.topic || test.topic || '',
        subTopic: req.body.subTopic || test.subTopic || '',
        session: req.body.session || test.session || '',
        difficulty: req.body.difficulty || 'Medium',
        isPublic: req.body.isPublic === 'true' || req.body.isPublic === true,
        published: false // Default to unpublished
      };
      
      // Store import operation info
      importOperations[importId] = {
        status: 'processing',
        file: req.file.path,
        testId,
        mcqInfo,
        startTime: new Date(),
        importedCount: 0
      };
      
      // Start extraction process in the background
      processDocument(importId, req.file.path, testId, test, mcqInfo);
      
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
    
    // Update test with new MCQs
    const mcqIds = importedMcqs.map(mcq => mcq._id);
    test.mcqs.push(...mcqIds);
    test.totalQuestions = test.mcqs.length;
    await test.save();
    
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

/**
 * Get import operation status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
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