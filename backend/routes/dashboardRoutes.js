const express = require('express');
const { protect } = require('../middleware/auth');
const { getSummary, refreshSummary } = require('../controllers/dashboardController');

const router = express.Router();
router.use(protect);

// One endpoint, role-aware response. Per-user cache for students/teachers
// (3 min TTL), single global cache for admins (15 min TTL).
router.get('/summary',          getSummary);
router.post('/summary/refresh', refreshSummary);

module.exports = router;
