import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiEdit, FiTrash2, FiPlusCircle, FiUpload, FiDownload,
  FiSearch, FiFilter, FiX, FiUsers, FiChevronLeft, FiChevronRight,
  FiAlertCircle, FiCheckCircle, FiToggleLeft, FiToggleRight,
  FiZap, FiBook, FiMessageCircle, FiVideo, FiFolder,
} from 'react-icons/fi';
import { PROVINCES, STUDENT_CLASSES, STUDENT_STATUSES } from '../../../shared/constants/studentProfile';
import apiClient from '../../../core/api/axiosConfig';
import {
  updateUserFeatureAccess, bulkApplyAccess,
  grantUserCourse, revokeUserCourse,
} from '../services/userService';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';

const PAGE_SIZE = 20;

const ROLE_COLORS = {
  admin:   'bg-secondary-100 text-secondary-800 dark:bg-secondary-950/40 dark:text-secondary-300',
  teacher: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  student: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
};

// Bulk Edit Mode columns. 'courses' is special — it maps to coursesGrantAll
// (not a featureAccess flag, since we removed the redundant master). Single
// source of truth; re-order here to re-order across the whole table.
const FEATURE_COLUMNS = [
  { key: 'autoTest',  shortLabel: 'Auto Test',  Icon: FiZap },
  { key: 'courses',   shortLabel: 'All Courses', Icon: FiBook }, // → coursesGrantAll
  { key: 'community', shortLabel: 'Community',  Icon: FiMessageCircle },
  { key: 'videos',    shortLabel: 'Videos',     Icon: FiVideo },
  { key: 'notes',     shortLabel: 'Notes',      Icon: FiFolder },
];

// Which user-row field does a column read from? 'courses' reads coursesGrantAll;
// everything else reads featureAccess[key]. Centralised so toggles + headers
// + bulk apply all stay consistent.
const getCellValue = (user, key) =>
  key === 'courses' ? !!user.coursesGrantAll : !!user.featureAccess?.[key];

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
  const fetchUsers = async (opts = {}) => {
    const {
      p  = page,
      s  = search,
      r  = role,
      em = editMode,
      prov = province,
      dist = district,
      cls  = studentClass,
      stat = studentStatus,
    } = opts;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: PAGE_SIZE });
      if (s) params.set('search', s);
      // In Edit Mode, force students; otherwise honour the role filter.
      const effectiveRole = em ? 'student' : r;
      if (effectiveRole)       params.set('role', effectiveRole);
      if (prov)                params.set('province', prov);
      if (dist && dist.trim()) params.set('district', dist.trim());
      if (cls)                 params.set('studentClass', cls);
      if (stat)                params.set('studentStatus', stat);
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
  }, [role, editMode, province, studentClass, studentStatus]);

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

  const hasActiveFilter = !!(search || role || province || district || studentClass || studentStatus);

  const clearFilters = () => {
    setSearch(''); setRole('');
    setProvince(''); setDistrict('');
    setStudentClass(''); setStudentStatus('');
    setPage(1);
    fetchUsers({ p: 1, s: '', r: '', prov: '', dist: '', cls: '', stat: '' });
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

  // Flip every column for one user. Builds the right payload for both the
  // 4 featureAccess flags AND coursesGrantAll in a single PATCH.
  const onToggleAllForUser = async (userId) => {
    const target = users.find((u) => u._id === userId);
    if (!target || target.role !== 'student') return;
    const fa = target.featureAccess || {};
    const allOn = FEATURE_COLUMNS.every((f) => getCellValue(target, f.key));
    const nextVal = !allOn;
    // Build a featureAccess patch (only real keys, not 'courses').
    const faPatch = Object.fromEntries(
      FEATURE_COLUMNS.filter((f) => f.key !== 'courses').map((f) => [f.key, nextVal])
    );
    const prevGrantAll = !!target.coursesGrantAll;

    setUsers((list) => list.map((u) => (
      u._id === userId ? { ...u, featureAccess: { ...fa, ...faPatch }, coursesGrantAll: nextVal } : u
    )));
    try {
      await updateUserFeatureAccess(userId, faPatch, { coursesGrantAll: nextVal });
      toast.success(nextVal ? 'All features enabled' : 'All features locked');
    } catch {
      // Revert
      setUsers((list) => list.map((u) => (
        u._id === userId ? { ...u, featureAccess: { ...fa }, coursesGrantAll: prevGrantAll } : u
      )));
      toast.error('Failed to update access');
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
      const res = await bulkApplyAccess(feature, value, 'student');
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
                    {/* Per-course columns. One column per course in the catalog
                        so admin can grant/revoke each course inline. Disabled
                        in rows where coursesGrantAll is on (grant-all overrides). */}
                    {courses.map((c) => (
                      <th key={c._id} className="px-2 py-2 text-center text-xs font-semibold text-[var(--text-faint)] align-top" title={c.title}>
                        <div className="flex flex-col items-center gap-1">
                          <FiBook className="w-3 h-3 text-primary-500" />
                          <span className="truncate max-w-[80px] text-[10px] normal-case" style={{ writingMode: 'horizontal-tb' }}>
                            {c.title}
                          </span>
                        </div>
                      </th>
                    ))}
                    {loadingCourses && courses.length === 0 && (
                      <th className="px-3 py-3 text-center text-[10px] text-[var(--text-faint)]">loading…</th>
                    )}
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
                    {/* Per-course cells. Grant-all overrides individual access:
                        when coursesGrantAll is true we visually show "on" and
                        disable the toggle so admin sees the implicit grant. */}
                    {courses.map((c) => {
                      const isStudent = user.role === 'student';
                      const grantAll  = !!user.coursesGrantAll;
                      const has       = (user.courseAccess || []).some((id) => String(id) === String(c._id));
                      const busy      = savingCell === `${user._id}:course:${c._id}`;
                      return (
                        <td key={c._id} className="px-2 py-3 text-center">
                          {isStudent ? (
                            <MiniToggle
                              on={grantAll || has}
                              disabled={busy || grantAll}
                              onClick={() => onToggleCourseCell(user._id, c._id)}
                            />
                          ) : <span className="text-[var(--text-faint)]">—</span>}
                        </td>
                      );
                    })}
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
                    The column header <strong>"All on" / "All off"</strong> flips that feature for every student in a single bulk update.
                  </span>
                </p>
                <p className="pl-6">
                  <strong>All Courses</strong> = grant-all (every course unlocked). When on, the per-course toggles
                  to the right are shown as on and locked (grant-all overrides them).
                </p>
                <p className="pl-6">
                  Individual <strong>course toggles</strong> let you grant/revoke specific courses per student.
                  Wide tables scroll horizontally.
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
