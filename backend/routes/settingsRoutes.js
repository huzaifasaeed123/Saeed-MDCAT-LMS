const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { getSettings, updateSettings } = require('../controllers/settingsController');

router.get('/', protect, getSettings);
router.put('/', protect, authorize('admin'), updateSettings);

module.exports = router;
