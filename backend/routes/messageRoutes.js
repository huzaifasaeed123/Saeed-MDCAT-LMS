const express = require('express');
const {
  getConversations, startConversation,
  getMessages, sendMessage, markConversationRead,
  searchUsers,
  createBroadcast,
} = require('../controllers/messageController');
const { protect }   = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

const router = express.Router();

router.use(protect);

router.get('/conversations',               getConversations);
router.post('/conversations',              startConversation);
router.get('/conversations/:id/messages',  getMessages);
router.post('/conversations/:id/messages', sendMessage);
router.put('/conversations/:id/read',      markConversationRead);

router.get('/users', searchUsers);

router.post('/broadcast', authorize('admin'), createBroadcast);

module.exports = router;
