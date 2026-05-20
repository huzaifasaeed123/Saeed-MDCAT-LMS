import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FiZap, FiBook, FiMessageCircle, FiVideo, FiFolder, FiLock, FiCheck, FiSearch, FiX } from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import {
  updateUserFeatureAccess,
  setUserCoursesGrantAll,
  grantUserCourse, revokeUserCourse,
  grantAllCoursesToUser, revokeAllCoursesFromUser,
} from '../services/userService';

// ─────────────────────────────────────────────────────────────────────────────
// FeatureAccessPanel
//   One section that lets admin manage:
//     • 5 feature toggles (autoTest / courses / community / videos / notes)
//     • Per-course allowlist (only shown when 'courses' feature is enabled)
//   Each toggle / course-row change fires ONE backend PATCH and the backend
//   pushes 'feature_access_updated' over SSE so the affected user's tabs
//   reflect the change in real time.
// ─────────────────────────────────────────────────────────────────────────────

// The 4 student-facing features. Courses access is managed entirely in the
// "Course Access" section below (grant-all toggle + per-course toggles) —
// no separate master flag, no duplicate UI.
const FEATURE_DEFS = [
  { key: 'autoTest',  label: 'Auto Test Generator', blurb: 'Create unlimited practice tests',      Icon: FiZap },
  { key: 'community', label: 'Community',           blurb: 'Post + reply on the discussion board', Icon: FiMessageCircle },
  { key: 'videos',    label: 'Videos',              blurb: 'Watch the video library',              Icon: FiVideo },
  { key: 'notes',     label: 'Notes',               blurb: 'Download notes / reference PDFs',      Icon: FiFolder },
];

const ToggleSwitch = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    onClick={onChange}
    disabled={disabled}
    aria-pressed={checked}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-[var(--bg-surface)] disabled:opacity-50 disabled:cursor-not-allowed ${
      checked ? 'bg-emerald-500' : 'bg-[var(--bg-muted)] border border-[var(--border)]'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

const FeatureAccessPanel = ({ userId, initialFeatureAccess, initialCoursesGrantAll, initialCourseAccess }) => {
  const [featureAccess, setFeatureAccess] = useState(initialFeatureAccess || {
    autoTest: false, courses: false, community: false, videos: false, notes: false,
  });
  const [grantAll,      setGrantAll]      = useState(!!initialCoursesGrantAll);
  const [courseAccess,  setCourseAccess]  = useState(new Set((initialCourseAccess || []).map(String)));
  const [savingFeature, setSavingFeature] = useState(null); // which feature is currently saving
  const [savingGrantAll, setSavingGrantAll] = useState(false);
  const [savingCourse,  setSavingCourse]  = useState(null); // which course id is currently saving
  const [bulkBusy,      setBulkBusy]      = useState(false);

  // Course list — fetched once. Filtered client-side by name.
  const [courses,    setCourses]    = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [courseQuery, setCourseQuery] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiClient.get('/courses');
        if (alive && res.data.success) setCourses(res.data.data || []);
      } catch { /* silent */ }
      finally { if (alive) setLoadingCourses(false); }
    })();
    return () => { alive = false; };
  }, []);

  const onToggleFeature = async (key) => {
    const next = !featureAccess[key];
    setSavingFeature(key);
    setFeatureAccess((m) => ({ ...m, [key]: next })); // optimistic
    try {
      await updateUserFeatureAccess(userId, { [key]: next });
      toast.success(`${FEATURE_DEFS.find((f) => f.key === key).label} ${next ? 'enabled' : 'locked'}`);
    } catch (err) {
      setFeatureAccess((m) => ({ ...m, [key]: !next })); // revert
      toast.error(err?.response?.data?.message || 'Failed to update access');
    } finally { setSavingFeature(null); }
  };

  // Grant-all toggle. When ON the student has access to every course, even
  // ones not in courseAccess. Always active — no master toggle to gate it.
  const onToggleGrantAll = async () => {
    if (savingGrantAll) return;
    const next = !grantAll;
    setSavingGrantAll(true);
    setGrantAll(next); // optimistic
    try {
      await setUserCoursesGrantAll(userId, next);
      toast.success(next ? 'All courses granted' : 'Per-course mode enabled');
    } catch {
      setGrantAll(!next);
      toast.error('Failed to update access');
    } finally { setSavingGrantAll(false); }
  };

  const onToggleCourse = async (courseId, currentlyHas) => {
    setSavingCourse(courseId);
    // Optimistic flip
    setCourseAccess((s) => {
      const ns = new Set(s);
      currentlyHas ? ns.delete(courseId) : ns.add(courseId);
      return ns;
    });
    try {
      if (currentlyHas) await revokeUserCourse(userId, courseId);
      else              await grantUserCourse(userId, courseId);
    } catch (err) {
      // Revert
      setCourseAccess((s) => {
        const ns = new Set(s);
        currentlyHas ? ns.add(courseId) : ns.delete(courseId);
        return ns;
      });
      toast.error(err?.response?.data?.message || 'Failed to update course access');
    } finally { setSavingCourse(null); }
  };

  const onGrantAll = async () => {
    setBulkBusy(true);
    try {
      const res = await grantAllCoursesToUser(userId);
      if (res.success) {
        // Server flips grantAll + master courses on + fills courseAccess.
        setCourseAccess(new Set((res.data.courseAccess || []).map(String)));
        setGrantAll(!!res.data.coursesGrantAll);
        if (res.data.featureAccess) setFeatureAccess(res.data.featureAccess);
        toast.success('All courses granted');
      }
    } catch { toast.error('Failed to grant all courses'); }
    finally { setBulkBusy(false); }
  };

  const onRevokeAll = async () => {
    setBulkBusy(true);
    try {
      const res = await revokeAllCoursesFromUser(userId);
      if (res.success) {
        setCourseAccess(new Set());
        setGrantAll(false);
        if (res.data.featureAccess) setFeatureAccess(res.data.featureAccess);
        toast.success('All course access revoked');
      }
    } catch { toast.error('Failed to revoke all courses'); }
    finally { setBulkBusy(false); }
  };

  const filteredCourses = courseQuery.trim()
    ? courses.filter((c) => c.title?.toLowerCase().includes(courseQuery.trim().toLowerCase()))
    : courses;

  return (
    <div className="space-y-5">
      {/* ── Feature toggles ───────────────────────────────────────────────── */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5">
        <h3 className="text-base font-bold text-[var(--text-strong)] mb-1 flex items-center gap-2">
          <FiLock className="text-amber-500" /> Feature Access
        </h3>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Each toggle controls one student-facing feature. Staff (admin/teacher) always bypass these locks.
        </p>

        <div className="space-y-2">
          {FEATURE_DEFS.map(({ key, label, blurb, Icon }) => {
            const on = !!featureAccess[key];
            const busy = savingFeature === key;
            return (
              <div
                key={key}
                className={`flex items-center justify-between gap-3 px-3 py-3 rounded-xl border ${
                  on
                    ? 'border-emerald-300 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/30'
                    : 'border-[var(--border)] bg-[var(--bg-muted)]/40'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center ${
                    on
                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-[var(--bg-muted)] text-[var(--text-faint)]'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-strong)] truncate">{label}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{blurb}</p>
                  </div>
                </div>
                <ToggleSwitch checked={on} onChange={() => onToggleFeature(key)} disabled={busy} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Course Access ─────────────────────────────────────────────────── */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div>
            <h3 className="text-base font-bold text-[var(--text-strong)] flex items-center gap-2">
              <FiBook className="text-primary-500" /> Course Access
            </h3>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              {grantAll
                ? 'This student has access to EVERY course. Per-course toggles are ignored.'
                : 'Use the Grant-all toggle below, OR pick specific courses individually.'}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onGrantAll}
              disabled={bulkBusy}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 dark:text-emerald-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Grant all
            </button>
            <button
              type="button"
              onClick={onRevokeAll}
              disabled={bulkBusy}
              className="px-3 py-1.5 text-xs font-medium bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 dark:text-rose-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Revoke all
            </button>
          </div>
        </div>

        <div className={`flex items-center justify-between gap-3 px-3 py-3 mb-3 rounded-xl border ${
          grantAll
            ? 'border-emerald-300 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/30'
            : 'border-[var(--border)] bg-[var(--bg-muted)]/40'
        }`}>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-strong)]">Grant access to ALL courses</p>
            <p className="text-xs text-[var(--text-muted)]">
              When on, every course (existing and future) is unlocked without ticking individual rows.
            </p>
          </div>
          <ToggleSwitch
            checked={grantAll}
            onChange={onToggleGrantAll}
            disabled={savingGrantAll}
          />
        </div>

        <div className="relative mb-3">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)]" />
          <input
            type="text"
            disabled={grantAll}
            placeholder={grantAll ? 'Grant-all is on — per-course toggles are disabled' : 'Search courses…'}
            value={courseQuery}
            onChange={(e) => setCourseQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)] disabled:bg-[var(--bg-muted)] disabled:cursor-not-allowed"
          />
          {courseQuery && (
            <button onClick={() => setCourseQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text)]">
              <FiX className="w-4 h-4" />
            </button>
          )}
        </div>

        {loadingCourses ? (
          <div className="text-sm text-[var(--text-faint)] text-center py-6">Loading courses…</div>
        ) : filteredCourses.length === 0 ? (
          <div className="text-sm text-[var(--text-faint)] text-center py-6">
            {courseQuery ? 'No courses match your search.' : 'No courses available.'}
          </div>
        ) : (
          <ul className={`divide-y divide-[var(--border-faint)] max-h-72 overflow-y-auto border border-[var(--border)] rounded-xl transition ${
            grantAll ? 'opacity-50 pointer-events-none' : ''
          }`}>
            {filteredCourses.map((c) => {
              const has = courseAccess.has(String(c._id));
              const busy = savingCourse === String(c._id);
              return (
                <li key={c._id} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-[var(--bg-muted)]">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-strong)] truncate">{c.title}</p>
                    {c.shortDescription && (
                      <p className="text-xs text-[var(--text-muted)] truncate">{c.shortDescription}</p>
                    )}
                  </div>
                  <ToggleSwitch
                    checked={grantAll || has}
                    onChange={() => onToggleCourse(String(c._id), has)}
                    disabled={busy || grantAll}
                  />
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-3 text-xs text-[var(--text-muted)] flex items-center gap-1">
          <FiCheck className="w-3.5 h-3.5 text-emerald-500" />
          {grantAll
            ? `All ${courses.length} courses unlocked (grant-all is on)`
            : `${courseAccess.size} of ${courses.length} courses unlocked`}
        </p>
      </div>
    </div>
  );
};

export default FeatureAccessPanel;
