const express = require('express');
const { protect }   = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

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

// Notifications
router.get('/notifications',           getNotifications);
router.put('/notifications/read',      markAllRead);
router.put('/notifications/:id/read',  markOneRead);

// Leaderboard
router.get('/leaderboard',          getLeaderboardData);
router.post('/leaderboard/refresh', refreshLeaderboard);

// Staff performance — admin only
router.get('/staff-performance', authorize('admin'), getStaffPerformance);

module.exports = router;
