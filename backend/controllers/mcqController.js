// File: controllers/mcqController.js

const MCQ = require('../models/McqModel');
const Test = require('../models/TestModel');

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