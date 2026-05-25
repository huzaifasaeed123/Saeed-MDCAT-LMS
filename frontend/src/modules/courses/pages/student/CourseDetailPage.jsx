// modules/courses/pages/student/CourseDetailPage.jsx
//
// Student-facing course overview (Udemy-style).
//
// Layout:
//   • Compact hero    — year tag, title + short description, stat tiles.
//                       Right half holds the cover image (or a soft fallback).
//                       NO inline progress bar, NO author line, NO "structure"
//                       badge — those are admin-side concerns.
//   • Tabs            — Course Content (curriculum tree) · About.
//   • Right rail      — Course Progress card with the donut, progress bar +
//                       Continue button on the same row, and per-type counts
//                       (Tests / Videos / Notes / External) so the user sees
//                       the full picture of what's in the course.
//
// Data flow:
//   GET /courses/:id           → cached on the server (admin write invalidates).
//                                Returns the full curriculum tree + counts.
//   GET /courses/:id/progress  → per-user, hot. Fetched in parallel so the
//                                cached static doc isn't held up by the live
//                                attempt aggregation.
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiArrowLeft, FiArrowRight, FiPlay,
  FiChevronDown, FiChevronUp, FiChevronLeft, FiChevronRight,
  FiBookOpen, FiVideo, FiFileText, FiCheckSquare, FiLink,
  FiLayers, FiTag, FiCalendar, FiClock, FiLock,
} from 'react-icons/fi';
import apiClient from '../../../../core/api/axiosConfig';
import useAuth from '../../../../core/auth/useAuth';
import LockedFeaturePage from '../../../access/pages/LockedFeaturePage';
import { getBackendUrl } from '../../../../shared/utils/fixImageUrls';
import { resolveScheduleStatus, fmtPktDateTime, fmtCountdown } from '../../../../shared/utils/pktDate';
import { usePageHeader } from '../../../../core/layouts/PageHeaderContext';

const STATIC_BASE = getBackendUrl();

// ── Helpers ─────────────────────────────────────────────────────────────────
const sortByOrder = (arr = []) => [...arr].sort((a, b) => (a.order || 0) - (b.order || 0));

// ─── Lock helpers (Layers 2 + 3) ─────────────────────────────────────────
// Layer 2: per-date-entry schedule (date-mode subject's unlockAt / lockAt).
// Layer 3: per-resource schedule (resource.availability + unlockAt / lockAt).
// A resource is "effectively locked" if EITHER its parent date entry is
// locked/closed OR its own schedule says so. Layer 4 (test-level
// availability) is a separate gate handled by TestStartPage itself.
//
// Date entries don't carry their own `availability` enum; they're modeled
// as just `unlockAt` (optionally `lockAt`). We feed that through the
// resolver as if it were `availability: 'window' | 'unlock_date'`.
const getEntryStatus = (entry) => {
  if (!entry?.unlockAt) return 'available';
  return resolveScheduleStatus({
    availability: entry.lockAt ? 'window' : 'unlock_date',
    unlockAt:     entry.unlockAt,
    lockAt:       entry.lockAt,
  });
};

const isEntryLocked = (entry) => {
  const s = getEntryStatus(entry);
  return s === 'locked' || s === 'closed';
};

const getResourceStatus = (r) => resolveScheduleStatus({
  availability: r?.availability,
  unlockAt:     r?.unlockAt,
  lockAt:       r?.lockAt,
});

const isResourceEffectivelyLocked = (resource, parentEntry) => {
  if (parentEntry && isEntryLocked(parentEntry)) return true;
  const s = getResourceStatus(resource);
  return s === 'locked' || s === 'closed';
};

// Small reusable popover that appears on hover (desktop) / click (mobile)
// to explain WHY something is locked and when it'll open. Pure
// presentational — caller passes the unlockAt/lockAt + an entry/resource
// label so the popover wording reflects the right context. Anchored to
// `children` (typically the lock icon) via a relative wrapper.
const LockHoverHint = ({ unlockAt, lockAt, children, label = 'Locked' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Show on desktop hover; on tap (mobile) we toggle. Stays out of the
  // way otherwise (no native browser tooltip — we want our own copy
  // that includes the PKT countdown).
  return (
    <span
      ref={ref}
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
    >
      {children}
      {open && (
        <span
          role="dialog"
          className="absolute z-50 bottom-full mb-2 right-0 w-64 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-xl p-3 text-left"
        >
          <span className="block">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              <FiLock className="w-3 h-3" /> {label}
            </span>
            {unlockAt && (
              <span className="block text-[11px] text-[var(--text-muted)] mt-2 leading-relaxed">
                Opens{' '}
                <span className="font-semibold text-amber-700 dark:text-amber-300">
                  {fmtCountdown(unlockAt) || 'shortly'}
                </span>
                <span className="block text-[var(--text-faint)] mt-0.5">
                  {fmtPktDateTime(unlockAt)}
                </span>
              </span>
            )}
            {lockAt && (
              <span className="block text-[11px] text-[var(--text-muted)] mt-1.5 leading-relaxed">
                Closes{' '}
                <span className="block text-[var(--text-faint)] mt-0.5">
                  {fmtPktDateTime(lockAt)}
                </span>
              </span>
            )}
          </span>
        </span>
      )}
    </span>
  );
};

const fmtRange = (start, end) => {
  if (!start && !end) return null;
  const opts = { month: 'short', year: 'numeric' };
  if (start && end) return `${new Date(start).toLocaleDateString(undefined, opts)} – ${new Date(end).toLocaleDateString(undefined, opts)}`;
  if (start) return `Starts ${new Date(start).toLocaleDateString(undefined, opts)}`;
  return `Ends ${new Date(end).toLocaleDateString(undefined, opts)}`;
};

// ── Stat tile (hero) ────────────────────────────────────────────────────────
// Card-style tile — icon top, number prominent, label underneath. Sized to
// fill the larger hero so the stats actually anchor the layout instead of
// floating as tiny chips. On phones the icon row sits inline (horizontal)
// because vertical stacking would burn too much vertical space.
const StatTile = ({ Icon, value, label, tint }) => (
  <div className="flex sm:flex-col items-center sm:items-start gap-2 sm:gap-2 p-2.5 sm:p-3 rounded-xl bg-[var(--bg-muted)]/40 border border-[var(--border-faint)]">
    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${tint}`}>
      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
    </div>
    <div className="min-w-0">
      <p className="text-lg sm:text-2xl font-black tabular-nums text-[var(--text-strong)] leading-none">{value}</p>
      <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] mt-1 truncate">{label}</p>
    </div>
  </div>
);

// ── Resource type metadata ─────────────────────────────────────────────────
// Used by both the curriculum tree (per-resource rows) and the right-rail
// Course Progress card (per-type completion totals).
const RES_GROUPS = [
  { key: 'lecture',  Icon: FiVideo,       label: 'Video',    plural: 'Videos',   tint: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300' },
  { key: 'test',     Icon: FiCheckSquare, label: 'Test',     plural: 'Tests',    tint: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300' },
  { key: 'notes',    Icon: FiFileText,    label: 'Notes',    plural: 'Notes',    tint: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300' },
  { key: 'external', Icon: FiLink,        label: 'External', plural: 'External', tint: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300' },
];

// ── Resource-item row (one row per actual resource) ────────────────────────
// Renders the resource's REAL title (e.g. "Lecture of The Cell", "Mock Test
// 1", "Topics of Cell PDF") instead of a generic "Videos / Tests / Notes"
// group bucket — students want to see what's actually in the chapter, not
// just type counts. The type icon is kept on the left as a quick visual
// cue, and a small type label sits under the title on desktop (hidden on
// mobile to save horizontal space).
// `parentEntry` is the date-mode subject this resource belongs to (or null
// for structure-mode rows). If the parent entry is locked, that cascades
// down — the resource appears locked even if its own schedule is public.
// Locked rows are still rendered (so the student sees the curriculum)
// and still clickable — clicking takes them to the Course Player which
// shows a "Locked" page explaining when it opens.
const ResourceItemRow = ({ resource, parentEntry = null, onClick }) => {
  const meta = RES_GROUPS.find((g) => g.key === resource.type) || RES_GROUPS[0];
  const Icon = meta.Icon;
  // For test resources the resource.title is often blank (the testId's title
  // is the source of truth). Fall back to populated test.title, then to the
  // type label so the row never renders nameless.
  const title =
    (resource.title && resource.title.trim()) ||
    resource.testId?.title ||
    meta.label;

  // ── Lock derivation (combined Layer 2 + Layer 3) ───────────────────────
  const parentLocked   = parentEntry ? isEntryLocked(parentEntry) : false;
  const resourceStatus = getResourceStatus(resource);
  const selfLocked     = resourceStatus === 'locked' || resourceStatus === 'closed';
  const effectivelyLocked = parentLocked || selfLocked;

  // When the parent date is locked, the parent's schedule is what to
  // explain in the popover (date opens at …). Otherwise the resource's
  // own unlock/lock window is the relevant info.
  const popoverUnlockAt = parentLocked ? parentEntry?.unlockAt : resource.unlockAt;
  const popoverLockAt   = parentLocked ? parentEntry?.lockAt   : resource.lockAt;
  const popoverLabel    = parentLocked
    ? 'Date locked'
    : (resourceStatus === 'closed' ? 'Closed' : 'Locked');

  return (
    <button
      type="button"
      onClick={() => onClick(resource)}
      className={`w-full text-left flex items-center gap-2.5 sm:gap-3 px-2.5 sm:px-3 py-2 rounded-xl hover:bg-[var(--bg-muted)] transition-colors group ${
        effectivelyLocked ? 'opacity-60' : ''
      }`}
      title={effectivelyLocked ? popoverLabel : undefined}
    >
      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.tint} ${effectivelyLocked ? 'grayscale' : ''}`}>
        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs sm:text-sm font-semibold text-[var(--text-strong)] truncate">{title}</p>
        <p className="hidden sm:block text-[10px] uppercase tracking-wider font-bold text-[var(--text-faint)] mt-0.5">{meta.label}</p>
      </div>
      {effectivelyLocked ? (
        // Hover popover on desktop, tap-toggle on mobile. The icon itself
        // is enough on phones; the popover only renders when the user
        // explicitly engages (hover or tap), so mobile rows stay clean.
        <LockHoverHint
          unlockAt={popoverUnlockAt}
          lockAt={popoverLockAt}
          label={popoverLabel}
        >
          <FiLock className="w-4 h-4 text-amber-500 flex-shrink-0" />
        </LockHoverHint>
      ) : (
        <FiArrowRight className="w-4 h-4 text-[var(--text-faint)] group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
      )}
    </button>
  );
};

// ── Topic row ───────────────────────────────────────────────────────────────
// Expands to show every individual resource in the topic with its real title.
const TopicRow = ({ topic, num, onResourceGroupClick }) => {
  const [open, setOpen] = useState(false);
  const resources = sortByOrder(topic.resources);
  const itemCount = resources.length;

  return (
    <div className="ml-3 sm:ml-6 my-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--bg-muted)] transition-colors"
      >
        <span className="text-[10px] font-mono font-bold text-primary-600 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/40 px-1.5 py-0.5 rounded">{num}</span>
        <FiBookOpen className="w-3.5 h-3.5 text-secondary-500 flex-shrink-0" />
        <span className="text-xs sm:text-sm font-semibold text-[var(--text-strong)] truncate flex-1 text-left">{topic.title}</span>
        {/* Item count chip — desktop only. Mobile keeps the row narrow. */}
        <span className="hidden sm:inline-flex text-[10px] font-bold text-[var(--text-faint)] bg-[var(--bg-muted)] rounded-full px-2 py-0.5 whitespace-nowrap">{itemCount} {itemCount === 1 ? 'Item' : 'Items'}</span>
        {open ? <FiChevronUp className="w-4 h-4 text-[var(--text-faint)]" /> : <FiChevronDown className="w-4 h-4 text-[var(--text-faint)]" />}
      </button>

      {open && (
        <div className="mt-1 ml-3 sm:ml-6 space-y-1 border-l-2 border-[var(--border-faint)] pl-2">
          {resources.map((r) => (
            <ResourceItemRow
              key={r._id}
              resource={r}
              onClick={onResourceGroupClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Chapter row ─────────────────────────────────────────────────────────────
// Two render modes:
//   • useTopics = true  → expand to a list of TopicRows (each a dropdown).
//   • useTopics = false → expand DIRECTLY to resource-group rows (no inner
//     dropdown, no chapter-title repeated as a fake topic). The user
//     specifically asked for the chapter to behave as the leaf-level
//     container when topics aren't configured.
const ChapterRow = ({ chapter, num, onResourceGroupClick }) => {
  const [open, setOpen] = useState(false);
  const topics = sortByOrder(chapter.topics);
  // Flat-mode chapters expand directly to the chapter's own resources (each
  // shown with its real title) — no fake topic wrapper.
  const flatResources = chapter.useTopics ? null : sortByOrder(chapter.resources);

  // Header chip count + label adapt to the mode.
  const headerCount = chapter.useTopics ? topics.length : (flatResources?.length || 0);
  const headerLabel = chapter.useTopics
    ? (headerCount === 1 ? 'Topic' : 'Topics')
    : (headerCount === 1 ? 'Item' : 'Items');

  return (
    <div className="ml-2 sm:ml-4 my-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--bg-muted)] transition-colors"
      >
        <span className="text-[10px] sm:text-[11px] font-mono font-bold text-secondary-700 dark:text-secondary-300 bg-secondary-50 dark:bg-secondary-950/40 px-1.5 sm:px-2 py-0.5 rounded">{num}</span>
        <FiLayers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-secondary-500 flex-shrink-0" />
        <span className="text-xs sm:text-sm font-semibold sm:font-bold text-[var(--text-strong)] truncate flex-1 text-left">{chapter.title}</span>
        {/* Item / Topic count chip — hidden on mobile to keep titles roomy. */}
        <span className="hidden sm:inline-flex text-[10px] font-bold text-[var(--text-faint)] bg-[var(--bg-muted)] rounded-full px-2 py-0.5 whitespace-nowrap">{headerCount} {headerLabel}</span>
        {open ? <FiChevronUp className="w-4 h-4 text-[var(--text-faint)]" /> : <FiChevronDown className="w-4 h-4 text-[var(--text-faint)]" />}
      </button>

      {open && (
        chapter.useTopics ? (
          <div className="mt-1 space-y-1">
            {topics.map((t, i) => (
              <TopicRow
                key={t._id || `t-${i}`}
                topic={t}
                num={`${num}.${i + 1}`}
                onResourceGroupClick={onResourceGroupClick}
              />
            ))}
          </div>
        ) : (
          <div className="mt-1 ml-3 sm:ml-6 space-y-1 border-l-2 border-[var(--border-faint)] pl-2">
            {(flatResources || []).map((r) => (
              <ResourceItemRow
                key={r._id}
                resource={r}
                onClick={onResourceGroupClick}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
};

// ── Date-mode helpers ──────────────────────────────────────────────────────
// Date-based courses don't have a subject→chapter→topic hierarchy — each
// "subject" is really a calendar entry (e.g. "Day 12 · Periodic Trends Deep
// Dive") with its own unlockAt and a flat list of resources. The page asks
// for NO nested dropdowns inside an entry: just the entry heading and its
// resources. To stay tolerant of admins who used `useSubGroups=true` (date
// entries with chapters), we flatten everything reachable under the entry
// into one resource list.
const collectDateEntryResources = (entry) => {
  const out = [...(entry?.resources || [])];
  for (const c of (entry?.chapters || [])) {
    out.push(...(c.resources || []));
    for (const t of (c.topics || [])) {
      out.push(...(t.resources || []));
    }
  }
  return sortByOrder(out);
};

const fmtEntryDateChip = (v) => {
  if (!v) return null;
  try {
    return new Date(v).toLocaleDateString('en-PK', {
      timeZone: 'Asia/Karachi',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch { return null; }
};

// Date sub-formatters used by the timeline pills.
const fmtPktPart = (v, opts) => {
  if (!v) return '';
  try {
    return new Date(v).toLocaleString('en-PK', { timeZone: 'Asia/Karachi', ...opts });
  } catch { return ''; }
};
const fmtPillWeekday = (v) => fmtPktPart(v, { weekday: 'short' }).toUpperCase();
const fmtPillDay     = (v) => fmtPktPart(v, { day: 'numeric' });
const fmtPillMonth   = (v) => fmtPktPart(v, { month: 'short' }).toUpperCase();
const isSameDayPKT = (a, b) => {
  if (!a || !b) return false;
  const f = (d) => fmtPktPart(d, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return f(a) === f(b);
};

// ── Date timeline ──────────────────────────────────────────────────────────
// Horizontal scrollable row of date pills. Clicking a pill selects that
// entry; the content panel below renders the entry's heading + resources
// (no inner dropdowns, per the design ask). The active pill is scrolled
// into view automatically when the selection changes.
// Pads a 1-based day index to two digits (1 → "01", 12 → "12").
const fmtDayIdx = (n) => String(n).padStart(2, '0');

const DateTimelinePill = ({ entry, active, dayIdx, onClick }) => {
  const today = new Date();
  const isToday = entry.unlockAt && isSameDayPKT(entry.unlockAt, today);
  // Layer 2: when the date hasn't unlocked yet OR has closed, the pill
  // renders dimmed with a lock badge. It STAYS clickable (the student can
  // still preview the title + see what's coming) — the course player
  // shows the locked screen if they actually try to open content.
  const status = getEntryStatus(entry);
  const locked = status === 'locked' || status === 'closed';

  // Color treatment per state — kept readable in dark mode too.
  let pillCls;
  if (active) {
    pillCls = 'bg-primary-500 text-white border-primary-500 shadow-md';
  } else if (locked) {
    pillCls = 'bg-[var(--bg-muted)]/40 text-[var(--text-faint)] border-[var(--border)] hover:border-amber-300 opacity-70';
  } else if (isToday) {
    pillCls = 'bg-[var(--bg-surface)] text-[var(--text)] border-emerald-300 dark:border-emerald-700 hover:border-primary-300';
  } else {
    pillCls = 'bg-[var(--bg-surface)] text-[var(--text)] border-emerald-200/70 dark:border-emerald-900/40 hover:border-primary-300';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={locked
        ? `${entry.title} · locked${entry.unlockAt ? ' until ' + fmtPktDateTime(entry.unlockAt) : ''}`
        : entry.title}
      className={`relative flex-shrink-0 flex flex-col items-center justify-center rounded-xl px-2.5 py-2 min-w-[58px] sm:min-w-[64px] border-2 transition-all ${pillCls}`}
    >
      {entry.unlockAt ? (
        <>
          <span className={`text-[10px] uppercase tracking-wider font-bold ${
            active ? 'text-primary-100' : locked ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
          }`}>
            {fmtPillWeekday(entry.unlockAt)}
          </span>
          <span className={`text-lg sm:text-xl font-black leading-tight mt-0.5 ${
            active ? 'text-white' : locked ? 'text-[var(--text-muted)]' : 'text-[var(--text-strong)]'
          }`}>
            {fmtPillDay(entry.unlockAt)}
          </span>
          {/* Sequential day index ("01" / "02" / …) OR a lock icon when
              the entry is locked — same screen real estate, swapped
              meaning. Matches the reference design. */}
          {locked ? (
            <FiLock className={`w-3 h-3 mt-0.5 ${active ? 'text-white' : 'text-amber-500'}`} />
          ) : (
            <span className={`text-[9px] font-mono font-bold mt-0.5 ${active ? 'text-primary-100' : 'text-[var(--text-faint)]'}`}>
              {fmtDayIdx(dayIdx)}
            </span>
          )}
        </>
      ) : (
        <>
          <FiCalendar className={`w-4 h-4 ${active ? 'text-white' : 'text-[var(--text-faint)]'}`} />
          <span className={`text-[10px] font-semibold ${active ? 'text-primary-100' : 'text-[var(--text-faint)]'}`}>ANY</span>
        </>
      )}
    </button>
  );
};

// Full-width date timeline section. Sits between the hero and the body
// grid. Chevron buttons on the ends scroll the pill list left/right; a
// "Jump to today" button on the far right selects today's entry.
const DateTimelineSection = ({ entries, selectedIdx, onSelect }) => {
  const containerRef = useRef(null);

  // Scroll the active pill into view whenever selection changes.
  useEffect(() => {
    const el = containerRef.current?.querySelector(`[data-idx="${selectedIdx}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedIdx]);

  // Find today's index (if any entry is today) — drives the "Jump to today"
  // button enabled state.
  const todayIdx = useMemo(() => {
    const today = new Date();
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].unlockAt && isSameDayPKT(entries[i].unlockAt, today)) return i;
    }
    return -1;
  }, [entries]);

  const scrollBy = (dir) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(200, el.clientWidth * 0.7), behavior: 'smooth' });
  };

  if (!entries || entries.length === 0) return null;

  return (
    <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] px-2 sm:px-3 py-2.5 flex items-center gap-2">
      {/* Prev chevron */}
      <button
        type="button"
        onClick={() => scrollBy(-1)}
        className="flex-shrink-0 w-8 h-8 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)] transition-colors"
        title="Scroll left"
        aria-label="Scroll dates left"
      >
        <FiChevronLeft className="w-4 h-4" />
      </button>

      {/* Pill scroller */}
      <div ref={containerRef} className="flex-1 flex gap-2 overflow-x-auto no-scrollbar">
        {entries.map((e, i) => (
          <div key={e._id || `pill-${i}`} data-idx={i}>
            <DateTimelinePill
              entry={e}
              active={i === selectedIdx}
              dayIdx={i + 1}
              onClick={() => onSelect(i)}
            />
          </div>
        ))}
      </div>

      {/* Next chevron */}
      <button
        type="button"
        onClick={() => scrollBy(1)}
        className="flex-shrink-0 w-8 h-8 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)] transition-colors"
        title="Scroll right"
        aria-label="Scroll dates right"
      >
        <FiChevronRight className="w-4 h-4" />
      </button>

      {/* Jump to today */}
      <button
        type="button"
        onClick={() => { if (todayIdx >= 0) onSelect(todayIdx); }}
        disabled={todayIdx < 0}
        className="flex-shrink-0 hidden sm:inline-flex items-center gap-1.5 ml-1 px-3 py-1.5 rounded-full border border-[var(--border)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title={todayIdx < 0 ? "Today isn't in this course's schedule" : 'Jump to today'}
      >
        <FiClock className="w-3.5 h-3.5" /> Jump to today
      </button>
    </section>
  );
};

// ── Date content panel ─────────────────────────────────────────────────────
// Renders the currently-selected entry: heading + (optional) date row +
// flat resource list. No inner dropdowns — picking a date IS the only
// interaction; resources sit directly under the heading.
const DateContentPanel = ({ entry, onResourceGroupClick }) => {
  const resources = useMemo(() => collectDateEntryResources(entry), [entry]);
  const dateChip  = fmtEntryDateChip(entry?.unlockAt);
  if (!entry) {
    return (
      <div className="text-center py-12">
        <FiCalendar className="w-12 h-12 text-[var(--text-faint)] mx-auto mb-3 opacity-40" />
        <p className="text-sm font-semibold text-[var(--text-muted)]">Pick a date above to see its content</p>
      </div>
    );
  }

  // Layer 2: surface the date's lock state at the top of the panel so the
  // student understands why the resources below look locked.
  const status      = getEntryStatus(entry);
  const entryLocked = status === 'locked' || status === 'closed';

  return (
    <div className="p-4 sm:p-5 space-y-3">
      {/* Entry heading + date chip — date icon swapped for a lock when
          the entry is locked, matching the reference screenshot. */}
      <div>
        {dateChip && (
          <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)] mb-1 inline-flex items-center gap-1.5">
            {entryLocked && <FiLock className="w-3 h-3 text-amber-500" />}
            {dateChip}
          </p>
        )}
        <h3 className="font-display text-lg sm:text-xl font-extrabold text-[var(--text-strong)] leading-tight">
          {entry.title || 'Untitled entry'}
        </h3>
      </div>

      {/* Locked banner — explains when the date opens; only the desktop
          gets the rich copy (mobile keeps it terse to save space). */}
      {entryLocked && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2.5 flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300 flex items-center justify-center flex-shrink-0">
            <FiLock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {status === 'closed' ? 'This date is closed' : "This date isn't open yet"}
            </p>
            {status === 'locked' && entry.unlockAt && (
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                Opens {fmtCountdown(entry.unlockAt) || 'shortly'} ·{' '}
                <span className="hidden sm:inline">{fmtPktDateTime(entry.unlockAt)}</span>
                <span className="sm:hidden">{fmtPktDateTime(entry.unlockAt)?.split(' · ')[0]}</span>
              </p>
            )}
            {status === 'closed' && entry.lockAt && (
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                Closed on {fmtPktDateTime(entry.lockAt)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Flat resource list — each row knows its parent entry so the
          combined Layer-2 + Layer-3 lock rule applies automatically. */}
      <div className="space-y-1 pt-1">
        {resources.length === 0 ? (
          <p className="text-sm text-[var(--text-faint)] italic">No content added to this entry yet.</p>
        ) : resources.map((r) => (
          <ResourceItemRow
            key={r._id}
            resource={r}
            parentEntry={entry}
            onClick={onResourceGroupClick}
          />
        ))}
      </div>
    </div>
  );
};

// ── Subject row ─────────────────────────────────────────────────────────────
const SubjectRow = ({ subject, num, defaultOpen, onResourceGroupClick }) => {
  const [open, setOpen] = useState(defaultOpen);
  const chapters = sortByOrder(subject.chapters);
  return (
    <div className="my-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-2.5 sm:py-3 rounded-xl border-2 transition-all ${
          open
            ? 'border-primary-300 dark:border-primary-800 bg-primary-50/60 dark:bg-primary-950/30'
            : 'border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-muted)]'
        }`}
      >
        <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-primary-500 text-white text-[11px] sm:text-xs font-extrabold flex items-center justify-center flex-shrink-0">{num}</span>
        <FiBookOpen className="w-4 h-4 text-primary-500 flex-shrink-0" />
        <span className="text-sm sm:text-base font-bold sm:font-extrabold text-[var(--text-strong)] truncate flex-1 text-left">{subject.title}</span>
        {/* Chapter count chip — desktop only. Mobile lets the title breathe. */}
        <span className="hidden sm:inline-flex text-xs font-bold text-[var(--text-muted)] bg-[var(--bg-muted)] rounded-full px-2.5 py-1 whitespace-nowrap">
          {chapters.length} {chapters.length === 1 ? 'Chapter' : 'Chapters'}
        </span>
        {open ? <FiChevronUp className="w-4 h-4 text-[var(--text-faint)]" /> : <FiChevronDown className="w-4 h-4 text-[var(--text-faint)]" />}
      </button>

      {open && (
        <div className="mt-1 space-y-1">
          {chapters.map((c, i) => (
            <ChapterRow
              key={c._id || `c-${i}`}
              chapter={c}
              num={`${num}.${i + 1}`}
              onResourceGroupClick={onResourceGroupClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Donut ───────────────────────────────────────────────────────────────────
const ProgressDonut = ({ value }) => {
  const v = Math.max(0, Math.min(100, value || 0));
  // Inner radius slightly smaller relative to the viewBox so "100%" has more
  // breathing room when the donut fills with the full circle. Stroke width
  // also trimmed (10 → 9) so the centred number doesn't visually clip the
  // inner edge of the ring at 3-digit values.
  const r = 38;
  const c = 2 * Math.PI * r;
  const offset = c - (v / 100) * c;
  return (
    // w-32 (128px) — slightly larger again so the progress donut reads as a
    // real visual anchor in the right-rail card, while 100% still breathes.
    <div className="relative w-32 h-32 mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} stroke="currentColor" strokeWidth="9" fill="none" className="text-[var(--bg-muted)]" />
        <circle
          cx="50" cy="50" r={r}
          stroke="currentColor" strokeWidth="9" fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-primary-500 transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold tabular-nums text-[var(--text-strong)] leading-none">{v}%</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] mt-1">Done</span>
      </div>
    </div>
  );
};

// ── Progress card (right rail) ──────────────────────────────────────────────
// Lays out the donut + a single row containing the progress bar AND the
// Continue / Start button (per the design ask: same row, no separate CTA
// section). Below that, a per-type breakdown so the student sees what's
// actually inside the course: Tests / Videos / Notes / External.
const PROGRESS_TYPES = [
  { key: 'tests',    label: 'Tests',    Icon: FiCheckSquare, tint: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300' },
  { key: 'videos',   label: 'Videos',   Icon: FiVideo,       tint: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300' },
  { key: 'notes',    label: 'Notes',    Icon: FiFileText,    tint: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300' },
  { key: 'external', label: 'External', Icon: FiLink,        tint: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300' },
];

const CourseProgressCard = ({ progress, counts, perType, onContinue, hasStarted }) => {
  const pct = progress?.progressPct ?? 0;

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-[var(--text-strong)]">Course Progress</h3>
        {progress == null && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">loading…</span>
        )}
      </div>

      {/* Donut */}
      <ProgressDonut value={pct} />

      {/* Progress bar — own row, full width, with an inline % label above
          it so the bar and number read as one unit. Putting the bar and
          the CTA on the same row earlier made the bar a thin sliver next
          to a chunky button — visually unbalanced. Now the bar is its own
          block, the CTA below is full-width, and the two share equal
          horizontal weight. */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Progress</span>
          <span className="text-xs font-extrabold tabular-nums text-primary-600 dark:text-primary-300">{pct}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-[var(--bg-muted)] overflow-hidden" title={`${pct}% complete`}>
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500"
            style={{ width: `${Math.max(pct ? 4 : 0, pct)}%` }}
          />
        </div>
      </div>

      {/* Continue / Start CTA — full width below the bar. */}
      <button
        type="button"
        onClick={onContinue}
        className="btn-brand w-full justify-center text-sm"
      >
        <FiPlay className="w-4 h-4" />
        {hasStarted ? 'Continue Learning' : 'Start Learning'}
      </button>

      {/* Per-type completion — shows X / Y for every type present in this
          course (Tests · Videos · Notes · External). All numbers are derived
          on the client by intersecting the course's tree of resource ids
          (already in the static course payload) with the user's
          completedResourceIds set (already returned by /progress) — so no
          extra DB query is needed beyond what the page already fetches. */}
      <div className="space-y-2 pt-1 border-t border-[var(--border-faint)]">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Course contents</p>
        <ul className="space-y-1.5">
          {PROGRESS_TYPES.map((t) => {
            const total = counts?.[t.key] || 0;
            if (total === 0) return null;
            const done = perType?.[t.key] || 0;
            const Icon = t.Icon;
            return (
              <li key={t.key} className="flex items-center gap-2.5 text-sm">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${t.tint}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="flex-1 text-[var(--text)]">{t.label}</span>
                <strong className="tabular-nums text-[var(--text-strong)]">{done} / {total}</strong>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

// ── Main page ───────────────────────────────────────────────────────────────
const CourseDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasCourseAccess, loading: authLoading } = useAuth();

  if (!authLoading && !hasCourseAccess(id)) {
    return <LockedFeaturePage feature="courses" courseId={id} />;
  }

  const [course,    setCourse]    = useState(null);
  const [progress,  setProgress]  = useState(null);  // null = still loading
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('content');

  // Parallel fetch — the cached course doc + the per-user progress.
  // Splitting them means a freshly cached course doesn't get re-queried just
  // because the user's attempt count changed.
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [cRes, pRes] = await Promise.all([
          apiClient.get(`/courses/${id}`),
          apiClient.get(`/courses/${id}/progress`).catch(() => null),
        ]);
        if (!alive) return;
        if (cRes.data.success) setCourse(cRes.data.data);
        if (pRes?.data?.success) setProgress(pRes.data.data);
      } catch {
        if (alive) {
          toast.error('Failed to load course');
          navigate('/student/courses');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id, navigate]);

  const onContinue = useCallback(() => {
    navigate(`/student/courses/${id}/learn`);
  }, [id, navigate]);

  const onResourceGroupClick = useCallback((resource) => {
    if (!resource) return;
    navigate(`/student/courses/${id}/learn${resource._id ? `?r=${resource._id}` : ''}`);
  }, [id, navigate]);

  const hasStarted = (progress?.progressPct ?? 0) > 0;

  // Per-type completion — derived on the client from data we already have.
  // We walk the course tree once to bucket every resource id by type, then
  // intersect each bucket with the user's completedResourceIds set. The
  // page already fetches both pieces, so this adds NO new HTTP/DB calls.
  // PROGRESS_TYPES uses keys 'tests' / 'videos' / etc., which we map back
  // to the resource-tree types 'test' / 'lecture' / etc.
  //
  // MUST live above the loading / !course early returns — otherwise React
  // sees a different hook count between the "still loading" and "course
  // loaded" renders and throws "Rendered more hooks than during the
  // previous render." We guard via the `?.` chain and `|| []` fallbacks
  // so it's safe to run before `course` arrives.
  const perType = useMemo(() => {
    const buckets = { lecture: new Set(), notes: new Set(), test: new Set(), external: new Set() };
    const visit = (r) => {
      if (r && buckets[r.type] && r._id) buckets[r.type].add(String(r._id));
    };
    for (const s of (course?.subjects || [])) {
      for (const r of (s.resources || [])) visit(r);
      for (const c of (s.chapters || [])) {
        for (const r of (c.resources || [])) visit(r);
        for (const t of (c.topics || [])) {
          for (const r of (t.resources || [])) visit(r);
        }
      }
    }
    const done = new Set((progress?.completedResourceIds || []).map(String));
    const intersect = (set) => {
      let n = 0;
      for (const id of set) if (done.has(id)) n += 1;
      return n;
    };
    return {
      tests:    intersect(buckets.test),
      videos:   intersect(buckets.lecture),
      notes:    intersect(buckets.notes),
      external: intersect(buckets.external),
    };
  }, [course, progress]);

  // ── Date-mode state ──────────────────────────────────────────────────────
  // For date-mode courses we hoist the sorted entries + selection state up
  // to the page level so the full-width date timeline (between hero and
  // body grid) and the in-card content panel both share the same active
  // index. Always declared (regardless of mode) to keep hook order stable.
  const dateEntries = useMemo(
    () => (course?.displayMode === 'date'
      ? sortDateEntries(course.subjects, course.contentSortOrder)
      : []),
    [course?.displayMode, course?.subjects, course?.contentSortOrder],
  );
  const dateDefaultIdx = useMemo(() => findTodayIdx(dateEntries), [dateEntries]);
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  useEffect(() => { setSelectedDateIdx(dateDefaultIdx); }, [dateDefaultIdx]);

  // Memoised so usePageHeader's effect doesn't refire on every render — that
  // was the cause of the "Maximum update depth exceeded" loop.
  const headerAction = useMemo(() => (
    <button
      onClick={onContinue}
      disabled={!course}
      className="btn-brand text-sm disabled:opacity-50"
    >
      <FiPlay className="w-4 h-4" /> {hasStarted ? 'Continue Learning' : 'Start Learning'}
    </button>
  ), [onContinue, course, hasStarted]);

  usePageHeader({
    title:    course?.title || 'Course',
    subtitle: course?.shortDescription || '',
    action:   headerAction,
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
        <span className="ml-3 text-[var(--text-muted)]">Loading course…</span>
      </div>
    );
  }

  if (!course) return null;

  const counts      = course.resourceCounts || {};
  const totalTopics = counts.topics || 0;
  const rangeStr    = fmtRange(course.startDate, course.endDate);

  return (
    // flex+gap (not space-y) so the md:hidden mobile-action row doesn't leave
    // a phantom top-gap on desktop — `display:none` children don't contribute
    // to flex `gap`, but space-y still applies its margin to the next sibling.
    // This is what was creating the big empty band between the dashboard
    // navbar and the hero on desktop.
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* Mobile-only inline actions (header action is hidden on mobile). */}
      <div className="md:hidden flex items-center gap-2">
        <button
          onClick={() => navigate('/student/courses')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-muted)] transition-colors"
        >
          <FiArrowLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={onContinue} className="btn-brand text-sm flex-1 justify-center">
          <FiPlay className="w-4 h-4" /> {hasStarted ? 'Continue' : 'Start Learning'}
        </button>
      </div>

      {/* ── Hero — banner-style. Three clearly defined stacks on the content
          side: (1) eyebrow chips, (2) title + description, (3) stat-tile
          row. `justify-between` distributes whitespace evenly so nothing
          floats or pins, and the bigger stat tiles act as a visual base
          that balances the banner art on the right. */}
      {/* ─── Hero height — adjust here ────────────────────────────────────
          • Structure-mode courses get a roomier hero (~260–290px) because
            it has to hold title + description + 5 stat tiles + the
            progress row.
          • Date-mode courses get a smaller hero (~200–220px) so the date
            timeline + content panel below have more breathing room on
            the same viewport. Change the `md:min-h-[…]` / `lg:min-h-[…]`
            numbers below to tune either branch. */}
      <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
        <div className={`grid grid-cols-1 md:grid-cols-12 ${
          course.displayMode === 'date'
            ? 'md:min-h-[200px] lg:min-h-[220px]'
            : 'md:min-h-[260px] lg:min-h-[290px]'
        }`}>
          {/* Left — info side */}
          <div className="md:col-span-7 p-5 sm:p-6 md:p-7 flex flex-col justify-between gap-5">
            {/* TOP — eyebrow chips + title + description. Stacked tight so
                they read as one block. */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {course.mdcatYear && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                    <FiTag className="w-3 h-3" /> {course.mdcatYear}
                  </span>
                )}
                {rangeStr && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--bg-muted)] text-[var(--text-muted)]">
                    <FiClock className="w-3 h-3" /> {rangeStr}
                  </span>
                )}
              </div>

              <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-black text-[var(--text-strong)] tracking-tight leading-[1.15]">
                {course.title}
              </h1>
              {course.shortDescription && (
                <p className="text-sm sm:text-base text-[var(--text-muted)] mt-2.5 leading-relaxed">
                  {course.shortDescription}
                </p>
              )}
            </div>

            {/* BOTTOM — stat tiles + progress row stacked together.
                Stat tiles are HIDDEN in date mode so the hero stays
                compact and the date timeline + content panel below get
                the vertical space. */}
            <div className="space-y-4">
              {course.displayMode !== 'date' && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5">
                  <StatTile Icon={FiBookOpen}    value={counts.subjects || 0} label="Subjects" tint="bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-300" />
                  <StatTile Icon={FiLayers}      value={counts.chapters || 0} label="Chapters" tint="bg-secondary-50 text-secondary-600 dark:bg-secondary-950/40 dark:text-secondary-300" />
                  <StatTile Icon={FiVideo}       value={counts.videos   || 0} label="Videos"   tint="bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300" />
                  <StatTile Icon={FiCheckSquare} value={counts.tests    || 0} label="Tests"    tint="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300" />
                  <StatTile Icon={FiFileText}    value={counts.notes    || 0} label="Notes"    tint="bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300" />
                </div>
              )}

              {/* Progress + Continue Learning row.
                  Layout: "YOUR PROGRESS" eyebrow + bar + % chip on the left
                  (flex-1), Continue Learning button on the right. When the
                  hero is narrow (`sm:` breakpoint), the button wraps onto
                  the next line via `flex-wrap`. */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-3 border-t border-[var(--border-faint)]">
                <div className="flex-1 min-w-[180px]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Your progress</span>
                    <span className="text-xs font-extrabold tabular-nums text-primary-600 dark:text-primary-300">{progress?.progressPct ?? 0}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--bg-muted)] overflow-hidden" title={`${progress?.progressPct ?? 0}% complete`}>
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500"
                      style={{ width: `${Math.max((progress?.progressPct ?? 0) ? 4 : 0, progress?.progressPct ?? 0)}%` }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onContinue}
                  className="btn-brand text-sm flex-shrink-0 ml-auto"
                >
                  <FiPlay className="w-4 h-4" />
                  {hasStarted ? 'Continue Learning' : 'Start Learning'}
                </button>
              </div>
            </div>
          </div>

          {/* Right — cover image. Narrower side (5/12) than the content (7/12)
              so the banner reads as accent rather than dominating; the
              content side now has room for the bigger title + tiles. */}
          <div className="md:col-span-5 relative bg-gradient-to-br from-primary-50 via-primary-50 to-secondary-50 dark:from-primary-950/30 dark:via-primary-950/20 dark:to-secondary-950/20 min-h-[200px] md:min-h-0">
            {course.featureImage ? (
              <img
                src={`${STATIC_BASE}${course.featureImage}`}
                alt={course.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <FiBookOpen className="w-24 h-24 text-primary-300 dark:text-primary-800/40" strokeWidth={1.25} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Date timeline (full-width, between hero and body grid) ────────
          Only renders for date-mode courses. Lives at page level — NOT
          inside the Course Content card — so the pill scroller, chevrons
          and "Jump to today" span the full width like in the reference. */}
      {course.displayMode === 'date' && dateEntries.length > 0 && (
        <DateTimelineSection
          entries={dateEntries}
          selectedIdx={selectedDateIdx}
          onSelect={setSelectedDateIdx}
        />
      )}

      {/* ── Body grid: curriculum (2 cols) + sidebar (1 col) ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
            <div className="border-b border-[var(--border)] px-1.5 pt-1.5">
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {[
                  {
                    key: 'content',
                    label: 'Course Content',
                    sub: course.displayMode === 'date'
                      ? ((course.subjects || []).length > 0
                          ? `${(course.subjects || []).length} dates`
                          : null)
                      : (totalTopics > 0 ? `${totalTopics} topics` : null),
                  },
                  { key: 'about',   label: 'About',           sub: null },
                ].map((t) => {
                  const active = activeTab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setActiveTab(t.key)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                        active
                          ? 'border-primary-500 text-primary-600 dark:text-primary-300'
                          : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      <span>{t.label}</span>
                      {/* Sub-chip ("1 topic") — desktop only. Mobile drops
                          all the counter chips per the design ask so titles
                          have room to breathe. */}
                      {t.sub && (
                        <span className={`hidden sm:inline-flex text-[10px] font-bold rounded-full px-2 py-0.5 ${
                          active ? 'bg-primary-100 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300' : 'bg-[var(--bg-muted)] text-[var(--text-faint)]'
                        }`}>
                          {t.sub}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-3 sm:p-4">
              {activeTab === 'content' && (
                course.displayMode === 'date' ? (
                  <DateCurriculumBody
                    entries={dateEntries}
                    selectedIdx={selectedDateIdx}
                    onResourceGroupClick={onResourceGroupClick}
                  />
                ) : (
                  <CurriculumBody
                    subjects={sortByOrder(course.subjects)}
                    onResourceGroupClick={onResourceGroupClick}
                  />
                )
              )}
              {activeTab === 'about' && (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {course.longDescription
                    ? <div dangerouslySetInnerHTML={{ __html: course.longDescription }} />
                    : <p className="text-sm text-[var(--text-faint)] italic">No description provided for this course yet.</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        <aside>
          <CourseProgressCard
            progress={progress}
            counts={counts}
            perType={perType}
            onContinue={onContinue}
            hasStarted={hasStarted}
          />
        </aside>
      </div>
    </div>
  );
};

// ── Curriculum body ─────────────────────────────────────────────────────────
const CurriculumBody = ({ subjects, onResourceGroupClick }) => {
  if (!subjects || subjects.length === 0) {
    return (
      <div className="text-center py-12">
        <FiBookOpen className="w-12 h-12 text-[var(--text-faint)] mx-auto mb-3 opacity-40" />
        <p className="text-sm font-semibold text-[var(--text-muted)]">No content added yet</p>
        <p className="text-xs text-[var(--text-faint)] mt-1">The instructor hasn't published any curriculum yet.</p>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {subjects.map((s, i) => (
        <SubjectRow
          key={s._id || `s-${i}`}
          subject={s}
          num={i + 1}
          defaultOpen={i === 0}
          onResourceGroupClick={onResourceGroupClick}
        />
      ))}
    </div>
  );
};

// ── Sort date entries ───────────────────────────────────────────────────────
// Hoisted out of DateCurriculumBody so the page-level timeline (which lives
// between the hero and the body grid) and the in-card content panel both
// see the same ordering.
const sortDateEntries = (subjects, sortOrder) => {
  const list = [...(subjects || [])];
  list.sort((a, b) => {
    const ad = a.unlockAt ? new Date(a.unlockAt).getTime() : null;
    const bd = b.unlockAt ? new Date(b.unlockAt).getTime() : null;
    // Entries without a date sink to the bottom regardless of sort.
    if (ad == null && bd == null) return (a.order || 0) - (b.order || 0);
    if (ad == null) return 1;
    if (bd == null) return -1;
    return sortOrder === 'past_first' ? ad - bd : bd - ad;
  });
  return list;
};

// Index of the most-recently-unlocked entry (largest unlockAt ≤ now), or 0
// if every entry is still locked. Used as the default selection so students
// land on today's content automatically.
const findTodayIdx = (entries) => {
  const now = Date.now();
  let best = 0;
  let bestT = -Infinity;
  for (let i = 0; i < entries.length; i++) {
    const t = entries[i].unlockAt ? new Date(entries[i].unlockAt).getTime() : 0;
    if (t > now) continue;
    if (t > bestT) { bestT = t; best = i; }
  }
  return best;
};

// ── Date curriculum body ────────────────────────────────────────────────────
// Tab-content for date mode. The timeline lives OUTSIDE this card now (at
// page level, full-width); this component only renders the content panel
// for the currently-selected entry, driven by `selectedIdx` from the page.
const DateCurriculumBody = ({ entries, selectedIdx, onResourceGroupClick }) => {
  if (!entries || entries.length === 0) {
    return (
      <div className="text-center py-12">
        <FiCalendar className="w-12 h-12 text-[var(--text-faint)] mx-auto mb-3 opacity-40" />
        <p className="text-sm font-semibold text-[var(--text-muted)]">No content scheduled yet</p>
        <p className="text-xs text-[var(--text-faint)] mt-1">The instructor hasn't added any dates to this course yet.</p>
      </div>
    );
  }
  return (
    // Cancel the card's outer padding so the content panel sits flush.
    <div className="-m-3 sm:-m-4">
      <DateContentPanel
        entry={entries[selectedIdx]}
        onResourceGroupClick={onResourceGroupClick}
      />
    </div>
  );
};

export default CourseDetailPage;
