// File: utils/validation.js

const { body, validationResult } = require('express-validator');

exports.validateMCQ = [
  body('questionText').notEmpty().withMessage('Question text is required'),
  body('options').isArray({ min: 2 }).withMessage('At least 2 options are required'),
  body('options.*.optionText').notEmpty().withMessage('Option text is required'),
  body('options.*.optionLetter').isIn(['A', 'B', 'C', 'D', 'E']).withMessage('Invalid option letter'),
  body('testId').notEmpty().withMessage('Test ID is required'),
  body('difficulty').optional().isIn(['Easy', 'Medium', 'Hard']).withMessage('Difficulty must be Easy, Medium, or Hard'),
  body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean value'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    next();
  }
];

exports.validateTest = [
  body('title').notEmpty().withMessage('Title is required'),
  body('session').notEmpty().withMessage('Session is required'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('unit').notEmpty().withMessage('Unit is required'),
  body('topic').notEmpty().withMessage('Topic is required'),
  body('duration').isNumeric().withMessage('Duration must be a number'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    next();
  }
];