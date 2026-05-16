const express = require('express');
const { protect }   = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { requireFeature } = require('../middleware/featureGate');

const {
  getPosts, createPost, updatePost, deletePost,
  pinPost, savePost, votePoll,
  getLeaderboardData, refreshLeaderboard, getStaffPerformance,
} = require('../controllers/postController');

const {
  getReplies, createReply, updateReply, deleteReply,
  markAnswer, toggleHelpful,
} = require('../controllers/replyController');

const {
  getNotifications, markAllRead, markOneRead,
} = require('../controllers/notificationController');

const router = express.Router();
router.use(protect);

// Notifications endpoints are bell-driven UI plumbing — must work even if the
// student has no community access (admin DMs, system notifications, etc.).
// Wire them up BEFORE the community feature gate.
router.get('/notifications',           getNotifications);
router.put('/notifications/read',      markAllRead);
router.put('/notifications/:id/read',  markOneRead);

// Leaderboard is a global feature (available to all roles per existing nav).
// Keep it OUTSIDE the community gate so it stays accessible.
router.get('/leaderboard',          getLeaderboardData);
router.post('/leaderboard/refresh', refreshLeaderboard);

// Feature gate — community posts & replies require 'community' access.
router.use(requireFeature('community'));

// Posts
router.get('/posts',          getPosts);
router.post('/posts',         createPost);
router.put('/posts/:id',      updatePost);
router.delete('/posts/:id',   deletePost);
router.put('/posts/:id/pin',  authorize('admin', 'teacher'), pinPost);
router.put('/posts/:id/save', savePost);
router.post('/posts/:id/vote', votePoll);

// Replies
router.get('/posts/:id/replies',  getReplies);
router.post('/posts/:id/replies', createReply);
router.put('/replies/:id',        updateReply);
router.delete('/replies/:id',     deleteReply);
router.put('/replies/:id/answer', authorize('admin', 'teacher'), markAnswer);
router.put('/replies/:id/helpful', toggleHelpful);

// (Notifications and Leaderboard endpoints are mounted ABOVE the community
// feature gate so they stay accessible to all authenticated users.)

// Staff performance — admin only
router.get('/staff-performance', authorize('admin'), getStaffPerformance);

module.exports = router;
