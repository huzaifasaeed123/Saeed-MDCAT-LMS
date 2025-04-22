// Place this file in: routes/uploadRoutes.js

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadImage } = require('../controllers/uploadController');

// Protect the upload route (only authenticated users can upload)
router.use(protect);

// Image upload route
router.post('/upload-image', uploadImage);

module.exports = router;