const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { getLeaderboard, getSubjectList } = require('../controllers/leaderboardController');

router.use(protect);

router.get('/',        getLeaderboard);   // ?type=alltime|weekly|monthly|mostimproved|subject&subjectTitle=biology
router.get('/subjects', getSubjectList);  // returns list of subject titles with active boards

module.exports = router;
