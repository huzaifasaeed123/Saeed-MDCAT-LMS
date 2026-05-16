// modules/courses/pages/student/CourseCatalogPage.jsx
//
// Student "My Courses" catalog. Single existing API call (`GET /courses`)
// powers everything — category pills, sort, search, grid/list view, locked
// state — all derived client-side from the data we already have.
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiBookOpen, FiSearch, FiArrowRight, FiLock, FiPlay,
  FiGrid, FiList, FiX, FiLoader, FiCalendar, FiCheckCircle, FiFileText,
} from 'react-icons/fi';
import apiClient from '../../../../core/api/axiosConfig';
import useAuth from '../../../../core/auth/useAuth';
import { fixImageUrl } from '../../../../shared/utils/fixImageUrls';
import { usePageHeader } from '../../../../core/layouts/PageHeaderContext';

// ── Category inference ───────────────────────────────────────────────────────
// We don't have a `category` field on Course — the screenshot's pill labels
// (BIOLOGY, CHEMISTRY, …) are inferred from the course title. Each course
// gets exactly one category; unmatched titles fall back to "Other".
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

// Per-category hero gradient. Uses the brand palette where it fits and
// neutral gradients otherwise so the cards stay vibrant in light + dark mode.
const CATEGORY_GRADIENTS = {
  biology:   'from-emerald-500 via-teal-500 to-cyan-600',
  chemistry: 'from-violet-600 via-purple-600 to-fuchsia-600',
  physics:   'from-orange-500 via-amber-500 to-rose-500',
  english:   'from-blue-600 via-indigo-600 to-violet-600',
  logic:     'from-pink-500 via-rose-500 to-red-500',
  mocks:     'from-sky-500 via-blue-600 to-indigo-700',
  other:     'from-slate-500 via-slate-600 to-slate-700',
};

// "1 Jan – 30 Mar 2026" / "Starts 1 Jan 2026" / "Ends 30 Mar 2026" / null
// Returns null when both ends are missing, so the caller can hide the row.
const formatDuration = (start, end) => {
  if (!start && !end) return null;
  const fmt = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtNoYear = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  if (start && end) {
    const sameYear = new Date(start).getFullYear() === new Date(end).getFullYear();
    return `${sameYear ? fmtNoYear(start) : fmt(start)} – ${fmt(end)}`;
  }
  return start ? `Starts ${fmt(start)}` : `Ends ${fmt(end)}`;
};

const SORT_OPTIONS = [
  { key: 'recent',  label: 'Recently added',   cmp: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) },
  { key: 'oldest',  label: 'Oldest first',     cmp: (a, b) => new Date(a.createdAt) - new Date(b.createdAt) },
  { key: 'a-z',     label: 'Title (A–Z)',      cmp: (a, b) => a.title.localeCompare(b.title) },
  { key: 'z-a',     label: 'Title (Z–A)',      cmp: (a, b) => b.title.localeCompare(a.title) },
];

// ── Avatar (instructor initials) ─────────────────────────────────────────────
const initials = (name = '') =>
  name.split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
const AVATAR_COLORS = ['bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-rose-500', 'bg-teal-500'];
const avatarColor = (name = '') => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

const InstructorAvatar = ({ name = '', picture }) => {
  const src = fixImageUrl(picture);
  if (src) {
    return <img src={src} alt={name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />;
  }
  return (
    <div className={`w-7 h-7 ${avatarColor(name)} rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0`}>
      {initials(name)}
    </div>
  );
};

// ── Card components ──────────────────────────────────────────────────────────
// Hero uses a 16:9 aspect ratio (standard course/video thumbnail) so the
// uploaded featureImage shows in full at its native shape. When no feature
// image is available, falls back to the category gradient. Title moves below
// the image so longer titles + descriptions get more breathing room.
const CourseCard = ({ course, unlocked, onOpen }) => {
  const cat = inferCategory(course);
  const grad = CATEGORY_GRADIENTS[cat.key] || CATEGORY_GRADIENTS.other;
  const heroImg = fixImageUrl(course.featureImage);

  return (
    <button
      onClick={onOpen}
      className={`group text-left bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden flex flex-col transition-all duration-200 ${
        unlocked
          ? 'hover:shadow-lg hover:-translate-y-0.5 hover:border-primary-300 dark:hover:border-primary-700'
          : 'hover:shadow-md'
      }`}
    >
      {/* Hero — 16:9 aspect ratio, full image when uploaded, gradient otherwise.
          Category pill and lock badge overlay the top corners so the image
          stays the focal point. */}
      <div className={`relative aspect-video w-full overflow-hidden ${heroImg ? 'bg-[var(--bg-muted)]' : `bg-gradient-to-br ${grad}`} ${!unlocked ? 'opacity-90' : ''}`}>
        {heroImg ? (
          <>
            <img
              src={heroImg}
              alt={course.title}
              className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 ${unlocked ? 'group-hover:scale-105' : ''}`}
            />
            {/* Subtle bottom gradient so the corner pills stay legible regardless of image content */}
            <span aria-hidden className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent" />
          </>
        ) : (
          <>
            {/* Decorative circles only on the gradient fallback */}
            <span aria-hidden className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
            <span aria-hidden className="absolute right-10 bottom-2 w-20 h-20 rounded-full bg-white/10" />
            <span aria-hidden className="absolute -right-4 bottom-8 w-16 h-16 rounded-full bg-white/10" />
          </>
        )}

        {/* Top corners: category + MDCAT year (left) / locked (right) */}
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
          {!unlocked && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-white/95 text-amber-700 rounded-full px-2 py-1 shadow-sm">
              <FiLock className="w-3 h-3" /> Locked
            </span>
          )}
        </div>
      </div>

      {/* Body — flex-1 so cards stretch to equal height across the row */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col">
        <h3 className="font-display text-base sm:text-lg font-extrabold text-[var(--text-strong)] tracking-[-0.01em] line-clamp-2 leading-snug">
          {course.title}
        </h3>

        {course.createdBy?.fullName && (
          <div className="flex items-center gap-2 mt-3">
            <InstructorAvatar name={course.createdBy.fullName} picture={course.createdBy.profilePicture} />
            <p className="text-sm font-medium text-[var(--text)] truncate">
              {course.createdBy.fullName}
            </p>
          </div>
        )}

        {course.shortDescription && (
          <p className="text-xs text-[var(--text-muted)] mt-3 line-clamp-2 leading-relaxed">
            {course.shortDescription}
          </p>
        )}

        {/* Meta row — duration + test count (only renders when at least one is present) */}
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

        {/* Progress bar — only shown when the course is unlocked AND has tests
            (otherwise there's nothing to track). */}
        {unlocked && (course.testCount ?? 0) > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-[var(--text-muted)] font-medium">Progress</span>
              <span className="font-bold text-[var(--text-strong)]">
                {course.progressPct ?? 0}%
                <span className="text-[var(--text-faint)] font-medium ml-1">
                  ({course.attemptedTestCount ?? 0}/{course.testCount})
                </span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--bg-muted)] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  (course.progressPct ?? 0) >= 100
                    ? 'bg-emerald-500'
                    : 'bg-primary-500'
                }`}
                style={{ width: `${Math.min(100, course.progressPct ?? 0)}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer — pushed to the bottom so cards line up when they have
            different-length descriptions. */}
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-[var(--border-faint)]">
          <span className="text-[11px] text-[var(--text-faint)]">
            {new Date(course.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
          </span>
          {unlocked ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-primary-500 group-hover:bg-primary-600 rounded-full px-3.5 py-1.5 transition-colors">
              {(course.progressPct ?? 0) >= 100
                ? <><FiCheckCircle className="w-3 h-3" /> Review</>
                : (course.attemptedTestCount ?? 0) > 0
                  ? <><FiPlay className="w-3 h-3" /> Continue</>
                  : <><FiPlay className="w-3 h-3" /> Start</>
              }
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 rounded-full px-3.5 py-1.5">
              <FiLock className="w-3 h-3" /> Unlock
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

const CourseRow = ({ course, unlocked, onOpen }) => {
  const cat = inferCategory(course);
  const grad = CATEGORY_GRADIENTS[cat.key] || CATEGORY_GRADIENTS.other;
  return (
    <button
      onClick={onOpen}
      className="group w-full text-left bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden flex items-center gap-3 sm:gap-4 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all p-2 sm:p-3"
    >
      {/* Mini gradient block */}
      <div className={`w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br ${grad} rounded-xl flex items-center justify-center flex-shrink-0 ${!unlocked ? 'opacity-80' : ''}`}>
        <FiBookOpen className="w-6 h-6 text-white/90" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">{cat.label}</span>
          {!unlocked && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 rounded-full px-1.5 py-0.5">
              <FiLock className="w-2.5 h-2.5" /> Locked
            </span>
          )}
        </div>
        <p className="text-sm sm:text-base font-bold text-[var(--text-strong)] line-clamp-1">
          {course.title}
        </p>
        {course.createdBy?.fullName && (
          <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
            by {course.createdBy.fullName}
          </p>
        )}
      </div>
      <FiArrowRight className="w-4 h-4 text-[var(--text-faint)] group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all flex-shrink-0 hidden sm:block" />
    </button>
  );
};

// ── Main page ────────────────────────────────────────────────────────────────
const CourseCatalogPage = () => {
  const navigate = useNavigate();
  const { hasCourseAccess } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter / sort / view state — all frontend-only.
  const [activeCat,    setActiveCat]    = useState('all');
  const [activeStatus, setActiveStatus] = useState('all'); // 'all' | 'available' | 'locked'
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
        if (res.data.success) {
          // Students only see public courses (unchanged from original).
          setCourses(res.data.data.filter((c) => c.isPublic));
        }
      } catch {
        if (!cancelled) toast.error('Failed to load courses');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Annotate each course with its inferred category + unlock state once,
  // then filter / sort. Memoised so the heavy work only re-runs when inputs change.
  const annotated = useMemo(
    () => courses.map((c) => ({
      ...c,
      _category: inferCategory(c),
      _unlocked: hasCourseAccess(c._id),
    })),
    [courses, hasCourseAccess]
  );

  // Which category pills to show — only categories that have at least one
  // course, plus the "All" pill always. Uncategorised courses still surface
  // under "All", we just don't render a dedicated "Other" pill.
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
    if (activeStatus === 'available') list = list.filter((c) => c._unlocked);
    else if (activeStatus === 'locked') list = list.filter((c) => !c._unlocked);
    if (activeCat !== 'all') list = list.filter((c) => c._category.key === activeCat);
    if (q) list = list.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.shortDescription || '').toLowerCase().includes(q) ||
        (c.createdBy?.fullName || '').toLowerCase().includes(q)
    );
    const cmp = SORT_OPTIONS.find((o) => o.key === sortKey)?.cmp;
    return cmp ? [...list].sort(cmp) : list;
  }, [annotated, activeStatus, activeCat, search, sortKey]);

  // Subtitle stats — total enrolled + unlocked count (locked counts as not-yet-enrolled).
  const unlockedCount = annotated.filter((c) => c._unlocked).length;
  const subtitle = courses.length === 0
    ? 'No courses available yet'
    : `${courses.length} course${courses.length === 1 ? '' : 's'} · ${unlockedCount} unlocked`;

  usePageHeader({ title: 'My Courses', subtitle });

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
      {/* ── Status filter (left) + Sort + View (right) — single row.
          Wraps to two lines on narrow phones thanks to `flex-wrap`. Status
          counts come from `annotated` (pre-filter) so they stay stable. */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { key: 'all',       label: 'All',       count: annotated.length },
            { key: 'available', label: 'Available', count: annotated.filter((c) => c._unlocked).length },
            { key: 'locked',    label: 'Locked',    count: annotated.filter((c) => !c._unlocked).length },
          ].map((opt) => {
            const active = activeStatus === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setActiveStatus(opt.key)}
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

      {/* Category pills — own row below; hidden when only "All" exists. */}
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

      {/* ── Search bar (frontend filter) ── */}
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

      {/* ── Grid / List of courses ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)]">
          <FiBookOpen className="w-12 h-12 text-[var(--text-faint)] mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-1">
            {(search || activeCat !== 'all' || activeStatus !== 'all')
              ? 'No courses match your filters'
              : 'No courses available'}
          </h3>
          {(search || activeCat !== 'all' || activeStatus !== 'all') && (
            <button
              onClick={() => { setSearch(''); setActiveCat('all'); setActiveStatus('all'); }}
              className="text-xs text-primary-600 dark:text-primary-300 hover:underline mt-1"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 items-stretch">
          {filtered.map((course) => (
            <CourseCard
              key={course._id}
              course={course}
              unlocked={course._unlocked}
              onOpen={() => navigate(`/student/courses/${course._id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((course) => (
            <CourseRow
              key={course._id}
              course={course}
              unlocked={course._unlocked}
              onOpen={() => navigate(`/student/courses/${course._id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CourseCatalogPage;
