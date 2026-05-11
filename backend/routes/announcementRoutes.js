const express        = require('express');
const { protect }    = require('../middleware/auth');
const { authorize }  = require('../middleware/roleCheck');

const {
  getAnnouncements,
  markSeen,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  togglePin,
} = require('../controllers/announcementController');

const router = express.Router();
router.use(protect);

// Reads — every authenticated user
router.get('/',          getAnnouncements);
router.put('/seen',      markSeen);

// Mutations — admin + teacher only
const staff = authorize('admin', 'teacher');
router.post('/',          staff, createAnnouncement);
router.put('/:id',        staff, updateAnnouncement);
router.delete('/:id',     staff, deleteAnnouncement);
router.put('/:id/pin',    staff, togglePin);

module.exports = router;
