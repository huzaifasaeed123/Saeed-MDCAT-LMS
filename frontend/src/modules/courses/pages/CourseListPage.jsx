// modules/courses/pages/CourseListPage.jsx
//
// Admin "Courses" list. Mirrors the student catalog (CourseCatalogPage)
// layout — same gradient hero cards, theme tokens, category pills, sort and
// view toggle — but the action footer is Edit / Delete instead of Continue /
// Unlock, and there's a Public / Draft visibility filter instead of the
// student's Available / Locked status filter.
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiPlus, FiEdit2, FiTrash2, FiEye, FiEyeOff, FiBookOpen,
  FiSearch, FiGrid, FiList, FiX, FiLoader,
  FiCalendar, FiFileText, FiArrowRight,
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import { fixImageUrl } from '../../../shared/utils/fixImageUrls';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';

// ── Shared with the student catalog (kept in sync) ────────────────────────────
const CATEGORY_KEYWORDS = [
  { key: 'biology',   label: 'Biology',   match: /biolog|bio\b/i },
  { key: 'chemistry', label: 'Chemistry', match: /chem/i },
  { key: 'physics',   label: 'Physics',   match: /phys/i },
  { key: 'english',   label: 'English',   match: /english|grammar|vocab/i },
  { key: 'logic',     label: 'Logic',     match: /logic|reason/i },
  { key: 'mocks',     label: 'Mocks',     match: /mock|test series/i },
];

const inferCategory = (course) => {
  const t = `${course.title || ''} ${course.shortDescription || ''}`;
  for (const c of CATEGORY_KEYWORDS) if (c.match.test(t)) return c;
  return { key: 'other', label: 'Course' };
};

const CATEGORY_GRADIENTS = {
  biology:   'from-emerald-500 via-teal-500 to-cyan-600',
  chemistry: 'from-violet-600 via-purple-600 to-fuchsia-600',
  physics:   'from-orange-500 via-amber-500 to-rose-500',
  english:   'from-blue-600 via-indigo-600 to-violet-600',
  logic:     'from-pink-500 via-rose-500 to-red-500',
  mocks:     'from-sky-500 via-blue-600 to-indigo-700',
  other:     'from-slate-500 via-slate-600 to-slate-700',
};

const SORT_OPTIONS = [
  { key: 'recent', label: 'Recently added', cmp: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) },
  { key: 'oldest', label: 'Oldest first',   cmp: (a, b) => new Date(a.createdAt) - new Date(b.createdAt) },
  { key: 'a-z',    label: 'Title (A–Z)',    cmp: (a, b) => a.title.localeCompare(b.title) },
  { key: 'z-a',    label: 'Title (Z–A)',    cmp: (a, b) => b.title.localeCompare(a.title) },
];

const formatDuration = (start, end) => {
  if (!start && !end) return null;
  const fmt       = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtNoYear = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  if (start && end) {
    const sameYear = new Date(start).getFullYear() === new Date(end).getFullYear();
    return `${sameYear ? fmtNoYear(start) : fmt(start)} – ${fmt(end)}`;
  }
  return start ? `Starts ${fmt(start)}` : `Ends ${fmt(end)}`;
};

// ── Cards ─────────────────────────────────────────────────────────────────────
const AdminCourseCard = ({ course, onEdit, onDelete, deleting }) => {
  const cat = inferCategory(course);
  const grad = CATEGORY_GRADIENTS[cat.key] || CATEGORY_GRADIENTS.other;
  const heroImg = fixImageUrl(course.featureImage);

  return (
    <div
      onClick={onEdit}
      className="group text-left bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden flex flex-col cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary-300 dark:hover:border-primary-700"
    >
      {/* Hero — 16:9 image or category gradient */}
      <div className={`relative aspect-video w-full overflow-hidden ${heroImg ? 'bg-[var(--bg-muted)]' : `bg-gradient-to-br ${grad}`}`}>
        {heroImg ? (
          <>
            <img
              src={heroImg}
              alt={course.title}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <span aria-hidden className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent" />
          </>
        ) : (
          <>
            <span aria-hidden className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
            <span aria-hidden className="absolute right-10 bottom-2 w-20 h-20 rounded-full bg-white/10" />
            <span aria-hidden className="absolute -right-4 bottom-8 w-16 h-16 rounded-full bg-white/10" />
          </>
        )}

        {/* Top corners: category + MDCAT year (left) / visibility (right) */}
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2 z-10">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] bg-black/50 text-white/95 rounded-full px-2.5 py-1 backdrop-blur-sm">
              {cat.label}
            </span>
            {course.mdcatYear && (
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] bg-white/95 text-secondary-700 rounded-full px-2 py-1 shadow-sm">
                {course.mdcatYear}
              </span>
            )}
          </div>
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-1 shadow-sm ${
              course.isPublic
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-white/95 text-[var(--text-muted)]'
            }`}
          >
            {course.isPublic
              ? <><FiEye className="w-3 h-3" /> Public</>
              : <><FiEyeOff className="w-3 h-3" /> Draft</>
            }
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col">
        <h3 className="font-display text-base sm:text-lg font-extrabold text-[var(--text-strong)] tracking-[-0.01em] line-clamp-2 leading-snug">
          {course.title}
        </h3>

        {course.createdBy?.fullName && (
          <p className="text-xs text-[var(--text-muted)] mt-1.5">
            by <span className="font-medium text-[var(--text)]">{course.createdBy.fullName}</span>
          </p>
        )}

        {course.shortDescription && (
          <p className="text-xs text-[var(--text-muted)] mt-2 line-clamp-2 leading-relaxed">
            {course.shortDescription}
          </p>
        )}

        {/* Meta row — duration + test count */}
        {(formatDuration(course.startDate, course.endDate) || (course.testCount ?? 0) > 0) && (
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-3 text-[11px] text-[var(--text-muted)]">
            {formatDuration(course.startDate, course.endDate) && (
              <span className="inline-flex items-center gap-1">
                <FiCalendar className="w-3 h-3 text-[var(--text-faint)]" />
                {formatDuration(course.startDate, course.endDate)}
              </span>
            )}
            {(course.testCount ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1">
                <FiFileText className="w-3 h-3 text-[var(--text-faint)]" />
                {course.testCount} test{course.testCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
        )}

        {/* Footer — created date + admin actions (Edit / Delete) */}
        <div className="flex items-center justify-between gap-2 mt-auto pt-4 border-t border-[var(--border-faint)]">
          <span className="text-[11px] text-[var(--text-faint)]">
            {new Date(course.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
          </span>
          <div
            className="flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/40 hover:bg-primary-100 dark:hover:bg-primary-950/60 rounded-full px-3 py-1.5 transition-colors"
            >
              <FiEdit2 className="w-3 h-3" /> Edit
            </button>
            <button
              onClick={onDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/60 rounded-full px-3 py-1.5 disabled:opacity-50 transition-colors"
              aria-label="Delete course"
            >
              {deleting ? <FiLoader className="w-3 h-3 animate-spin" /> : <FiTrash2 className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminCourseRow = ({ course, onEdit, onDelete, deleting }) => {
  const cat = inferCategory(course);
  const grad = CATEGORY_GRADIENTS[cat.key] || CATEGORY_GRADIENTS.other;
  return (
    <div
      onClick={onEdit}
      className="group w-full text-left bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden flex items-center gap-3 sm:gap-4 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all p-2 sm:p-3 cursor-pointer"
    >
      <div className={`w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br ${grad} rounded-xl flex items-center justify-center flex-shrink-0`}>
        <FiBookOpen className="w-6 h-6 text-white/90" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">{cat.label}</span>
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 ${
              course.isPublic
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
            }`}
          >
            {course.isPublic ? 'Public' : 'Draft'}
          </span>
          {course.mdcatYear && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-secondary-700 dark:text-secondary-300">
              {course.mdcatYear}
            </span>
          )}
        </div>
        <p className="text-sm sm:text-base font-bold text-[var(--text-strong)] line-clamp-1">
          {course.title}
        </p>
        {course.createdBy?.fullName && (
          <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
            by {course.createdBy.fullName} · {(course.testCount ?? 0)} test{course.testCount === 1 ? '' : 's'}
          </p>
        )}
      </div>
      <div
        className="flex items-center gap-1.5 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onEdit}
          className="p-2 text-primary-600 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/40 rounded-lg transition-colors"
          aria-label="Edit course"
        >
          <FiEdit2 className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="p-2 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg disabled:opacity-50 transition-colors"
          aria-label="Delete course"
        >
          {deleting ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiTrash2 className="w-4 h-4" />}
        </button>
      </div>
      <FiArrowRight className="w-4 h-4 text-[var(--text-faint)] group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all flex-shrink-0 hidden sm:block" />
    </div>
  );
};

// ── Main page ────────────────────────────────────────────────────────────────
const CourseListPage = () => {
  const navigate = useNavigate();
  const [courses,    setCourses]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  // Frontend filter / sort / view state.
  const [activeCat,    setActiveCat]    = useState('all');
  const [activeVis,    setActiveVis]    = useState('all'); // 'all' | 'public' | 'draft'
  const [sortKey,      setSortKey]      = useState('recent');
  const [view,         setView]         = useState('grid'); // 'grid' | 'list'
  const [search,       setSearch]       = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.get('/courses');
        if (cancelled) return;
        if (res.data.success) setCourses(res.data.data);
      } catch {
        if (!cancelled) toast.error('Failed to load courses');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const annotated = useMemo(
    () => courses.map((c) => ({ ...c, _category: inferCategory(c) })),
    [courses]
  );

  const visibleCategories = useMemo(() => {
    const presentKeys = new Set(annotated.map((c) => c._category.key));
    return [
      { key: 'all', label: 'All' },
      ...CATEGORY_KEYWORDS.filter((c) => presentKeys.has(c.key)),
    ];
  }, [annotated]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = annotated;
    if (activeVis === 'public') list = list.filter((c) => c.isPublic);
    else if (activeVis === 'draft') list = list.filter((c) => !c.isPublic);
    if (activeCat !== 'all') list = list.filter((c) => c._category.key === activeCat);
    if (q) list = list.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.shortDescription || '').toLowerCase().includes(q) ||
        (c.createdBy?.fullName || '').toLowerCase().includes(q)
    );
    const cmp = SORT_OPTIONS.find((o) => o.key === sortKey)?.cmp;
    return cmp ? [...list].sort(cmp) : list;
  }, [annotated, activeVis, activeCat, search, sortKey]);

  const publicCount = annotated.filter((c) => c.isPublic).length;
  const draftCount  = annotated.length - publicCount;
  const subtitle = courses.length === 0
    ? 'No courses yet'
    : `${courses.length} course${courses.length === 1 ? '' : 's'} · ${publicCount} public · ${draftCount} draft`;

  // Memoise so PageHeaderContext doesn't see a fresh JSX object every render
  // (would cause its effect to re-fire → setHeader → infinite re-render loop).
  const headerAction = useMemo(() => (
    <button
      onClick={() => navigate('/admin/courses/create')}
      className="btn-brand text-sm"
    >
      <FiPlus className="w-4 h-4" /> Add new course
    </button>
  ), [navigate]);

  usePageHeader({
    title:    'Courses',
    subtitle,
    action:   headerAction,
  });

  const handleDelete = async (course) => {
    if (!window.confirm(`Delete "${course.title}"? This cannot be undone.`)) return;
    setDeletingId(course._id);
    try {
      await apiClient.delete(`/courses/${course._id}`);
      toast.success('Course deleted');
      setCourses((prev) => prev.filter((c) => c._id !== course._id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <FiLoader className="animate-spin w-8 h-8 text-[var(--text-faint)]" />
        <span className="ml-3 text-sm text-[var(--text-muted)]">Loading courses…</span>
      </div>
    );
  }

  return (
    <div>
      {/* ── Mobile-only action button (the navbar action slot is desktop-only) ── */}
      <div className="md:hidden mb-4">
        <button
          onClick={() => navigate('/admin/courses/create')}
          className="btn-brand text-sm w-full justify-center"
        >
          <FiPlus className="w-4 h-4" /> Add new course
        </button>
      </div>

      {/* ── Visibility filter (left) + Sort + View (right) — single row ── */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { key: 'all',    label: 'All',    count: annotated.length },
            { key: 'public', label: 'Public', count: publicCount },
            { key: 'draft',  label: 'Draft',  count: draftCount },
          ].map((opt) => {
            const active = activeVis === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setActiveVis(opt.key)}
                className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${
                  active
                    ? 'bg-secondary-600 text-white'
                    : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                }`}
              >
                {opt.label}
                <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
                  active ? 'bg-white/20 text-white' : 'bg-[var(--bg-muted)] text-[var(--text-faint)]'
                }`}>
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          <label className="hidden sm:flex items-center gap-2 text-xs text-[var(--text-muted)]">
            Sort by
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className="px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </label>

          <div className="flex bg-[var(--bg-muted)] rounded-xl border border-[var(--border)] p-0.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => setView('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                view === 'grid'
                  ? 'bg-[var(--bg-surface)] text-primary-600 dark:text-primary-300 shadow-sm'
                  : 'text-[var(--text-faint)] hover:text-[var(--text)]'
              }`}
              aria-label="Grid view"
            >
              <FiGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={`p-1.5 rounded-lg transition-colors ${
                view === 'list'
                  ? 'bg-[var(--bg-surface)] text-primary-600 dark:text-primary-300 shadow-sm'
                  : 'text-[var(--text-faint)] hover:text-[var(--text)]'
              }`}
              aria-label="List view"
            >
              <FiList className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Category pills — own row; hidden when only "All" would render. */}
      {visibleCategories.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 mb-5 no-scrollbar">
          {visibleCategories.map((c) => {
            const active = activeCat === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setActiveCat(c.key)}
                className={`text-sm px-3 py-1.5 rounded-xl font-semibold transition-colors flex-shrink-0 ${
                  active
                    ? (c.key === 'all'
                        ? 'bg-[var(--text-strong)] text-[var(--bg-surface)]'
                        : 'bg-primary-500 text-white')
                    : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Search bar ── */}
      <div className="relative mb-5">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] w-4 h-4" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search courses by title, description or instructor…"
          className="w-full pl-9 pr-9 py-2.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-faint)] hover:text-[var(--text)]"
            aria-label="Clear search"
          >
            <FiX className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Grid / List ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)]">
          <FiBookOpen className="w-12 h-12 text-[var(--text-faint)] mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-1">
            {(search || activeCat !== 'all' || activeVis !== 'all')
              ? 'No courses match your filters'
              : 'No courses yet'}
          </h3>
          {(search || activeCat !== 'all' || activeVis !== 'all') ? (
            <button
              onClick={() => { setSearch(''); setActiveCat('all'); setActiveVis('all'); }}
              className="text-xs text-primary-600 dark:text-primary-300 hover:underline mt-1"
            >
              Clear filters
            </button>
          ) : (
            <button
              onClick={() => navigate('/admin/courses/create')}
              className="btn-brand text-sm mt-3"
            >
              <FiPlus className="w-4 h-4" /> Create your first course
            </button>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 items-stretch">
          {filtered.map((course) => (
            <AdminCourseCard
              key={course._id}
              course={course}
              deleting={deletingId === course._id}
              onEdit={() => navigate(`/admin/courses/${course._id}/edit`)}
              onDelete={() => handleDelete(course)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((course) => (
            <AdminCourseRow
              key={course._id}
              course={course}
              deleting={deletingId === course._id}
              onEdit={() => navigate(`/admin/courses/${course._id}/edit`)}
              onDelete={() => handleDelete(course)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CourseListPage;
