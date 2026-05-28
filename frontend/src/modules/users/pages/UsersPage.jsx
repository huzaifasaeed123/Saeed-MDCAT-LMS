import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiEdit, FiTrash2, FiPlusCircle, FiUpload, FiDownload,
  FiSearch, FiFilter, FiX, FiUsers, FiChevronLeft, FiChevronRight,
  FiAlertCircle, FiCheckCircle, FiToggleLeft, FiToggleRight,
  FiZap, FiBook, FiMessageCircle, FiVideo, FiFolder,
  FiCalendar, FiUserCheck, FiUserPlus, FiChevronDown,
} from 'react-icons/fi';
import { PROVINCES, STUDENT_CLASSES, STUDENT_STATUSES } from '../../../shared/constants/studentProfile';
import apiClient from '../../../core/api/axiosConfig';
import {
  updateUserFeatureAccess, bulkApplyAccess,
  grantUserCourse, revokeUserCourse,
  setUserCoursesGrantAll,
  bulkGrantCourseAccess,
} from '../services/userService';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';

// ── Date-preset helper ──────────────────────────────────────────────────────
// Translates the active preset pill into a { from, to } pair. 'all' returns
// nulls so the filter is omitted from the request.
const DATE_PRESETS = [
  { key: 'all',   label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: '7d',    label: 'Last 7 days' },
  { key: '30d',   label: 'Last 30 days' },
];
const datePresetToRange = (key) => {
  if (key === 'all') return { from: null, to: null };
  const now = new Date();
  const to  = new Date(now);
  to.setHours(23, 59, 59, 999);
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  if (key === '7d')  from.setDate(from.getDate() - 6);   // includes today + 6 prior = 7 days
  if (key === '30d') from.setDate(from.getDate() - 29);
  return { from: from.toISOString(), to: to.toISOString() };
};

const PAGE_SIZE = 20;

const ROLE_COLORS = {
  admin:   'bg-secondary-100 text-secondary-800 dark:bg-secondary-950/40 dark:text-secondary-300',
  teacher: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  student: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
};

// Bulk Edit Mode columns. Courses are NOT a column anymore — they collapse
// into a single dropdown cell with per-course checkboxes + a grant-all toggle
// at the top. That scales with N courses without widening the table.
const FEATURE_COLUMNS = [
  { key: 'autoTest',  shortLabel: 'Auto Test',  Icon: FiZap },
  { key: 'community', shortLabel: 'Community',  Icon: FiMessageCircle },
  { key: 'videos',    shortLabel: 'Videos',     Icon: FiVideo },
  { key: 'notes',     shortLabel: 'Notes',      Icon: FiFolder },
];

const getCellValue = (user, key) => !!user.featureAccess?.[key];

// Compact per-row Courses picker. Replaces the old N-columns-per-course
// layout in Edit Mode — admin clicks the cell, a popover opens with a search
// box, a "Grant all" toggle, and a checkbox per course. State updates are
// optimistic (controlled by the parent through the callbacks).
const CoursesDropdown = ({
  user, courses, busyKey, // busyKey: `${userId}:course:${courseId}` while a request is in flight
  onToggleCourse, onToggleGrantAll,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const popoverRef = useRef(null);
  const buttonRef  = useRef(null);

  // Click-outside / Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onDoc = (e) => {
      if (popoverRef.current?.contains(e.target)) return;
      if (buttonRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open]);

  const grantAll       = !!user.coursesGrantAll;
  const accessSet      = useMemo(
    () => new Set((user.courseAccess || []).map(String)),
    [user.courseAccess],
  );
  const grantedCount   = grantAll ? courses.length : accessSet.size;
  const filteredCourses = query.trim()
    ? courses.filter((c) => (c.title || '').toLowerCase().includes(query.trim().toLowerCase()))
    : courses;

  // Summary text — switches between three states so admin sees at a glance
  // whether grant-all is on, how many courses are picked, or nothing.
  const summary = grantAll
    ? 'All courses'
    : grantedCount === 0
      ? 'None'
      : `${grantedCount} of ${courses.length}`;

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors min-w-[120px] justify-between ${
          grantAll
            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50'
            : grantedCount > 0
              ? 'border-primary-300 bg-primary-50/60 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300 dark:border-primary-900/50'
              : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
        }`}
      >
        <span className="flex items-center gap-1.5">
          <FiBook className="w-3.5 h-3.5" />
          <span className="font-medium">{summary}</span>
        </span>
        <FiChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute z-30 mt-1 right-0 w-72 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden"
        >
          {/* Grant-all toggle */}
          <div className={`flex items-center justify-between gap-3 px-3 py-2.5 border-b border-[var(--border-faint)] ${
            grantAll ? 'bg-emerald-50/60 dark:bg-emerald-950/30' : ''
          }`}>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--text-strong)]">Grant all courses</p>
              <p className="text-[10px] text-[var(--text-muted)]">Unlocks every course, existing &amp; future.</p>
            </div>
            <button
              type="button"
              onClick={() => onToggleGrantAll(user._id, !grantAll)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                grantAll ? 'bg-emerald-500' : 'bg-[var(--bg-muted)] border border-[var(--border)]'
              }`}
              aria-pressed={grantAll}
            >
              <span className={`absolute top-0.5 inline-block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                grantAll ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Search */}
          <div className="relative p-2 border-b border-[var(--border-faint)]">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-faint)]" />
            <input
              type="text"
              disabled={grantAll}
              placeholder={grantAll ? 'Grant-all is on' : 'Search courses…'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 text-xs border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-400 placeholder:text-[var(--text-faint)] disabled:opacity-50"
            />
          </div>

          {/* Course list */}
          <ul className={`max-h-60 overflow-y-auto py-1 ${grantAll ? 'opacity-50 pointer-events-none' : ''}`}>
            {filteredCourses.length === 0 ? (
              <li className="text-[11px] text-[var(--text-faint)] text-center py-4">No courses match.</li>
            ) : filteredCourses.map((c) => {
              const checked = grantAll || accessSet.has(String(c._id));
              const busy    = busyKey === `${user._id}:course:${c._id}`;
              return (
                <li key={c._id}>
                  <label className="flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--bg-muted)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={busy || grantAll}
                      onChange={() => onToggleCourse(user._id, c._id)}
                      className="w-3.5 h-3.5 accent-primary-500"
                    />
                    <span className="truncate flex-1">{c.title}</span>
                    {busy && <span className="text-[10px] text-[var(--text-faint)]">…</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

// Header-level bulk course picker. Admin selects one or more courses with
// checkboxes, then clicks "Grant to all" or "Revoke from all" to apply to
// every student matching the active filters (same scope as the All on/off
// buttons in the feature columns). Does NOT touch coursesGrantAll.
const BulkCoursesDropdown = ({ courses, disabled, onApply }) => {
  const [open,     setOpen]     = useState(false);
  const [query,    setQuery]    = useState('');
  const [selected, setSelected] = useState(new Set());
  const [busy,     setBusy]     = useState(null); // 'grant' | 'revoke'
  const popoverRef = useRef(null);
  const buttonRef  = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onDoc = (e) => {
      if (popoverRef.current?.contains(e.target)) return;
      if (buttonRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open]);

  const filtered = query.trim()
    ? courses.filter((c) => (c.title || '').toLowerCase().includes(query.trim().toLowerCase()))
    : courses;

  const toggleCourse = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === courses.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(courses.map((c) => String(c._id))));
    }
  };

  const handleApply = async (value) => {
    if (selected.size === 0) return;
    const opKey = value ? 'grant' : 'revoke';
    setBusy(opKey);
    try {
      await onApply([...selected], value);
      setSelected(new Set());
      setOpen(false);
    } finally {
      setBusy(null);
    }
  };

  const allChecked   = courses.length > 0 && selected.size === courses.length;
  const someChecked  = selected.size > 0 && selected.size < courses.length;

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        ref={buttonRef}
        disabled={disabled || courses.length === 0}
        onClick={() => setOpen((v) => !v)}
        title="Bulk grant / revoke specific courses for all filtered students"
        className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          open
            ? 'bg-primary-100 border-primary-300 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 dark:border-primary-900/50'
            : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
        }`}
      >
        <FiBook className="w-2.5 h-2.5" />
        Bulk
        <FiChevronDown className={`w-2.5 h-2.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute z-40 mt-1 left-0 w-80 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-faint)] bg-[var(--bg-muted)]">
            <div>
              <p className="text-xs font-semibold text-[var(--text-strong)]">Bulk Course Access</p>
              <p className="text-[10px] text-[var(--text-muted)]">Select courses, then grant or revoke for all filtered students.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-[var(--text-faint)] hover:text-[var(--text)]">
              <FiX className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative p-2 border-b border-[var(--border-faint)]">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-faint)]" />
            <input
              type="text"
              placeholder="Search courses…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 text-xs border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
            />
          </div>

          {/* Select all */}
          <label className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[var(--text-strong)] hover:bg-[var(--bg-muted)] cursor-pointer border-b border-[var(--border-faint)]">
            <input
              type="checkbox"
              checked={allChecked}
              ref={(el) => { if (el) el.indeterminate = someChecked; }}
              onChange={toggleAll}
              className="w-3.5 h-3.5 accent-primary-500"
            />
            {allChecked ? 'Deselect all' : 'Select all'}
            {selected.size > 0 && (
              <span className="ml-auto text-[10px] text-primary-600 dark:text-primary-300 font-bold">
                {selected.size} selected
              </span>
            )}
          </label>

          {/* Course list */}
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="text-[11px] text-[var(--text-faint)] text-center py-4">No courses match.</li>
            ) : filtered.map((c) => {
              const id      = String(c._id);
              const checked = selected.has(id);
              return (
                <li key={id}>
                  <label className="flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--bg-muted)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCourse(id)}
                      className="w-3.5 h-3.5 accent-primary-500"
                    />
                    <span className="truncate flex-1">{c.title}</span>
                  </label>
                </li>
              );
            })}
          </ul>

          {/* Actions */}
          <div className="flex gap-2 px-3 py-2.5 border-t border-[var(--border-faint)] bg-[var(--bg-muted)]">
            <button
              type="button"
              disabled={selected.size === 0 || !!busy}
              onClick={() => handleApply(true)}
              className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900/50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy === 'grant' ? '…' : <><FiCheckCircle className="w-3 h-3" /> Grant to all</>}
            </button>
            <button
              type="button"
              disabled={selected.size === 0 || !!busy}
              onClick={() => handleApply(false)}
              className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900/50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy === 'revoke' ? '…' : <><FiAlertCircle className="w-3 h-3" /> Revoke from all</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Pill-style toggle used inside the bulk-edit table. Smaller than the one in
// FeatureAccessPanel so 5 fit comfortably in a single row.
const MiniToggle = ({ on, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${
      on ? 'bg-emerald-500' : 'bg-[var(--bg-muted)] border border-[var(--border)]'
    }`}
    aria-pressed={on}
  >
    <span className={`absolute top-0.5 inline-block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
      on ? 'translate-x-4' : 'translate-x-0.5'
    }`} />
  </button>
);

// ── Excel template download (client-side, no extra library needed) ─────────────
const downloadTemplate = () => {
  const header = ['Name', 'Email', 'Password', 'ContactNumber', 'Role'];
  const sample = ['Ahmed Khan', 'ahmed@example.com', 'password123', '03001234567', 'student'];
  const csv    = [header, sample].map((r) => r.join(',')).join('\n');
  const blob   = new Blob([csv], { type: 'text/csv' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href = url; a.download = 'bulk_users_template.csv'; a.click();
  URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────────────────────────────────────────

const UsersPage = () => {
  const [users,      setUsers]      = useState([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [role,   setRole]   = useState('');
  // Profile-field filters. Server applies AND across all of them; empty
  // string means "ignore this filter."
  const [province,      setProvince]      = useState('');
  const [district,      setDistrict]      = useState('');
  const [studentClass,  setStudentClass]  = useState('');
  const [studentStatus, setStudentStatus] = useState('');
  // Registration-date preset + signup source ('' = any). Bulk-apply uses the
  // same values so it touches exactly the visible rows.
  const [datePreset,   setDatePreset]   = useState('all');
  const [signupSource, setSignupSource] = useState('');
  const searchTimer   = useRef(null);
  const districtTimer = useRef(null);

  // Bulk upload
  const [uploadOpen,    setUploadOpen]    = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [uploadResult,  setUploadResult]  = useState(null);
  const fileInputRef = useRef(null);

  // Delete confirm
  const [deleteId, setDeleteId] = useState(null);

  // Edit Mode — swaps the table to show feature toggles + per-course toggles
  // per row. Staff are hidden entirely in this mode (access flags don't apply
  // to admin/teacher). Per-cell saves fire one PATCH each; row-level optimism
  // with per-cell rollback on failure so a failed toggle doesn't desync the row.
  const [editMode, setEditMode]     = useState(false);
  const [savingCell, setSavingCell] = useState(null); // `${userId}:${key}` while in flight

  // Course list — fetched once when entering Edit Mode (used for per-course
  // toggle columns). Empty when Edit Mode is off — saves a query on the
  // normal user-management view.
  const [courses, setCourses]       = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // ── Fetch users ────────────────────────────────────────────────────────────
  // Edit Mode forces role=student — staff bypass access locks server-side, so
  // showing them with empty toggles would just be confusing noise. Profile
  // filters (province/district/class/status) AND-combine with search + role.
  // NOT wrapped in useCallback. The function reads current state via its
  // closure; wrapping it with an empty-deps useCallback would freeze that
  // closure at mount and silently strip every filter from outgoing requests.
  // It's only called from handlers and effects within this component, so
  // the unstable identity is harmless.
  // Build the param object the backend expects from current filter state.
  // Exported as a helper so the bulk-apply path can send the EXACT same
  // filters (sans pagination) without the two paths drifting.
  const buildFilterParams = (overrides = {}) => {
    const s    = overrides.s    ?? search;
    const r    = overrides.r    ?? role;
    const em   = overrides.em   ?? editMode;
    const prov = overrides.prov ?? province;
    const dist = overrides.dist ?? district;
    const cls  = overrides.cls  ?? studentClass;
    const stat = overrides.stat ?? studentStatus;
    const dp   = overrides.dp   ?? datePreset;
    const ss   = overrides.ss   ?? signupSource;

    const out = {};
    if (s) out.search = s;
    const effectiveRole = em ? 'student' : r;
    if (effectiveRole)       out.role          = effectiveRole;
    if (prov)                out.province      = prov;
    if (dist && dist.trim()) out.district      = dist.trim();
    if (cls)                 out.studentClass  = cls;
    if (stat)                out.studentStatus = stat;
    const range = datePresetToRange(dp);
    if (range.from) out.dateFrom = range.from;
    if (range.to)   out.dateTo   = range.to;
    if (ss === 'self' || ss === 'admin') out.signupSource = ss;
    return out;
  };

  const fetchUsers = async (opts = {}) => {
    const { p = page, ...rest } = opts;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: PAGE_SIZE });
      for (const [k, v] of Object.entries(buildFilterParams(rest))) {
        params.set(k, v);
      }
      const res = await apiClient.get(`/users?${params}`);
      if (res.data.success) {
        setUsers(res.data.data);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      }
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch whenever any filter or edit mode flips. Entering Edit Mode
  // restricts to students; exiting restores the user's role filter selection.
  useEffect(() => {
    setPage(1);
    fetchUsers({ p: 1 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, editMode, province, studentClass, studentStatus, datePreset, signupSource]);

  // Fetch courses lazily — only when Edit Mode first opens. Cached for the
  // rest of the session (admin rarely creates new courses mid-session).
  useEffect(() => {
    if (!editMode || courses.length > 0 || loadingCourses) return;
    setLoadingCourses(true);
    apiClient.get('/courses')
      .then((res) => {
        if (res.data?.success) setCourses(res.data.data || []);
      })
      .catch(() => { /* silent — column just won't render */ })
      .finally(() => setLoadingCourses(false));
  }, [editMode, courses.length, loadingCourses]);

  // Debounced search
  const handleSearchChange = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchUsers({ p: 1, s: val });
    }, 350);
  };

  // District is a free-text filter — debounce same as search so we don't
  // hammer the API on every keystroke.
  const handleDistrictChange = (val) => {
    setDistrict(val);
    clearTimeout(districtTimer.current);
    districtTimer.current = setTimeout(() => {
      setPage(1);
      fetchUsers({ p: 1, dist: val });
    }, 350);
  };

  const handlePageChange = (p) => {
    setPage(p);
    fetchUsers({ p });
  };

  const handleRoleChange = (r) => { setRole(r); setPage(1); };

  const hasActiveFilter = !!(
    search || role || province || district || studentClass || studentStatus
    || (datePreset && datePreset !== 'all') || signupSource
  );

  const clearFilters = () => {
    setSearch(''); setRole('');
    setProvince(''); setDistrict('');
    setStudentClass(''); setStudentStatus('');
    setDatePreset('all'); setSignupSource('');
    setPage(1);
    fetchUsers({ p: 1, s: '', r: '', prov: '', dist: '', cls: '', stat: '', dp: 'all', ss: '' });
  };

  // ── Edit Mode helpers ──────────────────────────────────────────────────
  // Single-cell toggle. Optimistic — flips local state, then patches the
  // backend. On error, reverts the cell so the UI matches the DB.
  // The 'courses' column maps to coursesGrantAll (not a featureAccess key).
  const onToggleFeatureCell = async (userId, key) => {
    const target = users.find((u) => u._id === userId);
    if (!target || target.role !== 'student') return; // staff have no toggles
    const cellKey = `${userId}:${key}`;
    if (savingCell === cellKey) return;

    const isCoursesKey = key === 'courses';
    const currentVal = getCellValue(target, key);
    const nextVal    = !currentVal;

    // Optimistic local update — writes to the right field depending on key.
    setUsers((list) => list.map((u) => {
      if (u._id !== userId) return u;
      if (isCoursesKey) return { ...u, coursesGrantAll: nextVal };
      return { ...u, featureAccess: { ...(u.featureAccess || {}), [key]: nextVal } };
    }));
    setSavingCell(cellKey);

    try {
      if (isCoursesKey) {
        // Send only the grant-all flag — no featureAccess patch needed.
        await updateUserFeatureAccess(userId, {}, { coursesGrantAll: nextVal });
      } else {
        await updateUserFeatureAccess(userId, { [key]: nextVal });
      }
    } catch (err) {
      // Revert
      setUsers((list) => list.map((u) => {
        if (u._id !== userId) return u;
        if (isCoursesKey) return { ...u, coursesGrantAll: currentVal };
        return { ...u, featureAccess: { ...(u.featureAccess || {}), [key]: currentVal } };
      }));
      toast.error(err?.response?.data?.message || 'Failed to update access');
    } finally { setSavingCell(null); }
  };

  // Flip every feature column AND the grant-all-courses flag for one user
  // in a single PATCH. The Courses cell shows the new grant-all state via
  // its popover summary; admin can still un-tick individual courses after.
  const onToggleAllForUser = async (userId) => {
    const target = users.find((u) => u._id === userId);
    if (!target || target.role !== 'student') return;
    const fa = target.featureAccess || {};
    const allFeaturesOn = FEATURE_COLUMNS.every((f) => getCellValue(target, f.key));
    const grantAllOn    = !!target.coursesGrantAll;
    const allOn         = allFeaturesOn && grantAllOn;
    const nextVal       = !allOn;
    const faPatch = Object.fromEntries(FEATURE_COLUMNS.map((f) => [f.key, nextVal]));
    const prevGrantAll = grantAllOn;

    setUsers((list) => list.map((u) => (
      u._id === userId ? { ...u, featureAccess: { ...fa, ...faPatch }, coursesGrantAll: nextVal } : u
    )));
    try {
      await updateUserFeatureAccess(userId, faPatch, { coursesGrantAll: nextVal });
      toast.success(nextVal ? 'All features enabled' : 'All features locked');
    } catch {
      setUsers((list) => list.map((u) => (
        u._id === userId ? { ...u, featureAccess: { ...fa }, coursesGrantAll: prevGrantAll } : u
      )));
      toast.error('Failed to update access');
    }
  };

  // Flip the grant-all flag for one user. Backed by the same PATCH /access
  // endpoint as the rest of the page so the SSE invalidation kicks in.
  const onToggleGrantAllForUser = async (userId, nextValue) => {
    const target = users.find((u) => u._id === userId);
    if (!target || target.role !== 'student') return;
    const prev = !!target.coursesGrantAll;
    setUsers((list) => list.map((u) => (
      u._id === userId ? { ...u, coursesGrantAll: nextValue } : u
    )));
    try {
      await setUserCoursesGrantAll(userId, nextValue);
    } catch (err) {
      setUsers((list) => list.map((u) => (
        u._id === userId ? { ...u, coursesGrantAll: prev } : u
      )));
      toast.error(err?.response?.data?.message || 'Failed to update access');
    }
  };

  // ── Per-course toggle — flips access for one (user, course) pair ───────
  // When the user has coursesGrantAll=true, individual courses are shown as
  // "on" but disabled (the grant-all overrides per-course allowlist).
  const onToggleCourseCell = async (userId, courseId) => {
    const target = users.find((u) => u._id === userId);
    if (!target || target.role !== 'student') return;
    if (target.coursesGrantAll) return; // per-course locked while grant-all is on
    const cellKey = `${userId}:course:${courseId}`;
    if (savingCell === cellKey) return;

    const list = target.courseAccess || [];
    const has  = list.some((c) => String(c) === String(courseId));
    const nextList = has
      ? list.filter((c) => String(c) !== String(courseId))
      : [...list, courseId];

    // Optimistic
    setUsers((arr) => arr.map((u) => (
      u._id === userId ? { ...u, courseAccess: nextList } : u
    )));
    setSavingCell(cellKey);

    try {
      if (has) await revokeUserCourse(userId, courseId);
      else     await grantUserCourse(userId, courseId);
    } catch (err) {
      // Revert
      setUsers((arr) => arr.map((u) => (
        u._id === userId ? { ...u, courseAccess: list } : u
      )));
      toast.error(err?.response?.data?.message || 'Failed to update course access');
    } finally { setSavingCell(null); }
  };

  // ── Apply one feature to EVERY student in one call ─────────────────────
  // Used by the column-header "Apply to all" buttons in Edit Mode.
  const [bulkApplying, setBulkApplying] = useState(null); // `${feature}:${value}` while in flight
  const onApplyFeatureToAll = async (feature, value) => {
    const opKey = `${feature}:${value ? 'on' : 'off'}`;
    if (bulkApplying) return;
    setBulkApplying(opKey);

    // Optimistic local sweep — flip this feature on every student row
    // currently visible. Re-fetch only on error to resync.
    const prevSnapshot = users.map((u) => ({
      _id: u._id,
      featureAccess: u.featureAccess ? { ...u.featureAccess } : undefined,
      coursesGrantAll: !!u.coursesGrantAll,
    }));
    setUsers((list) => list.map((u) => {
      if (u.role !== 'student') return u;
      if (feature === 'courses') return { ...u, coursesGrantAll: value };
      return { ...u, featureAccess: { ...(u.featureAccess || {}), [feature]: value } };
    }));

    try {
      // Pass the current filter set so the bulk write touches exactly what
      // the admin can see in the table (modulo pagination). `role` is forced
      // to 'student' for the bulk action regardless of the role filter.
      const filtersForBulk = buildFilterParams();
      delete filtersForBulk.role; // role from the dedicated arg wins
      const res = await bulkApplyAccess(feature, value, 'student', filtersForBulk);
      toast.success(`${FEATURE_COLUMNS.find((f) => f.key === feature)?.shortLabel || feature} ${value ? 'enabled' : 'locked'} for ${res?.data?.modified ?? 0} student(s)`);
    } catch (err) {
      // Revert to snapshot
      setUsers((list) => list.map((u) => {
        const prev = prevSnapshot.find((p) => p._id === u._id);
        return prev ? { ...u, featureAccess: prev.featureAccess, coursesGrantAll: prev.coursesGrantAll } : u;
      }));
      toast.error(err?.response?.data?.message || 'Bulk update failed');
    } finally { setBulkApplying(null); }
  };

  // ── Bulk grant/revoke specific courses for all filtered students ───────────
  // Mirrors the per-row CoursesDropdown but for the entire filtered set.
  // Does NOT touch coursesGrantAll — it only adds/removes specific courseIds.
  const onBulkGrantCourses = async (courseIds, value) => {
    const filtersForBulk = buildFilterParams();
    delete filtersForBulk.role;
    try {
      const res = await bulkGrantCourseAccess(courseIds, value, 'student', filtersForBulk);
      const label = value ? 'granted to' : 'revoked from';
      toast.success(`${courseIds.length} course(s) ${label} ${res?.data?.modified ?? 0} student(s)`);
      // Re-fetch to reflect the updated courseAccess arrays in visible rows.
      fetchUsers();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Bulk course update failed');
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    try {
      await apiClient.delete(`/users/${deleteId}`);
      toast.success('User deleted');
      setDeleteId(null);
      fetchUsers();
    } catch {
      toast.error('Failed to delete user');
    }
  };

  // ── Bulk Upload ────────────────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiClient.post('/users/bulk-upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadResult(res.data);
      if (res.data.created > 0) {
        toast.success(`${res.data.created} user(s) created`);
        setPage(1);
        fetchUsers({ p: 1 });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Push title/subtitle + the action cluster up into the navbar.
  // Memoised so PageHeaderContext doesn't see a fresh JSX object every render
  // (would cause its effect to re-fire → setHeader → infinite re-render loop).
  const subtitle = `${total} total user${total !== 1 ? 's' : ''}`;
  const headerAction = useMemo(() => (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={() => setEditMode((v) => !v)}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors border ${
          editMode
            ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
            : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-muted)] text-[var(--text)] border-[var(--border)]'
        }`}
        title={editMode ? 'Exit bulk-access edit mode' : 'Enter bulk-access edit mode'}
      >
        {editMode
          ? <><FiToggleRight className="w-4 h-4" /> Exit Edit Mode</>
          : <><FiToggleLeft  className="w-4 h-4" /> Edit Access</>}
      </button>
      <button
        onClick={() => { setUploadOpen(true); setUploadResult(null); }}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <FiUpload className="w-4 h-4" /> Bulk Upload
      </button>
      <Link to="/admin/users/new" className="btn-brand text-sm">
        <FiPlusCircle className="w-4 h-4" /> Add User
      </Link>
    </div>
  ), [editMode]);

  usePageHeader({
    title:    'User Management',
    subtitle,
    action:   headerAction,
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Mobile-only action cluster (navbar action slot is desktop-only) ── */}
      <div className="md:hidden flex flex-wrap gap-2">
        <button
          onClick={() => setEditMode((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors border ${
            editMode
              ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
              : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-muted)] text-[var(--text)] border-[var(--border)]'
          }`}
        >
          {editMode
            ? <><FiToggleRight className="w-4 h-4" /> Exit Edit Mode</>
            : <><FiToggleLeft  className="w-4 h-4" /> Edit Access</>}
        </button>
        <button
          onClick={() => { setUploadOpen(true); setUploadResult(null); }}
          className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <FiUpload className="w-4 h-4" /> Bulk Upload
        </button>
        <Link to="/admin/users/new" className="btn-brand text-sm">
          <FiPlusCircle className="w-4 h-4" /> Add User
        </Link>
      </div>

      {/* Filters — two rows.
          Row 1: free-text search + role (always available)
          Row 2: profile-field filters (province / district / class / status) */}
      <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)]" />
            <input
              type="text"
              placeholder="Search by name, email, phone…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
            />
            {search && (
              <button onClick={() => handleSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text)]">
                <FiX className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Role filter — disabled in Edit Mode (forced to student) */}
          <div className="flex items-center gap-2">
            <FiFilter className="w-4 h-4 text-[var(--text-faint)]" />
            <select
              value={editMode ? 'student' : role}
              onChange={(e) => handleRoleChange(e.target.value)}
              disabled={editMode}
              title={editMode ? 'Edit Mode shows students only' : undefined}
              className="border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:bg-[var(--bg-muted)] disabled:cursor-not-allowed"
            >
              <option value="">All Roles</option>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Clear */}
          {hasActiveFilter && (
            <button onClick={clearFilters} className="text-sm text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-1">
              <FiX className="w-4 h-4" /> Clear all
            </button>
          )}
        </div>

        {/* Row 2 — profile filters. Always visible; admin can pick any combination. */}
        <div className="flex flex-wrap gap-3 items-center pt-2 border-t border-[var(--border-faint)]">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-faint)]">Profile filters</span>

          <select
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            <option value="">All Provinces</option>
            {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <input
            type="text"
            value={district}
            onChange={(e) => handleDistrictChange(e.target.value)}
            placeholder="District (any match)"
            className="border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-lg text-sm px-3 py-2 w-44 focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
          />

          <select
            value={studentClass}
            onChange={(e) => setStudentClass(e.target.value)}
            className="border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            <option value="">All Classes</option>
            {STUDENT_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={studentStatus}
            onChange={(e) => setStudentStatus(e.target.value)}
            className="border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            <option value="">All Status</option>
            {STUDENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Live count — reflects the FILTERED set, not the global user total. */}
          <span className="ml-auto text-sm text-[var(--text-muted)]">
            {hasActiveFilter ? (
              <>Showing <strong className="text-[var(--text-strong)]">{total}</strong> match{total !== 1 ? 'es' : ''}</>
            ) : (
              <><strong className="text-[var(--text-strong)]">{total}</strong> total</>
            )}
          </span>
        </div>

        {/* Row 3 — registration date preset + signup source. Bulk Edit Mode
            applies actions only to the filtered set (visible rows). */}
        <div className="flex flex-wrap gap-3 items-center pt-2 border-t border-[var(--border-faint)]">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-faint)] flex items-center gap-1">
            <FiCalendar className="w-3 h-3" /> Registered
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {DATE_PRESETS.map((p) => {
              const active = datePreset === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setDatePreset(p.key)}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${
                    active
                      ? 'bg-primary-500 text-white'
                      : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-faint)] flex items-center gap-1 ml-2">
            <FiUserCheck className="w-3 h-3" /> Source
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { key: '',      label: 'All',           Icon: null },
              { key: 'self',  label: 'Self-signup',   Icon: FiUserPlus },
              { key: 'admin', label: 'Admin-created', Icon: FiUserCheck },
            ].map((opt) => {
              const active = signupSource === opt.key;
              return (
                <button
                  key={opt.key || 'all'}
                  type="button"
                  onClick={() => setSignupSource(opt.key)}
                  className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${
                    active
                      ? 'bg-secondary-500 text-white'
                      : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                  }`}
                >
                  {opt.Icon && <opt.Icon className="w-3 h-3" />}
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-[var(--text-faint)]">
            <FiUsers className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">{hasActiveFilter ? 'No users match your filters' : 'No users yet'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[var(--bg-muted)]">
                {editMode ? (
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">User</th>
                    {FEATURE_COLUMNS.map((f) => {
                      const busyOn  = bulkApplying === `${f.key}:on`;
                      const busyOff = bulkApplying === `${f.key}:off`;
                      return (
                        <th key={f.key} className="px-3 py-2 text-center text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider align-top">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="flex items-center gap-1">
                              <f.Icon className="w-3.5 h-3.5" />
                              <span className="hidden md:inline">{f.shortLabel}</span>
                            </span>
                            {/* Apply-to-all controls — one click flips every
                                student row for this feature in a single API. */}
                            <div className="flex gap-1">
                              <button
                                type="button"
                                title={`Enable ${f.shortLabel} for ALL students`}
                                disabled={!!bulkApplying}
                                onClick={() => onApplyFeatureToAll(f.key, true)}
                                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {busyOn ? '…' : 'All on'}
                              </button>
                              <button
                                type="button"
                                title={`Lock ${f.shortLabel} for ALL students`}
                                disabled={!!bulkApplying}
                                onClick={() => onApplyFeatureToAll(f.key, false)}
                                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {busyOff ? '…' : 'All off'}
                              </button>
                            </div>
                          </div>
                        </th>
                      );
                    })}
                    {/* Single "Courses" column — opens a popover with the
                        full course catalog as checkboxes (+ Grant-all toggle
                        at the top). Scales with N courses without widening
                        the table. The "Bulk" button in the header lets admin
                        grant/revoke specific courses across all filtered rows. */}
                    <th className="px-3 py-2 text-center text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider align-top">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="flex items-center gap-1">
                          <FiBook className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Courses</span>
                        </span>
                        {loadingCourses && courses.length === 0 ? (
                          <span className="text-[10px] text-[var(--text-faint)] normal-case font-normal">loading…</span>
                        ) : (
                          <BulkCoursesDropdown
                            courses={courses}
                            disabled={!!bulkApplying}
                            onApply={onBulkGrantCourses}
                          />
                        )}
                      </div>
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">All</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">Actions</th>
                  </tr>
                ) : (
                  <tr>
                    {/* Compact columns that combine related fields:
                        Student   = name + s/o father + email
                        Location  = province + district
                        Academics = class + status
                        FSC       = college + board                            */}
                    {['Student', 'Contact', 'Location', 'Academics', 'FSC', 'Role', 'Joined', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                {users.map((user) => editMode ? (
                  // ── Edit Mode row — merged identity column + 5 toggles ─────
                  <tr key={user._id} className="odd:bg-[var(--bg-surface)] even:bg-[var(--bg-muted)] hover:bg-primary-50/40 dark:hover:bg-primary-950/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[var(--text-strong)] truncate max-w-[180px]">{user.fullName}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${ROLE_COLORS[user.role]}`}>
                            {user.role}
                          </span>
                        </div>
                        <span className="text-xs text-[var(--text-muted)] truncate max-w-[220px]">{user.email}</span>
                      </div>
                    </td>
                    {FEATURE_COLUMNS.map((f) => {
                      const on = getCellValue(user, f.key);
                      const busy = savingCell === `${user._id}:${f.key}`;
                      const isStudent = user.role === 'student';
                      return (
                        <td key={f.key} className="px-3 py-3 text-center">
                          {isStudent ? (
                            <MiniToggle on={on} disabled={busy} onClick={() => onToggleFeatureCell(user._id, f.key)} />
                          ) : (
                            <span className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider">staff</span>
                          )}
                        </td>
                      );
                    })}
                    {/* Single "Courses" cell — opens the multi-select popover. */}
                    <td className="px-3 py-3 text-center">
                      {user.role === 'student' ? (
                        <CoursesDropdown
                          user={user}
                          courses={courses}
                          busyKey={savingCell}
                          onToggleCourse={onToggleCourseCell}
                          onToggleGrantAll={onToggleGrantAllForUser}
                        />
                      ) : <span className="text-[var(--text-faint)]">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {user.role === 'student' ? (
                        <button
                          onClick={() => onToggleAllForUser(user._id)}
                          className="text-xs px-2 py-1 rounded-md bg-[var(--bg-muted)] hover:bg-[var(--border)] text-[var(--text)] font-medium"
                          title="Flip all 5 feature toggles for this user"
                        >
                          flip
                        </button>
                      ) : <span className="text-[var(--text-faint)]">—</span>}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <Link
                        to={`/admin/users/${user._id}`}
                        className="p-1.5 rounded-lg text-primary-600 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors inline-flex"
                        title="Open full profile"
                      >
                        <FiEdit className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ) : (
                  // ── Normal view row ─────────────────────────────────────────
                  // Combined-column layout: each cell stacks 2-3 lines of
                  // related fields, so all profile data is visible at a glance
                  // without needing a separate expand row. Empty fields show
                  // as "—" to keep row heights even.
                  <tr key={user._id} className="odd:bg-[var(--bg-surface)] even:bg-[var(--bg-muted)] hover:bg-primary-50/40 dark:hover:bg-primary-950/20 transition-colors">
                    {/* Student: name / s/o father / email */}
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-[var(--text-strong)] leading-tight">{user.fullName}</div>
                      {user.fatherName && (
                        <div className="text-xs text-[var(--text-muted)] leading-tight mt-0.5">s/o {user.fatherName}</div>
                      )}
                      <div className="text-xs text-[var(--text-muted)] leading-tight mt-0.5 truncate max-w-[240px]">{user.email}</div>
                    </td>
                    {/* Contact */}
                    <td className="px-4 py-3 whitespace-nowrap text-[var(--text)] text-sm align-top">
                      {user.contactNumber || '—'}
                    </td>
                    {/* Location: province / district */}
                    <td className="px-4 py-3 align-top text-sm">
                      <div className="text-[var(--text)] leading-tight">{user.province || '—'}</div>
                      <div className="text-xs text-[var(--text-muted)] leading-tight mt-0.5">{user.district || '—'}</div>
                    </td>
                    {/* Academics: class / status */}
                    <td className="px-4 py-3 align-top text-sm">
                      <div className="text-[var(--text)] leading-tight">{user.studentClass || '—'}</div>
                      <div className="text-xs text-[var(--text-muted)] leading-tight mt-0.5">{user.studentStatus || '—'}</div>
                    </td>
                    {/* FSC: college / board */}
                    <td className="px-4 py-3 align-top text-sm">
                      <div className="text-[var(--text)] leading-tight truncate max-w-[200px]" title={user.fscCollegeName || ''}>{user.fscCollegeName || '—'}</div>
                      <div className="text-xs text-[var(--text-muted)] leading-tight mt-0.5 truncate max-w-[200px]" title={user.fscBoard || ''}>{user.fscBoard || '—'}</div>
                    </td>
                    {/* Role */}
                    <td className="px-4 py-3 whitespace-nowrap align-top">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[user.role]}`}>
                        {user.role}
                      </span>
                    </td>
                    {/* Joined */}
                    <td className="px-4 py-3 whitespace-nowrap text-[var(--text-muted)] text-sm align-top">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3 whitespace-nowrap align-top">
                      <div className="flex gap-1">
                        <Link
                          to={`/admin/users/${user._id}`}
                          className="p-1.5 rounded-lg text-primary-600 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
                          title="Edit"
                        >
                          <FiEdit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => setDeleteId(user._id)}
                          className="p-1.5 rounded-lg text-rose-500 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Delete"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {editMode && (
              <div className="px-5 py-3 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-900/40 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                <p className="flex items-start gap-2">
                  <FiToggleRight className="w-4 h-4 mt-0.5" />
                  <span>
                    Edit Mode shows <strong>students only</strong>. Each toggle saves instantly (1 API call).
                    The column header <strong>"All on" / "All off"</strong> flips that feature for every student
                    matching the <strong>currently active filters</strong> (date range, signup source, etc.).
                  </span>
                </p>
                <p className="pl-6">
                  The <strong>Courses</strong> cell opens a popover with a search box, a <em>Grant all</em> toggle,
                  and a checkbox per course. Selections save instantly. Grant-all unlocks every course (current &amp; future);
                  per-course ticks are ignored while it's on.
                  The <strong>Bulk</strong> button in the Courses column header lets you grant or revoke specific courses
                  for all filtered students at once (does not affect grant-all).
                </p>
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="px-5 py-3 border-t border-[var(--border-faint)] flex items-center justify-between">
            <p className="text-sm text-[var(--text-muted)]">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FiChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '…' ? (
                    <span key={`e${i}`} className="px-2 text-[var(--text-faint)] text-sm">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => handlePageChange(p)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        p === page
                          ? 'bg-primary-500 text-white'
                          : 'border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}

              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FiChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Bulk Upload Modal ───────────────────────────────────────────────── */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[var(--text-strong)]">Bulk User Upload</h2>
              <button onClick={() => setUploadOpen(false)} className="text-[var(--text-faint)] hover:text-[var(--text)]">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4 mb-4 text-sm text-blue-800 dark:text-blue-200">
              <p className="font-semibold mb-1">Excel / CSV columns:</p>
              <p><code className="bg-blue-100 dark:bg-blue-900/60 px-1 rounded">Name</code> · <code className="bg-blue-100 dark:bg-blue-900/60 px-1 rounded">Email</code> · <code className="bg-blue-100 dark:bg-blue-900/60 px-1 rounded">Password</code> (required) · <code className="bg-blue-100 dark:bg-blue-900/60 px-1 rounded">ContactNumber</code> · <code className="bg-blue-100 dark:bg-blue-900/60 px-1 rounded">Role</code> (student/teacher/admin)</p>
              <p className="mt-1 text-blue-600 dark:text-blue-300 text-xs">ContactNumber and Role are optional. Role defaults to <strong>student</strong>.</p>
            </div>

            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-200 mb-4 font-medium"
            >
              <FiDownload className="w-4 h-4" /> Download CSV template
            </button>

            {/* File pick */}
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[var(--border)] rounded-xl cursor-pointer hover:border-primary-400 hover:bg-primary-50/40 dark:hover:bg-primary-950/20 transition-colors">
              <FiUpload className="w-7 h-7 text-[var(--text-faint)] mb-2" />
              <p className="text-sm text-[var(--text-muted)]">Click to select .xlsx or .xls file</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>

            {uploading && (
              <div className="flex items-center gap-2 mt-3 text-sm text-primary-600 dark:text-primary-300">
                <div className="animate-spin h-4 w-4 rounded-full border-b-2 border-primary-500" />
                Uploading and processing…
              </div>
            )}

            {/* Results */}
            {uploadResult && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-medium text-sm">
                  <FiCheckCircle className="w-4 h-4" />
                  {uploadResult.created} user(s) created · {uploadResult.skipped} skipped
                </div>
                {uploadResult.errors?.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                    {uploadResult.errors.map((e, i) => (
                      <div key={i} className="flex gap-2">
                        <FiAlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>Row {e.row} ({e.email}): {e.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setUploadOpen(false)}
              className="mt-5 w-full py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-muted)] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center">
                <FiTrash2 className="w-5 h-5 text-rose-600 dark:text-rose-300" />
              </div>
              <div>
                <h2 className="font-bold text-[var(--text-strong)]">Delete User</h2>
                <p className="text-sm text-[var(--text-muted)]">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
