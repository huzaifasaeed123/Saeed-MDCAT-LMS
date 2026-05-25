// modules/courses/pages/student/CourseLearnPage.jsx
//
// Full-screen course player. Replaces the DashboardLayout chrome with our own
// top bar / sidebar / footer so the lesson fills the viewport — same pattern
// as the test player. Renders four resource types in the main area:
//   • lecture  → DriveVideoPlayer (inline)
//   • notes    → DrivePdfViewer  (inline)
//   • test     → mini "test details" card + Start button
//   • external → link card
//
// Progress model (per the recent design discussion):
//   • completedResourceIds is the union of manual marks + auto-derived test
//     completions from UserTestAttempt.
//   • Test resources do NOT show a "Mark complete" button — replaced with a
//     small chip "Auto-marked when you complete the test".
//   • lastResourceId is updated (debounced) whenever the active resource
//     changes; powers Continue Learning from the overview page.
//
// Test result flow:
//   • "Start Test" → POST /user-tests/start → navigate to the existing
//     /student/tests/:testId/play with `returnTo=<courseLearnUrl>&attempt=<id>`.
//   • On submit, TestPlayerPage honours returnTo and brings the student
//     back here; we render the result inline via the `attempt` query param.
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiArrowLeft, FiArrowRight, FiPlay, FiPause, FiCheck, FiCheckCircle, FiX,
  FiChevronDown, FiChevronUp, FiChevronLeft, FiChevronRight,
  FiVideo, FiFileText, FiCheckSquare, FiLink, FiBookOpen, FiLayers,
  FiLock, FiClock, FiSettings, FiMenu, FiAward, FiTarget, FiBarChart2,
  FiDownload, FiEye, FiZap, FiSun, FiMoon, FiMaximize2, FiMinimize2,
} from 'react-icons/fi';
import apiClient from '../../../../core/api/axiosConfig';
import useAuth from '../../../../core/auth/useAuth';
import useTheme from '../../../../core/theme/useTheme';
import LockedFeaturePage from '../../../access/pages/LockedFeaturePage';
import DrivePdfViewer   from '../../../../shared/components/DrivePdfViewer';
import DriveVideoPlayer from '../../../../shared/components/DriveVideoPlayer';
import TestStartPage         from '../../../tests/pages/TestStartPage';
import TestResultPage        from '../../../tests/pages/TestResultPage';
import TestAttemptReviewPage from '../../../tests/pages/TestAttemptReviewPage';
import {
  markResourceComplete, unmarkResourceComplete, updateLastViewed,
} from '../../services/courseProgressService';

// ── Helpers ─────────────────────────────────────────────────────────────────
const sortByOrder = (arr = []) => [...arr].sort((a, b) => (a.order || 0) - (b.order || 0));

const RES_META = {
  lecture:  { Icon: FiVideo,       label: 'Video',    tint: 'text-rose-500',     bg: 'bg-rose-50 dark:bg-rose-950/40' },
  notes:    { Icon: FiFileText,    label: 'Notes',    tint: 'text-sky-500',      bg: 'bg-sky-50 dark:bg-sky-950/40' },
  test:     { Icon: FiCheckSquare, label: 'Test',     tint: 'text-emerald-500',  bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  external: { Icon: FiLink,        label: 'External', tint: 'text-violet-500',   bg: 'bg-violet-50 dark:bg-violet-950/40' },
};

const getResourceStatus = (r) => {
  const { availability: av, unlockAt, lockAt } = r || {};
  if (!av || av === 'public') return 'available';
  const now = new Date();
  if (av === 'unlock_date') return unlockAt && now < new Date(unlockAt) ? 'locked' : 'available';
  if (av === 'window') {
    if (unlockAt && now < new Date(unlockAt)) return 'locked';
    if (lockAt   && now > new Date(lockAt))   return 'closed';
    return 'available';
  }
  return 'available';
};

// Walk a course tree and produce a flat ordered playlist with breadcrumbs.
// Used for Previous/Next navigation + initial-resource resolution.
//
// Structure mode → subject → chapter → topic? → resource.
// Date mode      → subject (the date entry) → its direct resources, plus
//                  any chapter/topic resources for admins who used
//                  `useSubGroups=true`. Entries are sorted by date per
//                  `displayMode === 'date'` + `contentSortOrder`, so the
//                  Prev / Next buttons walk the same order the sidebar
//                  shows.
const buildPlaylist = (subjects, opts = {}) => {
  const { displayMode = 'structure', sortOrder = 'upcoming_first' } = opts;
  const list = [];

  const ordered = (() => {
    const arr = [...(subjects || [])];
    if (displayMode === 'date') {
      arr.sort((a, b) => {
        const ad = a.unlockAt ? new Date(a.unlockAt).getTime() : null;
        const bd = b.unlockAt ? new Date(b.unlockAt).getTime() : null;
        if (ad == null && bd == null) return (a.order || 0) - (b.order || 0);
        if (ad == null) return 1;
        if (bd == null) return -1;
        return sortOrder === 'past_first' ? ad - bd : bd - ad;
      });
    } else {
      arr.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    return arr;
  })();

  ordered.forEach((subject) => {
    // Date mode: direct resources on the subject come first (they're the
    // entry's flat content). Structure mode: this loop is a no-op for
    // strict subject → chapter trees, but harmless if any subject happens
    // to also have direct resources.
    sortByOrder(subject.resources || []).forEach((r) => {
      list.push({ resource: r, subject, chapter: null, topic: null });
    });
    sortByOrder(subject.chapters || []).forEach((chapter) => {
      if (chapter.useTopics) {
        sortByOrder(chapter.topics || []).forEach((topic) => {
          sortByOrder(topic.resources || []).forEach((r) => {
            list.push({ resource: r, subject, chapter, topic });
          });
        });
      } else {
        sortByOrder(chapter.resources || []).forEach((r) => {
          list.push({ resource: r, subject, chapter, topic: null });
        });
      }
    });
  });
  return list;
};

// Format a resource's secondary line (duration / page count / mode).
const resourceMeta = (r) => {
  if (r.type === 'lecture') return null; // duration not stored on resource
  if (r.type === 'notes')   return 'PDF';
  if (r.type === 'test')    return 'Test';
  if (r.type === 'external') return 'External';
  return null;
};

// ── Sidebar Resource Row ────────────────────────────────────────────────────
const SidebarResourceRow = ({ resource, isActive, isCompleted, isLocked, onClick }) => {
  const meta = RES_META[resource.type] || RES_META.lecture;
  const Icon = meta.Icon;
  return (
    <button
      type="button"
      onClick={() => !isLocked && onClick(resource._id)}
      disabled={isLocked}
      className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
        isActive
          ? 'bg-primary-50 dark:bg-primary-950/40 ring-1 ring-primary-300 dark:ring-primary-800'
          : isLocked
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-[var(--bg-muted)] cursor-pointer'
      }`}
    >
      {/* Status icon — completed / playing / locked / default-type */}
      <span className="flex-shrink-0 mt-0.5">
        {isCompleted ? (
          <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
            <FiCheck className="w-3 h-3" strokeWidth={3} />
          </span>
        ) : isLocked ? (
          <FiLock className="w-4 h-4 text-[var(--text-faint)]" />
        ) : isActive ? (
          <span className={`w-5 h-5 rounded-full ${meta.bg} flex items-center justify-center`}>
            <FiPlay className={`w-3 h-3 ${meta.tint}`} fill="currentColor" />
          </span>
        ) : (
          <Icon className={`w-4 h-4 ${meta.tint}`} />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-tight truncate ${isActive ? 'font-bold text-primary-700 dark:text-primary-200' : 'text-[var(--text)]'}`}>
          {resource.title || meta.label}
        </p>
        <p className="text-[11px] text-[var(--text-faint)] mt-0.5">
          {meta.label}{resourceMeta(resource) ? ` · ${resourceMeta(resource)}` : ''}
          {isActive ? ' · Now playing' : ''}
          {isLocked  ? ' · Locked'      : ''}
        </p>
      </div>
    </button>
  );
};

// ── Topic group (under a chapter) ───────────────────────────────────────────
const SidebarTopicGroup = ({ topic, num, activeId, completedSet, onSelect, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen);
  const resources = sortByOrder(topic.resources);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-muted)] transition-colors"
      >
        {open ? <FiChevronDown className="w-3.5 h-3.5 text-[var(--text-faint)] flex-shrink-0" />
              : <FiChevronRight className="w-3.5 h-3.5 text-[var(--text-faint)] flex-shrink-0" />}
        <span className="text-[10px] font-mono font-bold text-secondary-700 dark:text-secondary-300 bg-secondary-50 dark:bg-secondary-950/40 px-1.5 py-0.5 rounded">{num}</span>
        <span className="text-xs font-semibold text-[var(--text)] truncate flex-1 text-left">{topic.title}</span>
        <span className="text-[10px] text-[var(--text-faint)]">{resources.length}</span>
      </button>
      {open && (
        <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-[var(--border-faint)] pl-2">
          {resources.map((r) => (
            <SidebarResourceRow
              key={r._id}
              resource={r}
              isActive={r._id === activeId}
              isCompleted={completedSet.has(String(r._id))}
              isLocked={getResourceStatus(r) === 'locked'}
              onClick={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Chapter group (under a subject) ─────────────────────────────────────────
const SidebarChapterGroup = ({ chapter, num, activeId, completedSet, onSelect, autoOpen }) => {
  const [open, setOpen] = useState(autoOpen);
  const topics    = sortByOrder(chapter.topics);
  const resources = sortByOrder(chapter.resources);
  const childCount = chapter.useTopics ? topics.length : resources.length;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors ${
          open ? 'bg-[var(--bg-muted)]/60' : 'hover:bg-[var(--bg-muted)]'
        }`}
      >
        {open ? <FiChevronDown className="w-4 h-4 text-[var(--text-faint)] flex-shrink-0" />
              : <FiChevronRight className="w-4 h-4 text-[var(--text-faint)] flex-shrink-0" />}
        <span className="text-[10px] font-mono font-bold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/40 px-1.5 py-0.5 rounded">{num}</span>
        <span className="text-sm font-bold text-[var(--text-strong)] truncate flex-1 text-left">{chapter.title}</span>
        <span className="text-[10px] text-[var(--text-faint)]">{childCount}</span>
      </button>
      {open && (
        <div className="ml-3 mt-1 space-y-0.5">
          {chapter.useTopics
            ? topics.map((t, i) => (
                <SidebarTopicGroup
                  key={t._id}
                  topic={t}
                  num={`${num}.${i + 1}`}
                  activeId={activeId}
                  completedSet={completedSet}
                  onSelect={onSelect}
                  defaultOpen={(t.resources || []).some((r) => r._id === activeId)}
                />
              ))
            : resources.map((r) => (
                <SidebarResourceRow
                  key={r._id}
                  resource={r}
                  isActive={r._id === activeId}
                  isCompleted={completedSet.has(String(r._id))}
                  isLocked={getResourceStatus(r) === 'locked'}
                  onClick={onSelect}
                />
              ))
          }
        </div>
      )}
    </div>
  );
};

// ── Subject group (top-level in sidebar) ────────────────────────────────────
const SidebarSubjectGroup = ({ subject, num, activeId, completedSet, onSelect, autoOpen }) => {
  const [open, setOpen] = useState(autoOpen);
  const chapters = sortByOrder(subject.chapters);
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl transition-colors border ${
          autoOpen
            ? 'border-primary-200 dark:border-primary-900/40 bg-primary-50/40 dark:bg-primary-950/20'
            : 'border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-muted)]'
        }`}
      >
        <span className="w-6 h-6 rounded-md bg-primary-500 text-white text-xs font-extrabold flex items-center justify-center flex-shrink-0">{num}</span>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-extrabold text-[var(--text-strong)] truncate">{subject.title}</p>
          <p className="text-[10px] text-[var(--text-faint)] mt-0.5">
            {chapters.length} chapter{chapters.length === 1 ? '' : 's'}
          </p>
        </div>
        {open ? <FiChevronUp className="w-4 h-4 text-[var(--text-faint)]" /> : <FiChevronDown className="w-4 h-4 text-[var(--text-faint)]" />}
      </button>
      {open && (
        <div className="mt-1.5 ml-1 space-y-1">
          {chapters.map((c, i) => (
            <SidebarChapterGroup
              key={c._id}
              chapter={c}
              num={`${num}.${i + 1}`}
              activeId={activeId}
              completedSet={completedSet}
              onSelect={onSelect}
              autoOpen={
                (c.useTopics
                  ? (c.topics || []).some((t) => (t.resources || []).some((r) => r._id === activeId))
                  : (c.resources || []).some((r) => r._id === activeId))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Sidebar Date group (date mode) ─────────────────────────────────────────
// Renders one calendar entry in the sidebar. Header shows the date (Wed
// May 14 …) above the entry title; body is a flat list of resources from
// `subject.resources` + any chapter/topic resources for admins who used
// `useSubGroups=true`. No nested chapter/topic dropdowns inside the date.
const collectDateEntryResources = (entry) => {
  const out = [...(entry?.resources || [])];
  for (const c of (entry?.chapters || [])) {
    out.push(...(c.resources || []));
    for (const t of (c.topics || [])) {
      out.push(...(t.resources || []));
    }
  }
  return [...out].sort((a, b) => (a.order || 0) - (b.order || 0));
};

const fmtSidebarDate = (v) => {
  if (!v) return '';
  try {
    return new Date(v).toLocaleDateString('en-PK', {
      timeZone: 'Asia/Karachi',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch { return ''; }
};

const SidebarDateGroup = ({ entry, num, activeId, completedSet, onSelect, autoOpen }) => {
  const [open, setOpen] = useState(autoOpen);
  const resources = useMemo(() => collectDateEntryResources(entry), [entry]);
  const dateChip  = fmtSidebarDate(entry.unlockAt);
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl transition-colors border ${
          autoOpen
            ? 'border-primary-200 dark:border-primary-900/40 bg-primary-50/40 dark:bg-primary-950/20'
            : 'border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-muted)]'
        }`}
      >
        <span className="w-6 h-6 rounded-md bg-primary-500 text-white text-xs font-extrabold flex items-center justify-center flex-shrink-0">{num}</span>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-extrabold text-[var(--text-strong)] truncate">{entry.title || 'Untitled entry'}</p>
          <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)] mt-0.5 truncate">
            {dateChip || `${resources.length} item${resources.length === 1 ? '' : 's'}`}
          </p>
        </div>
        {open ? <FiChevronUp className="w-4 h-4 text-[var(--text-faint)]" /> : <FiChevronDown className="w-4 h-4 text-[var(--text-faint)]" />}
      </button>
      {open && (
        <div className="mt-1 ml-1 space-y-0.5">
          {resources.map((r) => (
            <SidebarResourceRow
              key={r._id}
              resource={r}
              isActive={r._id === activeId}
              isCompleted={completedSet.has(String(r._id))}
              isLocked={getResourceStatus(r) === 'locked'}
              onClick={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main resource renderers ─────────────────────────────────────────────────
// All "media" resources (lecture / notes) render fill-parent: the player
// wrapper is `absolute inset-0`, so the iframe stretches across the entire
// main content area instead of being constrained to a 16:9 box or capped
// height. The course-player main container provides the bounding rect via
// `relative + flex-1`.
//
// The small absolutely-positioned div at the top-right is a click-blocker
// over Google Drive's "Open in new tab" popout icon — Drive renders that
// icon inside the iframe so we can't hide it from CSS. Earlier we matched
// the iframe background to *visually hide* the icon, but on phones that
// opaque tile masked real content underneath the toolbar. The block is now
// fully transparent — the popout icon stays visible but our overlay sits
// on top, swallowing taps so the user can't actually open the file outside
// the player. The icon becomes inert rather than invisible.
const DrivePopoutBlocker = ({ tall }) => (
  <div
    aria-hidden
    title="Disabled"
    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
    onTouchStart={(e) => { e.stopPropagation(); }}
    className="absolute top-0 right-0 z-10 cursor-default bg-transparent"
    style={{
      // Square dead-zone over Drive's popout icon. Slightly smaller box on
      // narrow viewports keeps it from eating into the actual content area.
      width: tall ? 56 : 48,
      height: tall ? 56 : 48,
    }}
  />
);

const VideoResourceView = ({ resource }) => {
  if (resource.driveFileId) {
    return (
      <div className="absolute inset-0 bg-black overflow-hidden">
        <iframe
          title={resource.title || 'Lecture'}
          src={`https://drive.google.com/file/d/${resource.driveFileId}/preview`}
          allow="autoplay; encrypted-media"
          allowFullScreen
          className="w-full h-full"
        />
        <DrivePopoutBlocker />
      </div>
    );
  }
  if (resource.youtubeUrl) {
    // Extract video id from common YouTube URL shapes (v=… / youtu.be/…).
    const m = resource.youtubeUrl.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
    const vid = m ? m[1] : null;
    if (!vid) return <ResourceEmptyState message="Invalid YouTube URL." />;
    return (
      <div className="absolute inset-0 bg-black overflow-hidden">
        <iframe
          title={resource.title || 'Lecture'}
          src={`https://www.youtube.com/embed/${vid}?rel=0&modestbranding=1`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    );
  }
  return <ResourceEmptyState message="No video source attached to this resource." />;
};

const NotesResourceView = ({ resource }) => {
  if (resource.driveFileId) {
    return (
      <div className="absolute inset-0 bg-[var(--bg-surface)] overflow-hidden">
        <iframe
          title={resource.title || 'Notes'}
          src={`https://drive.google.com/file/d/${resource.driveFileId}/preview`}
          className="w-full h-full"
          allowFullScreen
        />
        <DrivePopoutBlocker tall />
      </div>
    );
  }
  if (resource.fileUrl) {
    return (
      <div className="absolute inset-0 bg-[var(--bg-surface)] overflow-hidden">
        <iframe title={resource.title || 'Notes'} src={resource.fileUrl} className="w-full h-full" />
      </div>
    );
  }
  return <ResourceEmptyState message="No PDF attached to this resource." />;
};

const ExternalResourceView = ({ resource }) => (
  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center">
    <FiLink className="w-12 h-12 text-violet-500 mx-auto mb-4" />
    <h3 className="font-display text-lg font-bold text-[var(--text-strong)] mb-1">External resource</h3>
    <p className="text-sm text-[var(--text-muted)] mb-5">{resource.title || 'Open in a new tab'}</p>
    <a
      href={resource.externalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-brand text-sm inline-flex"
    >
      Open link <FiArrowRight className="w-4 h-4" />
    </a>
  </div>
);

const ResourceEmptyState = ({ message }) => (
  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-12 text-center">
    <FiFileText className="w-12 h-12 text-[var(--text-faint)] mx-auto mb-3 opacity-40" />
    <p className="text-sm text-[var(--text-muted)]">{message}</p>
  </div>
);

// Note: For test resources we render the existing TestStartPage / TestResultPage
// components in `embedded` mode rather than re-implementing their content here.
// That way the course-player view stays exactly in sync with the standalone
// /student/tests/:id and /student/tests/:testId/result/:attemptId pages — same
// hero, stats, mode picker, analytics tabs, leaderboard, etc. The only thing
// the player swaps out is the dashboard navbar (with our course-player top bar).
//
// The Start flow inside the embedded TestStartPage builds a returnTo that
// brings the user back here with ?attempt=<id>, which we then use to mount
// the embedded TestResultPage in the main area.

// ── Main page ───────────────────────────────────────────────────────────────
const CourseLearnPage = () => {
  const { id: courseId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasCourseAccess, loading: authLoading, user } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();

  if (!authLoading && !hasCourseAccess(courseId)) {
    return <LockedFeaturePage feature="courses" courseId={courseId} />;
  }

  // Data state
  const [course,   setCourse]   = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading,  setLoading]  = useState(true);

  // UI state — sidebar defaults closed on mobile (drawer behaviour) and
  // open on tablet/desktop where it sits in-flow next to the main area.
  // Initialiser runs once; we still expose setSidebarOpen so the user
  // (and the backdrop click) can flip it later.
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 768,
  );
  const [marking, setMarking] = useState(false);
  // Player-fullscreen — when true, the top bar / sidebar / footer all hide
  // and the active resource fills the entire viewport. We also call the OS
  // Fullscreen API on the outer container so the browser chrome (tab strip,
  // address bar, taskbar) disappears too — true "cover the entire screen"
  // behaviour. The two are kept in sync by the fullscreenchange listener
  // below, so pressing F11 / Esc / clicking our own toggle all converge to
  // the same state.
  const [playerFullscreen, setPlayerFullscreen] = useState(false);
  const rootRef = useRef(null);

  const enterFullscreen = useCallback(async () => {
    const el = rootRef.current;
    if (!el) return;
    try {
      const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (req) await req.call(el);
    } catch {
      // Some embedded contexts (iframes without `allow=fullscreen`) reject.
      // We still set the in-page chrome-less mode below so the user gets
      // SOMETHING bigger than the default layout.
    }
    setPlayerFullscreen(true);
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
        if (exit) await exit.call(document);
      }
    } catch { /* ignore */ }
    setPlayerFullscreen(false);
  }, []);

  // Sync our state with the OS state — covers F11, Esc, and the browser's
  // own "exit fullscreen" button.
  useEffect(() => {
    const onChange = () => {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      setPlayerFullscreen(isFs);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  // URL state
  const activeId       = searchParams.get('r');
  const showAttemptIdRaw  = searchParams.get('attempt');
  // The Course Player auto-shows the result view when the student has any
  // attempt on this test — completed OR in-progress — so re-opening a test
  // they've already taken doesn't bounce them through the Test Start page.
  // Explicit ?attempt=<id> in the URL wins (used after test submit), then
  // we fall back to the latest-attempt mapping returned by the progress
  // endpoint. `?attempt=new` is a sentinel set by the in-page "Retake test"
  // button so the page re-renders the Start view even when a latest attempt
  // exists in the data.
  const showStartInsteadOfResult = showAttemptIdRaw === 'new';
  // `?view=review` opens the embedded TestAttemptReviewPage inside the
  // player. Set by the "Review answers" button in the top bar so the
  // user stays inside the course context; cleared by the review page's
  // "Back to result" button via setSearchParams.
  const inReviewView = searchParams.get('view') === 'review';

  // Fetch course + progress in parallel
  const reload = useCallback(async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        apiClient.get(`/courses/${courseId}`),
        apiClient.get(`/courses/${courseId}/progress`).catch(() => null),
      ]);
      if (cRes.data?.success) setCourse(cRes.data.data);
      if (pRes?.data?.success) setProgress(pRes.data.data);
    } catch {
      toast.error('Failed to load course');
      navigate(`/student/courses/${courseId}`);
    } finally {
      setLoading(false);
    }
  }, [courseId, navigate]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  // Build the playlist + index it by resource id once per course load.
  const playlist = useMemo(
    () => buildPlaylist(course?.subjects, {
      displayMode: course?.displayMode,
      sortOrder:   course?.contentSortOrder,
    }),
    [course],
  );
  const indexById = useMemo(() => {
    const map = new Map();
    playlist.forEach((p, i) => map.set(String(p.resource._id), i));
    return map;
  }, [playlist]);

  // Resolve the active resource:
  //   • ?r=<id>      → that resource
  //   • lastViewed   → resume from there
  //   • else         → first resource in the playlist
  useEffect(() => {
    if (!course || playlist.length === 0) return;
    if (activeId && indexById.has(activeId)) return; // already valid
    const target = progress?.lastResourceId && indexById.has(progress.lastResourceId)
      ? progress.lastResourceId
      : String(playlist[0].resource._id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('r', target);
      return next;
    }, { replace: true });
  }, [course, playlist, indexById, activeId, progress, setSearchParams]);

  const activeIndex = activeId ? indexById.get(activeId) : -1;
  const activeNode  = activeIndex >= 0 ? playlist[activeIndex] : null;
  const activeResource = activeNode?.resource;

  // Debounced last-viewed write — fires 1s after the active resource stabilises.
  const lastViewedTimerRef = useRef(null);
  useEffect(() => {
    if (!activeId) return;
    clearTimeout(lastViewedTimerRef.current);
    lastViewedTimerRef.current = setTimeout(() => {
      updateLastViewed(courseId, activeId);
    }, 1000);
    return () => clearTimeout(lastViewedTimerRef.current);
  }, [courseId, activeId]);

  const completedSet = useMemo(
    () => new Set((progress?.completedResourceIds || []).map(String)),
    [progress],
  );

  const selectResource = useCallback((rid) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('r', rid);
      next.delete('attempt'); // changing resources drops any showing result
      return next;
    });
  }, [setSearchParams]);

  const clearAttemptParam = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('attempt');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const goPrev = useCallback(() => {
    if (activeIndex > 0) selectResource(playlist[activeIndex - 1].resource._id);
  }, [activeIndex, playlist, selectResource]);

  const goNext = useCallback(() => {
    if (activeIndex >= 0 && activeIndex < playlist.length - 1) {
      selectResource(playlist[activeIndex + 1].resource._id);
    }
  }, [activeIndex, playlist, selectResource]);

  // Toggle manual completion. Refreshes progress so the sidebar tick + %
  // both update.
  const onToggleComplete = useCallback(async (markIt) => {
    if (!activeResource || marking) return;
    if (activeResource.type === 'test') return;
    setMarking(true);
    try {
      if (markIt) await markResourceComplete(courseId, activeResource._id);
      else        await unmarkResourceComplete(courseId, activeResource._id);
      // Optimistic local update so the UI flips instantly.
      setProgress((p) => {
        if (!p) return p;
        const set = new Set(p.completedResourceIds.map(String));
        if (markIt) set.add(String(activeResource._id));
        else        set.delete(String(activeResource._id));
        return { ...p, completedResourceIds: [...set] };
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update progress');
    } finally {
      setMarking(false);
    }
  }, [activeResource, courseId, marking]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }
  if (!course) return null;

  const isCompleted = activeResource ? completedSet.has(String(activeResource._id)) : false;
  const isTest      = activeResource?.type === 'test';
  const isMedia     = activeResource?.type === 'lecture' || activeResource?.type === 'notes';
  const totalCount  = progress?.totalResources ?? playlist.length;
  const doneCount   = progress?.completedCount ?? 0;
  const progressPct = progress?.progressPct ?? 0;

  // Breadcrumb above the title in the top bar.
  //   • structure mode → Subject · Chapter · Topic (skipping any blanks).
  //   • date      mode → date chip + entry title (no chapter/topic).
  const breadcrumb = (() => {
    if (!activeNode) return '';
    if (course?.displayMode === 'date') {
      const subj = activeNode.subject;
      const dateChip = fmtSidebarDate(subj?.unlockAt);
      return [dateChip, subj?.title].filter(Boolean).join(' · ');
    }
    return [activeNode.subject?.title, activeNode.chapter?.title, activeNode.topic?.title]
      .filter(Boolean).join(' · ');
  })();

  // Is the main area showing the embedded TestResultPage?
  //   - explicit ?attempt=<id> deep link, OR
  //   - latest-completed attempt fallback (when not forced to Start view)
  // We need this in the top bar to decide whether to render Export/Review/Retake.
  const latestForActive       = activeResource && activeResource.type === 'test'
    ? progress?.latestAttemptByResource?.[String(activeResource._id)]
    : null;
  const resultAttemptForActive =
    (showAttemptIdRaw && !showStartInsteadOfResult) ? showAttemptIdRaw
    : (showStartInsteadOfResult ? null
    : (latestForActive?.status === 'completed' ? latestForActive.attemptId : null));
  // Top-bar action row appears for test resources that have a completed
  // attempt to act on. In review-view we keep the row (so the Review chip
  // shows as the active state) — but the actual Export/Retake buttons
  // are dimmed/hidden inside it because those are result-view actions.
  const isOnTestResult = activeResource?.type === 'test' && !!resultAttemptForActive;

  // Sidebar widths — referenced both by the sidebar itself AND the top bar
  // left zone so the two stay perfectly aligned at every breakpoint.
  const SIDEBAR_W = 'w-72 sm:w-80';

  return (
    <div ref={rootRef} className="fixed inset-0 bg-[var(--bg)] flex flex-col">
      {/* ── Top bar ─────────────────────────────────────────────────────────
          Two zones: a LEFT zone that matches the sidebar width on desktop so
          it sits flush above the sidebar, and a RIGHT zone that flows over
          the main content area (title + result-view action buttons).
          On mobile the left zone collapses to just the Back link + hamburger
          since the sidebar itself is a drawer. */}
      {/* When playerFullscreen is on we drop the entire chrome (top bar +
          sidebar + footer) and let the active resource own the viewport.
          A small floating "Exit fullscreen" button is rendered separately
          at the bottom of this component. */}
      {!playerFullscreen && (
      <header className="flex-shrink-0 h-11 sm:h-12 border-b border-[var(--border)] bg-[var(--bg-surface)] flex items-stretch">
        {/* LEFT zone — sidebar toggle (mobile only) + back link.
            • Mobile: hamburger comes BEFORE "Back to course" so the open/close
              action is the leftmost touch target — the standard drawer pattern.
            • Desktop: the hamburger is gone; the dashboard-style floating
              chevron toggle on the sidebar's right edge handles open/close.
              Left zone tracks the sidebar width on md+ so the divider lines
              up with the sidebar's right edge. */}
        <div
          className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 flex-shrink-0 transition-all duration-200 ${
            sidebarOpen ? 'md:w-80 md:border-r md:border-[var(--border)]' : ''
          }`}
        >
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[var(--bg-muted)] text-[var(--text-muted)]"
            title={sidebarOpen ? 'Hide content sidebar' : 'Show content sidebar'}
            aria-label="Toggle content sidebar"
          >
            <FiMenu className="w-4 h-4" />
          </button>

          <Link
            to={`/student/courses/${courseId}`}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs sm:text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-muted)] transition-colors"
          >
            <FiArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to course</span>
          </Link>
        </div>

        {/* RIGHT zone — title + (test-result actions) + theme/fullscreen toggles.
            Sits over the main content area, so the title is visually anchored
            to where the student is reading. */}
        <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 flex-1 min-w-0">
          <div className="min-w-0 flex-1">
            {breadcrumb && (
              <p className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-[var(--text-faint)] truncate leading-none">
                {breadcrumb}
              </p>
            )}
            <p className="text-sm sm:text-[15px] font-bold text-[var(--text-strong)] truncate leading-tight mt-0.5">
              {activeResource?.title || course.title}
            </p>
          </div>

          {/* Test-result actions — only when the main area is the embedded
              TestResultPage. These mirror the standalone TestResultPage's
              header actions (Export PDF / Review / Retake) one-to-one. */}
          {isOnTestResult && (
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {/* Export PDF — only meaningful from the Result view. Hidden
                  while the embedded Review screen is up. */}
              {!inReviewView && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  title="Export PDF"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
                >
                  <FiDownload className="w-4 h-4" />
                  <span className="hidden lg:inline">Export PDF</span>
                </button>
              )}
              {(() => {
                // Review button — two responsibilities:
                //   1. Gate based on the test's `reviewUnlockAt` schedule
                //      (creators bypass). The fields are already populated
                //      on `activeResource.testId` via the course doc, so
                //      no extra HTTP/DB hit. Backend re-checks on its own
                //      regardless when the user actually requests review
                //      data — frontend gate is just for the disabled UI.
                //   2. Stay INSIDE the course player on click — flip
                //      `?view=review` instead of navigating away to the
                //      standalone /student/tests/.../review route. The
                //      embedded TestAttemptReviewPage below reads this
                //      flag and calls onBack() to clear it.
                const testObj = activeResource.testId || {};
                const meId = user?._id || user?.id;
                const isCreator = testObj.createdBy
                  && (testObj.createdBy === meId || testObj.createdBy?.toString?.() === meId);
                const ru = testObj.reviewUnlockAt;
                const reviewLocked = !isCreator && ru && Date.now() < new Date(ru).getTime();
                const onReviewClick = () => {
                  if (reviewLocked) {
                    toast.info('Review opens later. Check the test schedule.');
                    return;
                  }
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.set('view', 'review');
                    return next;
                  });
                };
                return (
                  <button
                    type="button"
                    onClick={onReviewClick}
                    title={reviewLocked ? 'Review is locked until the scheduled time' : 'Review answers'}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors ${reviewLocked ? 'opacity-50' : ''}`}
                  >
                    <FiEye className="w-4 h-4" />
                    <span className="hidden lg:inline">Review</span>
                  </button>
                );
              })()}
              {/* Retake — Result-view action; hidden in review-view since
                  starting a new attempt while reviewing answers doesn't
                  match the user's intent. */}
              {!inReviewView && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      next.set('attempt', 'new');
                      // Also drop any lingering review flag.
                      next.delete('view');
                      return next;
                    });
                  }}
                  title="Retake test"
                  className="btn-brand text-xs px-2.5 py-1.5"
                >
                  <FiZap className="w-4 h-4" />
                  <span className="hidden lg:inline">Retake</span>
                </button>
              )}
            </div>
          )}

          {/* Fullscreen toggle — only meaningful for media resources (lecture
              / notes). Hidden for tests / external since those have their own
              page chrome that would look wrong stretched edge-to-edge. */}
          {isMedia && (
            <button
              type="button"
              onClick={enterFullscreen}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--bg-muted)] transition-colors flex-shrink-0"
              title="Fullscreen"
              aria-label="Enter fullscreen"
            >
              <FiMaximize2 className="w-4 h-4" />
            </button>
          )}

          {/* Theme toggle — mirrors the dashboard navbar so the player still
              feels like part of the same app. */}
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--bg-muted)] transition-colors flex-shrink-0"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
          </button>
        </div>
      </header>
      )}

      {/* ── Body: sidebar + main ────────────────────────────────────────── */}
      {/* In fullscreen mode the sidebar and floating chevron are hidden so
          the player owns the viewport. We keep the wrapper so the main area
          still sizes correctly via flex-1. */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Mobile backdrop — taps outside the sidebar to close. Confined
            within the body container so it doesn't darken the top bar. */}
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close content sidebar"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden absolute inset-0 bg-black/40 z-20 cursor-default"
          />
        )}

        {/* Desktop collapse toggle — floating chevron. Lives as a sibling of
            the aside so its position is driven by the BODY container, not by
            the aside's zero-width rect when collapsed. When open it straddles
            the sidebar's right edge (12px outside); when closed it sits at
            the very left of the main content where the student would
            naturally look to expand the panel back. Hidden in fullscreen. */}
        {!playerFullscreen && (
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          className={`hidden md:flex absolute top-3 z-40 w-6 h-6 items-center justify-center rounded-full
                      bg-[var(--bg-surface)] border border-[var(--border)] shadow-md
                      hover:shadow-lg text-[var(--text-muted)]
                      hover:text-primary-600 dark:hover:text-primary-400
                      hover:border-primary-300 dark:hover:border-primary-700
                      transition-all duration-200 ${
                        sidebarOpen
                          // 20rem = w-80 (sidebar width on md+). 0.75rem ≈
                          // half the button's width so it straddles the edge.
                          ? 'left-[calc(20rem-0.75rem)]'
                          // Sit just inside the main content area when the
                          // sidebar is collapsed — fully visible, easy to spot.
                          : 'left-2'
                      }`}
        >
          {sidebarOpen ? <FiChevronLeft className="w-3.5 h-3.5" /> : <FiChevronRight className="w-3.5 h-3.5" />}
        </button>
        )}

        {/* Sidebar.
              Mobile  → fixed overlay drawer, slides in from the left.
              Desktop → in-flow column whose width collapses to 0 when closed.
              Fullscreen → fully hidden (display:none via the wrapper class). */}
        <aside
          className={`
            ${playerFullscreen ? 'hidden' : ''}
            absolute md:relative inset-y-0 left-0 z-30 ${SIDEBAR_W}
            border-r border-[var(--border)] bg-[var(--bg-surface)]
            flex flex-col transition-all duration-200
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0'}
          `}
        >
          {/* Inner content wrapper — overflow-hidden lives HERE (not on the
              aside itself) so the collapsed-desktop sidebar (md:w-0) cleanly
              clips its own children. The floating chevron toggle was lifted
              out of the aside (see body container below) so it can be
              positioned by viewport math rather than tied to the aside's
              zero-width rect when collapsed. */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Sidebar header — title + progress + (mobile-only) close X */}
            <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--border)]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)]">Course Content</p>
                  <p className="text-sm font-bold text-[var(--text-strong)] truncate mt-0.5">{course.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="md:hidden flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-faint)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)] transition-colors"
                  title="Close sidebar"
                  aria-label="Close sidebar"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-2.5">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)] mb-1">
                  <span>{doneCount} / {totalCount} done</span>
                  <span className="font-bold text-primary-600 dark:text-primary-300">{progressPct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-muted)] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500"
                    style={{ width: `${Math.max(progressPct ? 4 : 0, progressPct)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Sidebar tree (scrollable). Two render branches:
                  • date      → SidebarDateGroup per calendar entry (flat
                    resource list inside; no nested chapter/topic groups).
                    Entries are sorted by date per contentSortOrder.
                  • structure → existing subject → chapter → topic tree. */}
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {course.displayMode === 'date'
                ? (() => {
                    const sortOrder = course.contentSortOrder || 'upcoming_first';
                    const entries = [...(course.subjects || [])].sort((a, b) => {
                      const ad = a.unlockAt ? new Date(a.unlockAt).getTime() : null;
                      const bd = b.unlockAt ? new Date(b.unlockAt).getTime() : null;
                      if (ad == null && bd == null) return (a.order || 0) - (b.order || 0);
                      if (ad == null) return 1;
                      if (bd == null) return -1;
                      return sortOrder === 'past_first' ? ad - bd : bd - ad;
                    });
                    return entries.map((e, i) => (
                      <SidebarDateGroup
                        key={e._id}
                        entry={e}
                        num={i + 1}
                        activeId={activeId}
                        completedSet={completedSet}
                        onSelect={(rid) => {
                          selectResource(rid);
                          if (typeof window !== 'undefined' && window.innerWidth < 768) {
                            setSidebarOpen(false);
                          }
                        }}
                        autoOpen={
                          collectDateEntryResources(e).some((r) => r._id === activeId)
                        }
                      />
                    ));
                  })()
                : sortByOrder(course.subjects).map((s, i) => (
                    <SidebarSubjectGroup
                      key={s._id}
                      subject={s}
                      num={i + 1}
                      activeId={activeId}
                      completedSet={completedSet}
                      onSelect={(rid) => {
                        selectResource(rid);
                        // Auto-close on mobile so the user actually sees the
                        // content they just picked.
                        if (typeof window !== 'undefined' && window.innerWidth < 768) {
                          setSidebarOpen(false);
                        }
                      }}
                      autoOpen={
                        (s.chapters || []).some((c) => (
                          c.useTopics
                            ? (c.topics || []).some((t) => (t.resources || []).some((r) => r._id === activeId))
                            : (c.resources || []).some((r) => r._id === activeId)
                        ))
                      }
                    />
                  ))
              }
            </div>
          </div>
        </aside>

        {/* Main content area.
            • Media (lecture / notes): full-bleed — the iframe wrapper is
              `absolute inset-0` so it fills the entire main rect. The
              <main> is `relative` (no padding, no scroll) so the iframe
              stretches edge-to-edge instead of being trapped in a
              `max-h: 80vh` letterbox like the old design.
            • Test / external / empty: padded scrollable box (those pages
              carry their own information density and need normal flow).
            • Fullscreen: <main> ALWAYS uses the full-bleed branch since
              there's no chrome around it. */}
        <main className={isMedia || playerFullscreen ? 'flex-1 relative overflow-hidden' : 'flex-1 overflow-y-auto'}>
          <div className={isMedia || playerFullscreen ? 'absolute inset-0' : 'p-3 sm:p-4'}>
            {/* Resource renderer — switch by type. Test resources reuse the
                existing TestStartPage / TestResultPage in embedded mode so
                their information density (mode picker, stats, leaderboard,
                analytics) is identical to the standalone routes. */}
            {(() => {
              if (!activeResource) {
                return <ResourceEmptyState message="Pick a resource from the sidebar to start." />;
              }
              if (activeResource.type === 'lecture')  return <VideoResourceView    resource={activeResource} />;
              if (activeResource.type === 'notes')    return <NotesResourceView    resource={activeResource} />;
              if (activeResource.type === 'external') return <ExternalResourceView resource={activeResource} />;
              if (activeResource.type !== 'test') return <ResourceEmptyState message="Unsupported resource type." />;

              // Test resource — decide between Review, Result, or Start.
              //   0. ?view=review (+ attempt id resolved) → embedded
              //                                              TestAttemptReviewPage
              //   1. ?attempt=<id>             → result (post-submit deep link)
              //   2. ?attempt=new              → force Start (explicit Retake)
              //   3. latestAttemptByResource[r] → result (previously taken)
              //   4. otherwise                  → Start
              const testIdStr = String(activeResource.testId?._id || activeResource.testId || '');
              const latest    = progress?.latestAttemptByResource?.[String(activeResource._id)];
              const showResultId =
                (showAttemptIdRaw && !showStartInsteadOfResult) ? showAttemptIdRaw
                : (showStartInsteadOfResult ? null
                : (latest?.status === 'completed' ? latest.attemptId : null));

              // Embedded review — stays inside the course player. Falls
              // back to result view if there's nothing to review (no
              // showResultId), since review without an attempt is moot.
              if (inReviewView && showResultId) {
                return (
                  <TestAttemptReviewPage
                    key={`review-${showResultId}`}
                    testId={testIdStr}
                    attemptId={showResultId}
                    embedded
                    // Clearing `view=review` returns the user to the
                    // embedded TestResultPage on the next render — no
                    // navigation away from the course player.
                    onBack={() => {
                      setSearchParams((prev) => {
                        const next = new URLSearchParams(prev);
                        next.delete('view');
                        return next;
                      });
                    }}
                  />
                );
              }

              if (showResultId) {
                return (
                  <TestResultPage
                    key={`result-${showResultId}`}
                    testId={testIdStr}
                    attemptId={showResultId}
                    embedded
                    // Retake stays inside the course player — toggling
                    // ?attempt=new makes the renderer above fall through
                    // to TestStartPage on the next render.
                    onRetake={() => {
                      setSearchParams((prev) => {
                        const next = new URLSearchParams(prev);
                        next.set('attempt', 'new');
                        return next;
                      });
                    }}
                  />
                );
              }
              return (
                <TestStartPage
                  key={`start-${activeResource._id}`}
                  testId={testIdStr}
                  returnTo={`/student/courses/${courseId}/learn?r=${activeResource._id}`}
                  embedded
                />
              );
            })()}
            {/* No duplicate title block here — the top bar already shows the
                resource title + breadcrumb. Test pages carry their own
                content; video/notes/external are content-only. */}
          </div>
        </main>
      </div>

      {/* Floating "Exit fullscreen" pill — only visible in fullscreen, sits
          top-right over the player. We render at this level (sibling of the
          body container) so it's above the iframe and not clipped by any
          ancestor overflow. */}
      {playerFullscreen && (
        <button
          type="button"
          onClick={exitFullscreen}
          className="fixed top-3 right-3 z-50 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 text-white text-xs font-semibold backdrop-blur-sm hover:bg-black/85 shadow-lg"
          title="Exit fullscreen (Esc)"
          aria-label="Exit fullscreen"
        >
          <FiMinimize2 className="w-3.5 h-3.5" />
          Exit fullscreen
        </button>
      )}

      {/* ── Footer: Previous · {center} · Next ──────────────────────────── */}
      {!playerFullscreen && (
      <footer className="flex-shrink-0 h-11 sm:h-12 border-t border-[var(--border)] bg-[var(--bg-surface)] flex items-center px-2 sm:px-3 gap-2 sm:gap-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={activeIndex <= 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-xs sm:text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-muted)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-w-0"
        >
          <FiChevronLeft className="w-4 h-4 flex-shrink-0" />
          <span className="truncate hidden sm:inline">
            {activeIndex > 0 ? playlist[activeIndex - 1].resource.title : 'Previous'}
          </span>
          <span className="sm:hidden">Prev</span>
        </button>

        <div className="flex-1 flex justify-center min-w-0">
          {isTest ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs text-[var(--text-faint)] bg-[var(--bg-muted)] px-2.5 py-1.5 rounded-full">
              <FiCheckCircle className="w-3.5 h-3.5" />
              Auto-marked when you complete the test
            </span>
          ) : activeResource ? (
            <button
              type="button"
              onClick={() => onToggleComplete(!isCompleted)}
              disabled={marking}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 ${
                isCompleted
                  ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-950/60'
                  : 'border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-muted)]'
              }`}
            >
              {isCompleted ? <FiCheck className="w-4 h-4" /> : <FiCheckCircle className="w-4 h-4" />}
              {isCompleted ? 'Completed' : 'Mark complete'}
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={activeIndex < 0 || activeIndex >= playlist.length - 1}
          className="btn-brand text-xs sm:text-sm disabled:opacity-40 disabled:cursor-not-allowed min-w-0"
        >
          <span className="truncate hidden sm:inline">
            Next{activeIndex < playlist.length - 1 ? ` · ${playlist[activeIndex + 1].resource.title}` : ''}
          </span>
          <span className="sm:hidden">Next</span>
          <FiChevronRight className="w-4 h-4 flex-shrink-0" />
        </button>
      </footer>
      )}
    </div>
  );
};

export default CourseLearnPage;
