// Place this file in: controllers/testController.js

const Test = require('../models/TestModel');
const MCQ = require('../models/McqModel');

// Create new test
exports.createTest = async (req, res) => {
  try {
    const testData = {
      ...req.body,
      createdBy: req.user._id
    };

    const test = await Test.create(testData);
    
    res.status(201).json({
      success: true,
      data: test
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get all tests
exports.getTests = async (req, res) => {
  try {
    const query = {};
    
    // Add filters if provided
    if (req.query.session) query.session = req.query.session;
    if (req.query.subject) query.subject = req.query.subject;
    if (req.query.unit) query.unit = req.query.unit;
    if (req.query.topic) query.topic = req.query.topic;
    
    const tests = await Test.find(query)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: tests.length,
      data: tests
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get single test with MCQs
exports.getTest = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id)
      .populate('createdBy', 'name')
      .populate('mcqs');
    
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: test
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Update test
exports.updateTest = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }
    
    // Only allow creator to update
    // if (test.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Not authorized to update this test'
    //   });
    // }
    
    const updatedTest = await Test.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );
    
    res.status(200).json({
      success: true,
      data: updatedTest
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Delete test
exports.deleteTest = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }
    
    // Only allow creator to delete
    // if (test.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Not authorized to delete this test'
    //   });
    // }
    
    // Delete all MCQs associated with this test,We Need To review This Decision as per need
    await MCQ.deleteMany({ testId: test._id });
    
    await test.deleteOne();
    
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

// Publish test
exports.publishTest = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }
    
    if (test.mcqs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot publish test with no MCQs'
      });
    }
    
    test.status = 'published';
    test.isPublished = true;
    await test.save();
    
    res.status(200).json({
      success: true,
      data: test
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};