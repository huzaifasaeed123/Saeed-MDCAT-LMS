const express = require('express');
const { protect }   = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

const {
  getTree,
  adminListTopics, adminListUnits,
  createTopic, updateTopic, deleteTopic,
  renameUnit, deleteUnit,
  bulkImport,
} = require('../controllers/syllabusController');

const {
  getMyProgress,
  startTopic, reviewTopic, masterTopic,
  setLecture, setBook, setMcqs,
} = require('../controllers/syllabusProgressController');

const { getToday, getWeek } = require('../controllers/syllabusTodayController');

const {
  listTodos, createTodo, updateTodo, deleteTodo, seedTodo,
} = require('../controllers/syllabusTodoController');

const {
  listNotes, createNote, updateNote, deleteNote,
} = require('../controllers/syllabusNotesController');

const router = express.Router();
router.use(protect);
const staff = authorize('admin', 'teacher');

// ── Public tree (cached) ────────────────────────────────────────────────────
router.get('/tree', getTree);

// ── Student: progress / Today / Week ────────────────────────────────────────
router.get('/me/progress',                          getMyProgress);
router.get('/me/today',                             getToday);
router.get('/me/week',                              getWeek);

router.post('/me/progress/:topicId/start',          startTopic);
router.post('/me/progress/:topicId/review',         reviewTopic);
router.post('/me/progress/:topicId/master',         masterTopic);

router.post('/me/topic/:id/lecture',                setLecture);
router.post('/me/topic/:id/book',                   setBook);
router.post('/me/topic/:id/mcqs',                   setMcqs);

// ── Student: daily TO-DO ────────────────────────────────────────────────────
router.get('/me/todo',                              listTodos);
router.post('/me/todo',                             createTodo);
router.patch('/me/todo/:id',                        updateTodo);
router.delete('/me/todo/:id',                       deleteTodo);
router.post('/me/todo/seed',                        seedTodo);

// ── Student: sticky notes ───────────────────────────────────────────────────
router.get('/me/notes',                             listNotes);
router.post('/me/notes',                            createNote);
router.patch('/me/notes/:id',                       updateNote);
router.delete('/me/notes/:id',                      deleteNote);

// ── Admin / teacher: catalog management ─────────────────────────────────────
router.get('/admin/topics',                         staff, adminListTopics);
router.get('/admin/units',                          staff, adminListUnits);
router.post('/admin/topics',                        staff, createTopic);
router.patch('/admin/topics/:id',                   staff, updateTopic);
router.delete('/admin/topics/:id',                  staff, deleteTopic);
router.patch('/admin/units/:subject/:unitNumber',   staff, renameUnit);
router.delete('/admin/units/:subject/:unitNumber',  staff, deleteUnit);
router.post('/admin/import',                        staff, bulkImport);

module.exports = router;
