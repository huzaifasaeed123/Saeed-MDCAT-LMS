const Course = require('../models/CourseModel');
const UserTestAttempt = require('../models/UserTestAttempt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Walk a course's subjects/chapters/topics tree and collect every embedded
// test resource's testId. Used by the catalog endpoint to compute testCount
// and per-user progress without an extra round-trip.
const collectCourseTestIds = (course) => {
  const ids = [];
  for (const subject of (course.subjects || [])) {
    for (const r of (subject.resources || [])) {
      if (r.type === 'test' && r.testId) ids.push(String(r.testId));
    }
    for (const chapter of (subject.chapters || [])) {
      for (const r of (chapter.resources || [])) {
        if (r.type === 'test' && r.testId) ids.push(String(r.testId));
      }
      for (const topic of (chapter.topics || [])) {
        for (const r of (topic.resources || [])) {
          if (r.type === 'test' && r.testId) ids.push(String(r.testId));
        }
      }
    }
  }
  return ids;
};

// ─── Multer: Feature Image ────────────────────────────────────────────────────

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/courses');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  },
});

const imageUpload = multer({
  storage: imageStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, png, gif, webp)'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single('featureImage');

// ─── Multer: PDF Notes ────────────────────────────────────────────────────────

const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/notes');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  },
});

const pdfUpload = multer({
  storage: pdfStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
}).single('pdf');

// ─── Upload handlers ──────────────────────────────────────────────────────────

exports.uploadFeatureImage = (req, res) => {
  imageUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const url = `/uploads/courses/${req.file.filename}`;
    res.json({ success: true, url });
  });
};

exports.uploadPdf = (req, res) => {
  pdfUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const url = `/uploads/notes/${req.file.filename}`;
    res.json({ success: true, url, fileName: req.file.originalname });
  });
};

// ─── Content cleaner ─────────────────────────────────────────────────────────
// Strips _tmpId (frontend-only temp keys) and preserves real MongoDB _id values
// so embedded subdocuments can be saved without CastError.

const mongoose = require('mongoose');

const isRealId = (id) => id && mongoose.Types.ObjectId.isValid(id) && !String(id).startsWith('tmp_');

const cleanResource = (r) => {
  const out = {
    type: r.type || 'lecture',
    title: r.title || '',
    testId: r.testId || null,
    fileUrl: r.fileUrl || '',
    fileName: r.fileName || '',
    youtubeUrl: r.youtubeUrl || '',
    externalUrl: r.externalUrl || '',
    driveFileId: r.driveFileId || '',
    availability: r.availability || 'public',
    unlockAt: r.unlockAt || null,
    lockAt: r.lockAt || null,
    order: typeof r.order === 'number' ? r.order : 0,
  };
  if (isRealId(r._id)) out._id = r._id;
  return out;
};

const cleanTopic = (t) => {
  const out = {
    title: t.title || '',
    order: typeof t.order === 'number' ? t.order : 0,
    resources: (t.resources || []).map(cleanResource),
  };
  if (isRealId(t._id)) out._id = t._id;
  return out;
};

const cleanChapter = (c) => {
  const out = {
    title: c.title || '',
    order: typeof c.order === 'number' ? c.order : 0,
    useTopics: Boolean(c.useTopics),
    topics: (c.topics || []).map(cleanTopic),
    resources: (c.resources || []).map(cleanResource),
  };
  if (isRealId(c._id)) out._id = c._id;
  return out;
};

const cleanSubjects = (subjects = []) =>
  subjects.map((s) => {
    const out = {
      title:        s.title || '',
      order:        typeof s.order === 'number' ? s.order : 0,
      unlockAt:     s.unlockAt     || null,
      lockAt:       s.lockAt       || null,
      useSubGroups: Boolean(s.useSubGroups),
      resources:    (s.resources || []).map(cleanResource),
      chapters:     (s.chapters  || []).map(cleanChapter),
    };
    if (isRealId(s._id)) out._id = s._id;
    return out;
  });

// ─── CRUD ─────────────────────────────────────────────────────────────────────

// GET /api/courses  — student catalog list.
// Pulls subjects so we can compute testCount per course in JS, then strips
// them from the response (clients don't need the full tree here). Progress %
// is derived from the user's completed test attempts using ONE batched query
// instead of N — fine for the typical course-catalog size.
exports.getCourses = async (req, res) => {
  try {
    const courses = await Course.find()
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 })
      .lean();

    // Compute testIds per course before stripping subjects.
    const enriched = courses.map((c) => {
      const testIds = collectCourseTestIds(c);
      delete c.subjects;
      return { ...c, _testIds: testIds, testCount: testIds.length };
    });

    // Fetch the current user's completed test attempts in a single query,
    // then compute per-course attempted counts via Set intersection.
    let attempted = new Set();
    if (req.user?._id) {
      const allTestIds = new Set(enriched.flatMap((c) => c._testIds));
      if (allTestIds.size > 0) {
        const rows = await UserTestAttempt.find({
          user:   req.user._id,
          status: 'completed',
          test:   { $in: Array.from(allTestIds) },
        }).select('test').lean();
        attempted = new Set(rows.map((r) => String(r.test)));
      }
    }

    const data = enriched.map((c) => {
      const total          = c.testCount;
      const attemptedCount = c._testIds.filter((id) => attempted.has(id)).length;
      const progressPct    = total > 0 ? Math.round((attemptedCount / total) * 100) : 0;
      delete c._testIds;
      return { ...c, attemptedTestCount: attemptedCount, progressPct };
    });

    res.json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// GET /api/courses/:id  — single course with full content
exports.getCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('createdBy', 'fullName')
      .populate('subjects.resources.testId',                'title subjects chapters topics')
      .populate('subjects.chapters.resources.testId',       'title subjects chapters topics')
      .populate('subjects.chapters.topics.resources.testId','title subjects chapters topics');

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    res.json({ success: true, data: course });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// POST /api/courses
exports.createCourse = async (req, res) => {
  try {
    const payload = { ...req.body, createdBy: req.user._id };
    if (payload.subjects) payload.subjects = cleanSubjects(payload.subjects);
    const course = await Course.create(payload);
    res.status(201).json({ success: true, data: course });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/courses/:id
exports.updateCourse = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.subjects) payload.subjects = cleanSubjects(payload.subjects);
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    );
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    res.json({ success: true, data: course });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE /api/courses/:id
exports.deleteCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    res.json({ success: true, message: 'Course deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
