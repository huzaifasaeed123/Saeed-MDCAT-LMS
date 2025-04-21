const express = require('express');
const { check } = require('express-validator');
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  updateProfile
} = require('../controllers/userController');

const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

const router = express.Router();

// User creation validation
const userValidation = [
  check('fullName', 'Full name is required').not().isEmpty(),
  check('email', 'Please include a valid email').isEmail(),
  check('contactNumber', 'Please include a valid contact number').matches(/^\+?[0-9]{10,14}$/),
  check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
  check('role', 'Role must be either student, teacher, or admin').isIn(['student', 'teacher', 'admin'])
];


// User can update their own profile
router.put('/profile', protect, updateProfile);

// Apply protection to all routes
router.use(protect);

// Routes for admin only
router
  .route('/')
  .get(authorize('admin'), getUsers)
  .post(authorize('admin'), userValidation, createUser);

router
  .route('/:id')
  .get(authorize('admin'), getUser)
  .put(authorize('admin'), updateUser)
  .delete(authorize('admin'), deleteUser);

module.exports = router;