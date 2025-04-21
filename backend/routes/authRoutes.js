const express = require('express');
const { check } = require('express-validator');
const { 
  register, 
  login, 
  logout, 
  getMe,
  googleAuthGIS,
  refreshToken
} = require('../controllers/authController');
const passport = require('passport');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Registration validation
const registerValidation = [
  check('fullName', 'Full name is required').not().isEmpty(),
  check('email', 'Please include a valid email').isEmail(),
  check('contactNumber')
  // ↳ skip if undefined, null, or empty string:
  .optional({ nullable: true, checkFalsy: true })
  // ↳ otherwise enforce your regex:
  .matches(/^\+?[0-9]{10,14}$/)
  .withMessage('Please include a valid contact number'),
  check('password', 'Password must be at least 6 characters').isLength({ min: 6 })
];

// Login validation
const loginValidation = [
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password is required').exists()
];

// Routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/logout', logout);
router.get('/me', protect, getMe);
router.post('/refresh-token', refreshToken);

// Google OAuth routes
router.post('/google', googleAuthGIS);
// router.get(
//   '/google',
//   passport.authenticate('google', { scope: ['profile', 'email'] })
// );

// router.get(
//   '/google/callback',
//   passport.authenticate('google', { 
//     failureRedirect: '/login',
//     session: false 
//   }),
//   googleCallback
// );

module.exports = router;