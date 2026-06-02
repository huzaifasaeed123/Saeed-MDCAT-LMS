// Place this file in: controllers/uploadController.js

const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { saveImageBuffer } = require('../services/storageService');

// Buffer the file in memory; storageService decides where it lands (S3 or disk).
const storage = multer.memoryStorage();

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images are allowed.'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
}).single('image');

// Image upload handler
exports.uploadImage = (req, res) => {
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      // Multer error (file too large, etc.)
      return res.status(400).json({
        success: false,
        message: err.message
      });
    } else if (err) {
      // Other errors
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

    try {
      // Routed to S3 when enabled, else local uploads/images. Returns the
      // public URL (absolute S3 URL or relative /uploads/images/... path).
      const filename = `${uuidv4()}${path.extname(req.file.originalname)}`;
      const fileUrl = await saveImageBuffer(req.file.buffer, {
        folder: 'images',
        filename,
        contentType: req.file.mimetype,
      });
      res.status(200).json({
        success: true,
        url: fileUrl,
        id: filename,
      });
    } catch (e) {
      res.status(500).json({ success: false, message: 'Failed to store image' });
    }
  });
};