const express        = require('express');
const { protect }    = require('../middleware/auth');
const { authorize }  = require('../middleware/roleCheck');
const { requireFeature } = require('../middleware/featureGate');

const {
  getContents,
  createFolder, renameFolder, deleteFolder,
  createFile,   renameFile,   deleteFile,
  importDrive,
  getFileView,
  getViewToken,
  getDriveToken,
} = require('../controllers/notesController');

const router = express.Router();

// Tag every request through this router as section='notes'.
router.use((req, _res, next) => { req.section = 'notes'; next(); });

// All routes require a valid JWT session.
// NOTE: stream endpoint is mounted in app.js before uploadRoutes.
router.use(protect);

// Feature gate — students need explicit 'notes' access; staff bypass.
router.use(requireFeature('notes'));

// Reads — any authenticated user
router.get('/contents',            getContents);
router.get('/files/:id/view',      getFileView);
router.get('/files/:id/viewtoken',  getViewToken);
router.get('/files/:id/drivetoken', getDriveToken);

// Mutations — admin + teacher only
const staff = authorize('admin', 'teacher');

router.post('/folders',            staff, createFolder);
router.put('/folders/:id',         staff, renameFolder);
router.delete('/folders/:id',      staff, deleteFolder);

router.post('/files',              staff, createFile);
router.put('/files/:id',           staff, renameFile);
router.delete('/files/:id',        staff, deleteFile);

router.post('/import-drive',       staff, importDrive);

module.exports = router;
