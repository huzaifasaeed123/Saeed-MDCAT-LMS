// ── Feature-gate middleware ──────────────────────────────────────────────────
// Per-feature lock on the 5 student-facing modules. Staff (admin/teacher)
// always bypass — they need to be able to view & manage everything.
//
// Hot-path cost:
//   • cache HIT  → 0 DB queries (Map lookup + cheap object check)
//   • cache MISS → 1 indexed User.findById (only when TTL expired or after
//                  an admin write that invalidated this user's entry)
//
// Response shape on lock (so the frontend can render the lock page):
//   403 { success:false, code:'FEATURE_LOCKED', feature, message }
// The frontend's axios layer doesn't need any special handling — pages
// receive the 403, but the AuthContext already knows the user's access map,
// so most pages won't even attempt the API call: the FeatureGate wrapper
// renders the lock page before any request fires. This middleware is the
// SECOND line of defense, in case someone bypasses the UI.
// ─────────────────────────────────────────────────────────────────────────────

const userAccessCache = require('../utils/userAccessCache');

const FEATURE_LABELS = {
  autoTest:  'Auto Test Generator',
  courses:   'Courses',
  community: 'Community',
  videos:    'Videos',
  notes:     'Notes',
};

// Derived check for 'courses' — the student has the courses feature if
// either grant-all is on OR they have at least one specific course allowlisted.
// No separate master flag; this single rule is the source of truth.
const hasCoursesAccess = (access) =>
  !!access.coursesGrantAll || (access.courseAccess && access.courseAccess.size > 0);

// requireFeature('community') — middleware factory used like:
//   router.use(protect, requireFeature('community'));
exports.requireFeature = (feature) => async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const access = await userAccessCache.getOrLoad(req.user.id);
    if (!access) return res.status(401).json({ success: false, message: 'User not found' });

    // Staff bypass — admins and teachers always have access.
    if (access.role === 'admin' || access.role === 'teacher') return next();

    // 'courses' is special — derived from grant-all OR per-course allowlist.
    if (feature === 'courses') {
      if (hasCoursesAccess(access)) return next();
    } else if (access.featureAccess?.[feature]) {
      return next();
    }

    return res.status(403).json({
      success: false,
      code:    'FEATURE_LOCKED',
      feature,
      message: `Access to "${FEATURE_LABELS[feature] || feature}" is locked. Please contact the administrator to unlock this feature.`,
    });
  } catch (err) {
    console.error('requireFeature error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// requireCourseAccess — per-course access check. MUST be paired with
// requireFeature('courses') earlier in the chain so this middleware can
// assume the master toggle is on.
//
// Access rules (matches frontend useAuth.hasCourseAccess):
//   • staff  → always pass
//   • coursesGrantAll === true → pass for any course id
//   • else   → must be in the courseAccess allowlist
exports.requireCourseAccess = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const access = await userAccessCache.getOrLoad(req.user.id);
    if (!access) return res.status(401).json({ success: false, message: 'User not found' });

    if (access.role === 'admin' || access.role === 'teacher') return next();

    // Grant-all short-circuits the per-course check entirely.
    if (access.coursesGrantAll) return next();

    const courseId = req.params.id || req.params.courseId;
    if (!courseId) return next(); // not a course-scoped route — caller's problem

    if (access.courseAccess.has(String(courseId))) return next();

    return res.status(403).json({
      success: false,
      code:    'COURSE_LOCKED',
      feature: 'courses',
      message: 'You do not have access to this course. Please contact the administrator.',
    });
  } catch (err) {
    console.error('requireCourseAccess error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.FEATURE_LABELS = FEATURE_LABELS;
