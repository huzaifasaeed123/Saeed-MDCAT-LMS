const Course = require('../models/CourseModel');
const UserTestAttempt = require('../models/UserTestAttempt');
const CourseProgress  = require('../models/CourseProgress');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const courseCache = require('../utils/courseCache');

// Walks a populated course doc and returns the full set of resource ids
// (and the subset that are test resources). Used by progress endpoints to
// (a) filter orphan completions and (b) compute total denominator for %.
const collectAllResourceIds = (course) => {
  const all = [];
  const tests = []; // { resourceId, testId }
  const push = (r) => {
    if (!r._id) return;
    all.push(String(r._id));
    if (r.type === 'test' && r.testId) {
      tests.push({ resourceId: String(r._id), testId: String(r.testId._id || r.testId) });
    }
  };
  for (const subject of (course.subjects || [])) {
    for (const r of (subject.resources || [])) push(r);
    for (const chapter of (subject.chapters || [])) {
      for (const r of (chapter.resources || [])) push(r);
      for (const topic of (chapter.topics || [])) {
        for (const r of (topic.resources || [])) push(r);
      }
    }
  }
  return { all, tests };
};

// Walk + count resources from a populated course doc. Returned shape is
// flat so the client doesn't have to traverse the tree itself. Also returns
// the list of test ids so the progress endpoint can intersect against
// the user's completed attempts without re-walking.
const summariseCourse = (course) => {
  const counts = { subjects: 0, chapters: 0, topics: 0, videos: 0, tests: 0, notes: 0, external: 0 };
  const testIds = [];
  counts.subjects = (course.subjects || []).length;
  const collect = (r) => {
    if (r.type === 'lecture')       counts.videos++;
    else if (r.type === 'notes')    counts.notes++;
    else if (r.type === 'test')     { counts.tests++; if (r.testId) testIds.push(String(r.testId._id || r.testId)); }
    else if (r.type === 'external') counts.external++;
  };
  for (const subject of (course.subjects || [])) {
    for (const r of (subject.resources || [])) collect(r);
    counts.chapters += (subject.chapters || []).length;
    for (const chapter of (subject.chapters || [])) {
      for (const r of (chapter.resources || [])) collect(r);
      counts.topics += (chapter.topics || []).length;
      for (const topic of (chapter.topics || [])) {
        for (const r of (topic.resources || [])) collect(r);
      }
    }
  }
  return { counts, testIds };
};

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

    // External-test display metadata. All optional; pass-through so
    // admin edits on the modal persist round-trip. Syllabus is stripped
    // to the minimal shape `{ subject, chapters }` even if the form
    // sent extra fields, and clamped to 5 entries server-side as a
    // belt-and-suspenders match for the admin UI's hard cap.
    externalMcqCount:    Number(r.externalMcqCount)    > 0 ? Number(r.externalMcqCount)    : 0,
    externalDurationMin: Number(r.externalDurationMin) > 0 ? Number(r.externalDurationMin) : 0,
    externalTestType:    String(r.externalTestType || ''),
    externalStartAt:     r.externalStartAt || null,
    externalEndAt:       r.externalEndAt   || null,
    externalSyllabus: Array.isArray(r.externalSyllabus)
      ? r.externalSyllabus
          .slice(0, 5)
          .map((s) => ({
            subject:  String(s?.subject || '').trim(),
            chapters: Array.isArray(s?.chapters)
              ? s.chapters.map((c) => String(c || '').trim()).filter(Boolean)
              : [],
          }))
          .filter((s) => s.subject)
      : [],
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
// GET /api/courses/:id
// Returns the STATIC course data (tree + resource counts). Per-user progress
// is intentionally NOT computed here — fetch /:id/progress in parallel for
// that. Splitting the two lets us cache the heavy course doc in memory and
// only pay DB cost when the user's attempt history changes.
// Shared course loader — used by BOTH the read endpoint (`getCourse`) and the
// progress endpoints (`loadCourseForProgress`). It MUST emit a single
// superset shape because both call sites pass through `courseCache.getOrLoad`
// keyed by courseId — whichever endpoint hits first wins the cache slot, so
// the shape has to satisfy every consumer. The earlier split shapes meant a
// student opening the course page first would seed the cache without
// `_allResourceIds`, then `markResourceComplete` would later see it as
// `undefined`, treat every id as missing, and return "Resource not found in
// this course" — even for resources that were genuinely there.
//
// We populate `testId` with the fields the get-course response needs
// (title/subjects/chapters/topics) so the progress path is a superset.
const loadCourseFull = async (courseId) => {
  return courseCache.getOrLoad(courseId, async () => {
    const course = await Course.findById(courseId)
      .populate('createdBy', 'fullName')
      // Pull in `reviewUnlockAt` + `createdBy` so the Course Player can
      // gate its own "Review answers" button without an extra GET /tests/:id
      // round-trip per click. The course doc is already cached, so these
      // ride along for free; admin Test edits invalidate the course cache
      // via the Test→Course coupling so the values stay reasonably fresh.
      .populate('subjects.resources.testId',                'title subjects chapters topics reviewUnlockAt createdBy')
      .populate('subjects.chapters.resources.testId',       'title subjects chapters topics reviewUnlockAt createdBy')
      .populate('subjects.chapters.topics.resources.testId','title subjects chapters topics reviewUnlockAt createdBy')
      .lean();
    if (!course) return null;
    const { counts, testIds } = summariseCourse(course);
    const { all, tests } = collectAllResourceIds(course);
    return {
      ...course,
      resourceCounts:    counts,
      testCount:         testIds.length,
      _testIds:          testIds,
      _allResourceIds:   all,
      _testResourceMap:  tests,  // [{ resourceId, testId }]
    };
  });
};

exports.getCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const cached = await loadCourseFull(id);

    if (!cached) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Strip internal-only fields before sending — clients don't need them
    // and shipping them widens the API surface unnecessarily.
    const { _testIds, _allResourceIds, _testResourceMap, ...payload } = cached;
    res.json({ success: true, data: payload });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── Progress helpers ───────────────────────────────────────────────────────
// Thin alias — `loadCourseFull` already returns everything the progress
// endpoints need (resource id catalogue + test map). Kept as a named export
// so the existing call sites read clearly.
const loadCourseForProgress = loadCourseFull;

// Compute the per-user completed-resource set: manual ∪ auto-derived tests,
// filtered against the course's current resource list so orphans drop out.
//
// Also returns `latestAttemptByResource`: a map of test-resource → latest
// (completed OR in-progress) UserTestAttempt._id. The course player uses this
// to deep-link to the result view when the student re-opens a test they've
// already taken — same as the standalone Test Start page does, but driven by
// data rather than a second client round-trip.
const computeCompletedResourceIds = async (course, userId) => {
  if (!userId) return [];
  const allowed = new Set(course._allResourceIds || []);

  // Manual completions
  const progressDoc = await CourseProgress.findOne({
    user: userId, course: course._id,
  }).select('completedResourceIds lastResourceId lastViewedAt').lean();
  const manual = (progressDoc?.completedResourceIds || [])
    .map(String)
    .filter((id) => allowed.has(id));

  // Auto-derived test completions + latest-attempt mapping.
  //
  // ONE DB query, then two passes in memory:
  //   • latestCompletedByTestId — newest *completed* attempt per test. This
  //     is what `latestAttemptByResource` exposes, so re-opening a test you
  //     finished always lands on the Result view (with that latest pass).
  //   • latestAnyByTestId       — newest attempt of any status. Used as a
  //     fallback ONLY when the user has never completed the test (e.g. they
  //     paused mid-way) so the player can deep-link to the in-progress
  //     attempt instead of a fresh Start.
  //
  // Bug this replaces: the previous version checked the latest-of-any-status
  // attempt. If a student completed a test (attempt A) and then started a
  // retake which they didn't finish (attempt B = in-progress, newer), the
  // resource silently stopped counting as done — the sidebar tick
  // disappeared and the player jumped back to TestStartPage. Now any
  // completed attempt sticks the resource as done forever.
  const testMap = course._testResourceMap || [];
  let autoTest = [];
  const latestAttemptByResource = {};
  if (testMap.length > 0) {
    const testIds = testMap.map((t) => t.testId);
    const rows = await UserTestAttempt.find({
      user: userId,
      test: { $in: testIds },
    })
      .select('_id test status endTime updatedAt')
      .sort({ updatedAt: -1 }) // newest first
      .lean();

    const latestCompletedByTestId = new Map();
    const latestAnyByTestId       = new Map();
    for (const r of rows) {
      const k = String(r.test);
      if (!latestAnyByTestId.has(k)) latestAnyByTestId.set(k, r);
      if (r.status === 'completed' && !latestCompletedByTestId.has(k)) {
        latestCompletedByTestId.set(k, r);
      }
    }

    const completedSet = new Set();
    for (const t of testMap) {
      const completed = latestCompletedByTestId.get(t.testId);
      const any       = latestAnyByTestId.get(t.testId);

      // Prefer the latest completed attempt for display — that's the "result"
      // a student wants to see when reopening a finished test. Sidebar tick
      // follows the same rule (any completed attempt ⇒ done).
      if (completed) {
        latestAttemptByResource[t.resourceId] = {
          attemptId: String(completed._id),
          status:    'completed',
        };
        completedSet.add(t.resourceId);
      } else if (any) {
        // No completed attempt yet — surface whatever they have so the
        // player can route to the in-progress attempt if needed.
        latestAttemptByResource[t.resourceId] = {
          attemptId: String(any._id),
          status:    any.status,
        };
      }
    }
    autoTest = [...completedSet];
  }

  const merged = new Set([...manual, ...autoTest]);
  return {
    completedResourceIds:    [...merged],
    manualCount:             manual.length,
    autoTestCount:           autoTest.length,
    latestAttemptByResource, // { [resourceId]: { attemptId, status } }
    lastResourceId:          progressDoc?.lastResourceId ? String(progressDoc.lastResourceId) : null,
    lastViewedAt:            progressDoc?.lastViewedAt || null,
  };
};

// GET /api/courses/:id/progress
// Per-user, hot. Returns the unified completion set + last-viewed pointer.
exports.getCourseProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await loadCourseForProgress(id);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const userId = req.user?._id;
    const {
      completedResourceIds, manualCount, autoTestCount,
      latestAttemptByResource, lastResourceId, lastViewedAt,
    } = await computeCompletedResourceIds(course, userId);

    const total       = (course._allResourceIds || []).length;
    const completed   = completedResourceIds.length;
    const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

    res.json({
      success: true,
      data: {
        courseId:             id,
        totalResources:       total,
        completedCount:       completed,
        completedResourceIds,
        manualCount,
        autoTestCount,
        // Per-test-resource latest attempt — { [resourceId]: { attemptId, status } }.
        // Empty when the user has never touched a test in this course. Used
        // by the Course Player to decide whether to mount TestStartPage or
        // jump straight into TestResultPage (same UX as the standalone Test
        // Start page does internally).
        latestAttemptByResource: latestAttemptByResource || {},
        // Legacy fields kept so existing dashboard / catalog callers don't
        // need to migrate. testCount + attemptedTestCount continue to track
        // ONLY the test-shaped resources.
        testCount:            course._testIds?.length || 0,
        attemptedTestCount:   autoTestCount,
        progressPct,
        lastResourceId,
        lastViewedAt,
        resourceCounts:       course.resourceCounts,
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// POST /api/courses/:id/progress/resource/:resourceId
// Manual mark complete (videos / notes / external). Idempotent via $addToSet.
// Test resources reject — they're driven by UserTestAttempt only.
exports.markResourceComplete = async (req, res) => {
  try {
    const { id, resourceId } = req.params;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });
    if (!mongoose.Types.ObjectId.isValid(resourceId)) {
      return res.status(400).json({ success: false, message: 'Invalid resourceId' });
    }

    const course = await loadCourseForProgress(id);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    // Guard: must be a resource that actually belongs to this course, and
    // must NOT be a test resource (those are auto-tracked).
    if (!(course._allResourceIds || []).includes(String(resourceId))) {
      return res.status(404).json({ success: false, message: 'Resource not found in this course' });
    }
    const isTest = (course._testResourceMap || []).some((t) => t.resourceId === String(resourceId));
    if (isTest) {
      return res.status(400).json({
        success: false,
        message: 'Test resources are auto-marked when you complete the test',
      });
    }

    await CourseProgress.updateOne(
      { user: userId, course: id },
      { $addToSet: { completedResourceIds: resourceId } },
      { upsert: true },
    );

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE /api/courses/:id/progress/resource/:resourceId
exports.unmarkResourceComplete = async (req, res) => {
  try {
    const { id, resourceId } = req.params;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    await CourseProgress.updateOne(
      { user: userId, course: id },
      { $pull: { completedResourceIds: resourceId } },
    );
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/courses/:id/progress/last
// Body: { resourceId }
// Fired (debounced) by the player when the user opens a resource. Powers
// "Continue Learning" on the overview + last-watched widget elsewhere.
exports.updateLastViewed = async (req, res) => {
  try {
    const { id } = req.params;
    const { resourceId } = req.body || {};
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });
    if (!resourceId || !mongoose.Types.ObjectId.isValid(resourceId)) {
      return res.status(400).json({ success: false, message: 'resourceId required' });
    }

    const course = await loadCourseForProgress(id);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    if (!(course._allResourceIds || []).includes(String(resourceId))) {
      return res.status(404).json({ success: false, message: 'Resource not in this course' });
    }

    await CourseProgress.updateOne(
      { user: userId, course: id },
      { $set: { lastResourceId: resourceId, lastViewedAt: new Date() } },
      { upsert: true },
    );
    res.json({ success: true });
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
    // New course → bust the catalog cache so /courses sees it on next read.
    // Per-course cache is empty by definition for the freshly created id.
    courseCache.invalidateList();
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
    // Course doc changed — drop both per-course and list caches. Next read
    // rebuilds from DB (with the populated tree + recomputed summary).
    courseCache.invalidate(req.params.id);
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
    courseCache.invalidate(req.params.id);
    res.json({ success: true, message: 'Course deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
