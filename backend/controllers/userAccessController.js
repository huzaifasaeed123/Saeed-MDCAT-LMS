// ── Admin endpoints for managing per-user feature & course access ────────────
// All endpoints in this file require admin role (enforced by the router).
// Every successful mutation:
//   1. invalidates the user's entry in userAccessCache (so the next backend
//      request rebuilds from DB)
//   2. pushes a 'feature_access_updated' SSE event to that user's tabs so
//      the frontend AuthContext re-renders without a manual refresh.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose          = require('mongoose');
const User              = require('../models/User');
const Course            = require('../models/CourseModel');
const userAccessCache   = require('../utils/userAccessCache');
const { pushToUser, pushToAll } = require('../utils/sseManager');
const { buildUserFilter } = require('../utils/userFilter');

// The 4 real feature flags. 'courses' is a separate model (coursesGrantAll +
// courseAccess[]) — bulk/admin endpoints accept the literal string 'courses'
// for ergonomics but route it to the grant-all flag, not a featureAccess key.
const FEATURE_KEYS = ['autoTest', 'community', 'videos', 'notes'];
const BULK_KEYS    = [...FEATURE_KEYS, 'courses']; // accepted by /access/bulk

// Helper — sanitise an arbitrary req.body to only the 5 boolean flags we care
// about. Anything else is silently dropped.
const sanitiseFeatureAccess = (raw) => {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const k of FEATURE_KEYS) {
    if (raw[k] !== undefined) out[k] = !!raw[k];
  }
  return out;
};

// Helper — after any mutation, push the fresh access object to the user's tabs.
const notifyUser = async (userId) => {
  userAccessCache.invalidateUser(userId);
  // Reload so the SSE payload carries the fresh shape (rather than the client
  // having to call /auth/me again).
  const fresh = await userAccessCache.getOrLoad(userId);
  if (!fresh) return;
  pushToUser(userId, 'feature_access_updated', {
    featureAccess:   { ...fresh.featureAccess },
    coursesGrantAll: !!fresh.coursesGrantAll,
    courseAccess:    [...fresh.courseAccess],
  });
};

// ─── PATCH /api/users/:id/access ────────────────────────────────────────────
// Body: {
//   featureAccess: { autoTest?, courses?, community?, videos?, notes? },
//   coursesGrantAll?: boolean,   // optional grant-all sub-flag (only valid when
//                                // featureAccess.courses is or becomes true)
// }
// Set one or more access flags. Only the keys present in the body are touched.
exports.updateFeatureAccess = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    const patch = sanitiseFeatureAccess(req.body?.featureAccess ?? req.body);
    const grantAllSupplied = req.body?.coursesGrantAll !== undefined;
    const grantAllVal      = !!req.body?.coursesGrantAll;

    if (Object.keys(patch).length === 0 && !grantAllSupplied) {
      return res.status(400).json({ success: false, message: 'No valid access flags provided' });
    }

    // Build a $set for only the keys actually supplied — preserves any flags
    // the admin didn't include in this request.
    const setOps = {};
    for (const [k, v] of Object.entries(patch)) setOps[`featureAccess.${k}`] = v;
    if (grantAllSupplied) setOps.coursesGrantAll = grantAllVal;

    const user = await User.findByIdAndUpdate(
      id,
      { $set: setOps },
      { new: true, runValidators: true, lean: true, projection: 'featureAccess coursesGrantAll courseAccess role' }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await notifyUser(id);

    res.status(200).json({
      success: true,
      data: {
        userId:          id,
        featureAccess:   user.featureAccess,
        coursesGrantAll: !!user.coursesGrantAll,
        courseAccess:    (user.courseAccess || []).map((c) => String(c)),
      },
    });
  } catch (err) {
    console.error('updateFeatureAccess error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── PUT /api/users/:id/course-access ───────────────────────────────────────
// Body: { courseIds: [..] }  — REPLACES the user's courseAccess array.
// Validates that every id corresponds to a real Course. Use this for the
// "set exactly these courses" admin flow.
exports.replaceCourseAccess = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    const raw = Array.isArray(req.body?.courseIds) ? req.body.courseIds : null;
    if (!raw) return res.status(400).json({ success: false, message: 'courseIds must be an array' });

    // Filter to valid ObjectIds + dedupe
    const ids = [...new Set(raw.filter((x) => mongoose.Types.ObjectId.isValid(x)).map(String))];

    // Verify each id matches a real course — drop any that don't.
    let validIds = [];
    if (ids.length > 0) {
      const found = await Course.find({ _id: { $in: ids } }).select('_id').lean();
      const okSet = new Set(found.map((c) => String(c._id)));
      validIds = ids.filter((x) => okSet.has(x));
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { courseAccess: validIds } },
      { new: true, runValidators: true, lean: true, projection: 'featureAccess courseAccess role' }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await notifyUser(id);

    res.status(200).json({
      success: true,
      data: {
        userId:       id,
        courseAccess: (user.courseAccess || []).map((c) => String(c)),
      },
    });
  } catch (err) {
    console.error('replaceCourseAccess error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── POST /api/users/:id/course-access/:courseId ────────────────────────────
// Grant access to one specific course (idempotent — $addToSet).
exports.grantCourse = async (req, res) => {
  try {
    const { id, courseId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }

    const course = await Course.findById(courseId).select('_id').lean();
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const user = await User.findByIdAndUpdate(
      id,
      { $addToSet: { courseAccess: courseId } },
      { new: true, lean: true, projection: 'courseAccess' }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await notifyUser(id);

    res.status(200).json({
      success: true,
      data: { userId: id, courseAccess: (user.courseAccess || []).map((c) => String(c)) },
    });
  } catch (err) {
    console.error('grantCourse error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── DELETE /api/users/:id/course-access/:courseId ──────────────────────────
exports.revokeCourse = async (req, res) => {
  try {
    const { id, courseId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $pull: { courseAccess: courseId } },
      { new: true, lean: true, projection: 'courseAccess' }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await notifyUser(id);

    res.status(200).json({
      success: true,
      data: { userId: id, courseAccess: (user.courseAccess || []).map((c) => String(c)) },
    });
  } catch (err) {
    console.error('revokeCourse error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── POST /api/users/:id/course-access/grant-all ────────────────────────────
// Flips the user into "grant-all-courses" mode. We set coursesGrantAll=true
// (the master switch) AND mirror the full course id list into courseAccess
// so the per-course UI still reads correctly if admin later turns grant-all
// off and wants to start selectively de-ticking.
exports.grantAllCourses = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    const allIds = (await Course.find({}).select('_id').lean()).map((c) => c._id);

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { coursesGrantAll: true, courseAccess: allIds } },
      { new: true, lean: true, projection: 'featureAccess coursesGrantAll courseAccess' }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await notifyUser(id);

    res.status(200).json({
      success: true,
      data: {
        userId:          id,
        featureAccess:   user.featureAccess,
        coursesGrantAll: !!user.coursesGrantAll,
        courseAccess:    (user.courseAccess || []).map((c) => String(c)),
        total:           allIds.length,
      },
    });
  } catch (err) {
    console.error('grantAllCourses error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── POST /api/users/:id/course-access/revoke-all ───────────────────────────
// Clears every per-course grant AND turns off the grant-all flag, but keeps
// the master 'courses' feature toggle as admin set it (so they can grant
// individual courses without re-enabling the master toggle).
exports.revokeAllCourses = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { courseAccess: [], coursesGrantAll: false } },
      { new: true, lean: true, projection: 'featureAccess coursesGrantAll courseAccess' }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await notifyUser(id);

    res.status(200).json({
      success: true,
      data: {
        userId:          id,
        featureAccess:   user.featureAccess,
        coursesGrantAll: false,
        courseAccess:    [],
      },
    });
  } catch (err) {
    console.error('revokeAllCourses error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── PATCH /api/users/course-access/bulk ────────────────────────────────────
// Body: { courseIds: [id, ...], value: true|false, role?: 'student', filters?: {...} }
// Grant or revoke specific courses for every user matching the given role +
// filters in one bulk write. value=true → $addToSet each courseId,
// value=false → $pull each courseId. Does NOT touch coursesGrantAll.
exports.bulkGrantCourseAccess = async (req, res) => {
  try {
    const { courseIds, value, role: roleRaw, filters: filtersRaw } = req.body || {};

    if (!Array.isArray(courseIds) || courseIds.length === 0) {
      return res.status(400).json({ success: false, message: 'courseIds must be a non-empty array' });
    }
    const validIds = courseIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid courseIds provided' });
    }
    if (value === undefined) {
      return res.status(400).json({ success: false, message: 'value (boolean) is required' });
    }
    const grant = !!value;
    const role  = ['student', 'teacher', 'admin'].includes(roleRaw) ? roleRaw : 'student';

    const filterInput = (filtersRaw && typeof filtersRaw === 'object') ? { ...filtersRaw } : {};
    delete filterInput.role;
    const filter = buildUserFilter({ ...filterInput, role });

    // On revoke we also clear coursesGrantAll so users who had the master
    // "all courses" flag still lose access — pulling from courseAccess alone
    // is not enough because the flag overrides the per-course list.
    const updateOp = grant
      ? { $addToSet: { courseAccess: { $each: validIds } } }
      : { $set: { coursesGrantAll: false }, $pull: { courseAccess: { $in: validIds } } };

    const result = await User.updateMany(filter, updateOp);

    userAccessCache.clearAll();
    pushToAll('bulk_access_updated', { feature: 'courseAccess', value: grant, role, courseIds: validIds });

    res.status(200).json({
      success: true,
      data: { courseIds: validIds, value: grant, role, matched: result.matchedCount, modified: result.modifiedCount },
    });
  } catch (err) {
    console.error('bulkGrantCourseAccess error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── PATCH /api/users/access/bulk ────────────────────────────────────────────
// Body: { feature: 'community', value: true, role?: 'student' }
// Applies one feature toggle to EVERY user matching `role` (defaults to
// 'student' since staff already bypass locks). One bulk DB write + an
// in-memory cache wipe — we don't iterate to invalidate per user because
// flushing the whole cache is faster for large fan-outs and the cache
// re-populates lazily on the next request.
//
// Special case: feature === 'courses' also flips coursesGrantAll alongside
// the master toggle, so "enable Courses for all students" means "give all
// students access to all courses" in one click (matches admin intent).
exports.bulkApplyAccess = async (req, res) => {
  try {
    const featureRaw = String(req.body?.feature || '').trim();
    if (!BULK_KEYS.includes(featureRaw)) {
      return res.status(400).json({ success: false, message: `feature must be one of: ${BULK_KEYS.join(', ')}` });
    }
    if (req.body?.value === undefined) {
      return res.status(400).json({ success: false, message: 'value (boolean) is required' });
    }
    const value = !!req.body.value;

    const role = ['student', 'teacher', 'admin'].includes(req.body?.role)
      ? req.body.role
      : 'student';

    // 'courses' is the only bulk key that's NOT a real featureAccess flag —
    // it maps to coursesGrantAll. ON = every (filtered) student gets every
    // course. OFF = every (filtered) student loses grant-all (their per-course
    // allowlists are preserved so admin can re-enable selectively later).
    const setOps = featureRaw === 'courses'
      ? { coursesGrantAll: value }
      : { [`featureAccess.${featureRaw}`]: value };

    // Honour the same filter set the admin sees in the table. The frontend
    // sends its active filters in `filters` so the bulk write touches exactly
    // the visible rows (modulo pagination). `role` always comes from the body
    // for backwards compat — if `filters` also carries a role it's ignored.
    const filterInput = (req.body?.filters && typeof req.body.filters === 'object')
      ? { ...req.body.filters }
      : {};
    delete filterInput.role; // role from top-level body wins
    const filter = buildUserFilter({ ...filterInput, role });

    const result = await User.updateMany(filter, { $set: setOps });

    // Wipe the whole user-access cache — cheaper than iterating IDs, and
    // entries rebuild on demand. Bulk admin actions are rare.
    userAccessCache.clearAll();

    // Broadcast a nudge — connected clients respond by re-pulling /auth/me
    // (or /auth/refresh-token) so each tab gets the fresh per-user shape.
    // One frame for everyone is cheaper than computing N personalised shapes.
    // Targeting `role: 'student'` is the common case; staff get the nudge too
    // and harmlessly ignore it (their tabs read their own access on refresh).
    pushToAll('bulk_access_updated', { feature: featureRaw, value, role });

    res.status(200).json({
      success: true,
      data: {
        feature:  featureRaw,
        value,
        role,
        matched:  result.matchedCount,
        modified: result.modifiedCount,
      },
    });
  } catch (err) {
    console.error('bulkApplyAccess error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports._helpers = { FEATURE_KEYS, sanitiseFeatureAccess };
