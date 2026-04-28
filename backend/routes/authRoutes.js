const express = require('express');
const { check } = require('express-validator');
const {
  register, login, logout, getMe,
  googleAuthGIS, refreshToken,
  forgotPassword, resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

const registerValidation = [
  check('fullName',      'Full name is required').not().isEmpty(),
  check('email',         'Please include a valid email').isEmail(),
  check('contactNumber', 'Please include a valid contact number (10–14 digits)').matches(/^\+?[0-9]{10,14}$/),
  check('password',      'Password must be at least 6 characters').isLength({ min: 6 }),
];

const loginValidation = [
  check('email',    'Please include a valid email').isEmail(),
  check('password', 'Password is required').exists(),
];

// Auth
router.post('/register',       registerValidation, register);
router.post('/login',          loginValidation,    login);
router.post('/logout',                             logout);
router.get( '/me',             protect,            getMe);
router.post('/refresh-token',                      refreshToken);

// Google Identity Services
router.post('/google', googleAuthGIS);

// Forgot / reset password
router.post('/forgot-password',        forgotPassword);
router.post('/reset-password/:token',  resetPassword);

module.exports = router;
