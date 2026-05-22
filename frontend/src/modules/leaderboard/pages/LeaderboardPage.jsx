// modules/leaderboard/pages/LeaderboardPage.jsx
//
// Rebuilt to match the new design (theme-aligned podium cards + table).
// All data wiring, caching, refresh, subject board logic preserved from the
// previous version. Only the JSX/Tailwind layer changed — backend is
// untouched and we render only the fields the existing snapshot exposes
// (rank, fullName, profilePicture, score, accuracy, totalAttempted,
// correctCount, delta). School / streak / city are not in the API and
// were intentionally omitted to honour the "no extra DB hits" rule.
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  FiAward, FiTrendingUp, FiCalendar, FiBook, FiZap,
  FiRefreshCw, FiLoader, FiArrowUp, FiArrowDown, FiMinus,
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import useAuth from '../../../core/auth/useAuth';
import { getBackendUrl } from '../../../shared/utils/fixImageUrls';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';

// ── Constants ────────────────────────────────────────────────────────────────
// Tabs carry both a desktop `label` and a `short` mobile label so they fit
// comfortably without horizontal scroll on narrow screens.
const TABS = [
  { key: 'alltime',      label: 'All-Time',      short: 'All',      icon: <FiAward       className="w-4 h-4" /> },
  { key: 'weekly',       label: 'This Week',     short: 'Week',     icon: <FiZap         className="w-4 h-4" /> },
  { key: 'monthly',      label: 'This Month',    short: 'Month',    icon: <FiCalendar    className="w-4 h-4" /> },
  { key: 'mostimproved', label: 'Most Improved', short: 'Improved', icon: <FiTrendingUp  className="w-4 h-4" /> },
  { key: 'subject',      label: 'Subject-Wise',  short: 'Subject',  icon: <FiBook        className="w-4 h-4" /> },
];

const VOL_CAPS = { alltime: 1000, weekly: 70, monthly: 300, mostimproved: 70, subject: 1000 };

const TAB_DESCRIPTIONS = {
  alltime:      'All-time rankings based on cumulative MCQ performance.',
  weekly:       'Rankings based on MCQ performance in the last 7 days.',
  monthly:      'Rankings based on MCQ performance in the last 30 days.',
  mostimproved: 'Students who improved the most compared to the previous week.',
  subject:      null, // composed inline since it includes the subject name
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (iso) => {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1)  return 'just now';
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  if (h < 24)   return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const resolveUrl = (url) => {
  if (!url) return null;
  return url.startsWith('http') ? url : `${getBackendUrl()}${url}`;
};

// Clamps accuracy to [0, 100]. Defence against any stale snapshot data still
// floating around with the pre-fix legacy-import corruption (score >
// answeredCount → accuracy > 100%). Once the next 10-min job run overwrites
// those snapshots this is a no-op.
const safeAcc = (acc) => Math.max(0, Math.min(100, Number(acc) || 0));

const accColorClass = (acc) => {
  const a = safeAcc(acc);
  if (a >= 80) return 'bg-emerald-500';
  if (a >= 60) return 'bg-primary-500';
  return 'bg-rose-500';
};

const accTextClass = (acc) => {
  const a = safeAcc(acc);
  if (a >= 80) return 'text-emerald-600 dark:text-emerald-300';
  if (a >= 60) return 'text-primary-600 dark:text-primary-300';
  return 'text-rose-600 dark:text-rose-300';
};

const ORDINAL = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// ── Avatar ───────────────────────────────────────────────────────────────────
// lg / xl are used by the podium cards and shrink one step on mobile so the
// non-featured #2 / #3 cells fit comfortably in a 2-col grid without text
// overflow. Featured #1 stays larger relative to its siblings at every width.
const Avatar = ({ name, picture, size = 'md', ringClass = '' }) => {
  const szMap = {
    sm: 'w-9 h-9 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-12 h-12 text-base sm:w-16 sm:h-16 sm:text-lg',
    xl: 'w-16 h-16 text-lg sm:w-20 sm:h-20 sm:text-xl',
  };
  const sz     = szMap[size] || szMap.md;
  const letter = name?.charAt(0)?.toUpperCase() || '?';
  const src    = resolveUrl(picture);
  return (
    <div className={`relative flex-shrink-0`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sz} rounded-full object-cover ${ringClass}`}
          onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
        />
      ) : null}
      <div
        className={`${sz} rounded-full bg-primary-100 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 font-bold flex items-center justify-center ${ringClass} ${src ? 'hidden' : ''}`}
      >
        {letter}
      </div>
    </div>
  );
};

// ── PodiumCard (top 3) ───────────────────────────────────────────────────────
// rank 1 = larger card (gold), 2 = silver, 3 = bronze. The card is bordered
// in the rank's accent color and shows medal, avatar, name, score + place
// pill, and a 2-up stat row (Accuracy + MCQs Solved).
const RANK_PALETTE = {
  1: {
    medal: '🥇',
    bg:    'bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 dark:from-amber-950/30 dark:via-amber-950/20 dark:to-orange-950/20',
    border:'border-amber-300 dark:border-amber-700',
    accent:'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/50',
    ring:  'ring-2 ring-amber-300 dark:ring-amber-700',
    crown: true,
  },
  2: {
    medal: '🥈',
    bg:    'bg-[var(--bg-surface)]',
    border:'border-[var(--border)]',
    accent:'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800',
    ring:  '',
    crown: false,
  },
  3: {
    medal: '🥉',
    bg:    'bg-[var(--bg-surface)]',
    border:'border-[var(--border)]',
    accent:'text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-950/40',
    ring:  '',
    crown: false,
  },
};

// `featured` = the #1 entry. Gets the dominant treatment: bigger avatar,
// bigger score, more breathing room, amber glow + ring + outer shadow.
const PodiumCard = ({ entry, isMe, featured = false }) => {
  const p = RANK_PALETTE[entry.rank] || RANK_PALETTE[3];
  return (
    <div
      className={`relative ${p.bg} rounded-2xl border-2 ${p.border} transition-all ${
        featured
          ? 'p-3 sm:p-6 shadow-xl shadow-amber-500/10 dark:shadow-amber-900/20'
          : 'p-3 sm:p-5'
      } ${isMe ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-[var(--bg)]' : ''}`}
    >
      <div className={`flex items-center ${featured ? 'gap-3 sm:gap-5' : 'gap-2.5 sm:gap-4'}`}>
        {/* Avatar — desktop only. Hidden on mobile across the whole leaderboard
            (per design) so cards have room for name + score + place pill
            without truncation. Crown emoji moves inline with the name on
            mobile so #1's status is still visible at small viewports. */}
        <div className="relative hidden sm:block">
          {p.crown && (
            <span aria-hidden className={`absolute -top-3 left-1/2 -translate-x-1/2 ${featured ? 'text-3xl' : 'text-2xl'}`}>👑</span>
          )}
          <Avatar
            name={entry.fullName}
            picture={entry.profilePicture}
            size={featured ? 'xl' : 'lg'}
            ringClass={p.ring}
          />
        </div>

        <div className="flex-1 min-w-0">
          {/* Rank chip + name + (crown if #1). Inline layout replaces the
              previous absolute-positioned corner badge, which was overlapping
              the name on narrow mobile cells when the avatar was hidden. */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className={`inline-flex items-center justify-center rounded-full font-extrabold flex-shrink-0 ${
              featured ? 'w-7 h-7 text-xs' : 'w-6 h-6 text-[10px]'
            } ${p.accent}`}>
              {entry.rank}
            </span>
            {p.crown && (
              <span aria-hidden className="text-lg leading-none sm:hidden">👑</span>
            )}
            <p className={`font-display font-extrabold text-[var(--text-strong)] truncate ${
              featured ? 'text-base sm:text-xl' : 'text-sm sm:text-lg'
            }`}>
              {entry.fullName}
            </p>
            {isMe && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-950/50 px-1.5 sm:px-2 py-0.5 rounded-full">
                You
              </span>
            )}
          </div>

          {/* Score — featured is only slightly bigger than #2/#3 on mobile
              so #1's card doesn't tower over the two cards below it. */}
          <div className="flex items-baseline gap-1 mt-1">
            <span className={`font-extrabold text-primary-600 dark:text-primary-300 tabular-nums leading-none ${
              featured ? 'text-2xl sm:text-4xl' : 'text-2xl sm:text-3xl'
            }`}>
              {entry.score}
            </span>
            <span className="text-xs text-[var(--text-faint)] font-medium">pts</span>
          </div>

          {/* Place pill — single line on every viewport */}
          <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 mt-1 sm:mt-1.5 whitespace-nowrap ${p.accent}`}>
            {ORDINAL(entry.rank)} place
          </span>
        </div>
      </div>

      {/* Stats — 2-up. Shorter "Solved" label on mobile so it stays on one
          line in the narrow 2-col cells. */}
      <div className={`grid grid-cols-2 gap-3 ${featured ? 'mt-3 pt-3 sm:mt-5 sm:pt-4' : 'mt-3 pt-3'} border-t border-[var(--border-faint)]`}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Accuracy</p>
          <p className={`font-extrabold tabular-nums ${accTextClass(entry.accuracy)} ${featured ? 'text-xl' : 'text-base'}`}>
            {safeAcc(entry.accuracy)}%
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
            <span className="sm:hidden">Solved</span>
            <span className="hidden sm:inline">MCQs Solved</span>
          </p>
          <p className={`font-extrabold tabular-nums text-[var(--text-strong)] ${featured ? 'text-xl' : 'text-base'}`}>
            {entry.totalAttempted.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Delta (only on Most Improved) */}
      {entry.delta != null && (
        <div className="mt-2 text-center">
          <span className={`text-xs font-bold ${entry.delta >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
            {entry.delta >= 0 ? '▲' : '▼'} {Math.abs(entry.delta)} pts vs last week
          </span>
        </div>
      )}
    </div>
  );
};

// ── Table row (rank 4+) ──────────────────────────────────────────────────────
// No bottom borders — uses zebra striping at full opacity (not /60) so
// every other row reads as visually separated on both light and dark
// surfaces without needing a divider line. Current-user tint always wins.
// Vertical padding kept tight (py-2.5) so 10+ rows are visible without scroll.
const RankRow = ({ entry, isMe, showDelta }) => {
  const accPct = safeAcc(entry.accuracy);
  // Incorrect should never go negative even if a stale snapshot has
  // correctCount > totalAttempted; floor at 0 for display safety.
  const incorrect = Math.max(0, (entry.totalAttempted || 0) - (entry.correctCount || 0));
  return (
    <tr className={`transition-colors ${
      isMe
        ? 'bg-primary-50 dark:bg-primary-950/30'
        : 'odd:bg-[var(--bg-surface)] even:bg-[var(--bg-muted)] hover:bg-primary-50 dark:hover:bg-primary-950/30'
    }`}>
      {/* Rank */}
      <td className="px-4 py-2 text-center">
        <span className={`text-sm font-extrabold tabular-nums ${isMe ? 'text-primary-600 dark:text-primary-300' : 'text-[var(--text-muted)]'}`}>
          {entry.rank}
        </span>
      </td>

      {/* Student — avatar + name (+ "You" badge) */}
      <td className="px-4 py-2">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={entry.fullName} picture={entry.profilePicture} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className={`text-sm font-bold truncate ${isMe ? 'text-primary-700 dark:text-primary-300' : 'text-[var(--text-strong)]'}`}>
                {entry.fullName}
              </p>
              {isMe && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-950/50 px-1.5 py-0.5 rounded-full">
                  You
                </span>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Score */}
      <td className="px-4 py-2 whitespace-nowrap">
        <span className="text-sm font-extrabold tabular-nums text-primary-600 dark:text-primary-300">
          {entry.score}
        </span>
        <span className="text-[11px] text-[var(--text-faint)] ml-1">pts</span>
      </td>

      {/* Accuracy — with progress bar */}
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold tabular-nums ${accTextClass(entry.accuracy)} w-10`}>
            {safeAcc(entry.accuracy)}%
          </span>
          <div className="hidden sm:block h-1.5 w-24 rounded-full bg-[var(--bg-muted)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${accColorClass(entry.accuracy)}`}
              style={{ width: `${accPct}%` }}
            />
          </div>
        </div>
      </td>

      {/* MCQs solved */}
      <td className="px-4 py-2 text-sm text-[var(--text)] font-semibold tabular-nums">
        {entry.totalAttempted.toLocaleString()}
      </td>

      {/* Correct — emerald to match the success palette */}
      <td className="px-4 py-2 text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-300">
        {Math.min(entry.correctCount, entry.totalAttempted).toLocaleString()}
      </td>

      {/* Incorrect — derived from totalAttempted - correctCount (floored at 0) */}
      <td className="px-4 py-2 text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-300">
        {incorrect.toLocaleString()}
      </td>

      {/* Δ Rank (only Most Improved) */}
      {showDelta && (
        <td className="px-4 py-2 text-center text-xs font-bold whitespace-nowrap">
          {entry.delta == null ? (
            <span className="text-[var(--text-faint)]">—</span>
          ) : entry.delta > 0 ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-300">
              <FiArrowUp className="w-3 h-3" /> {entry.delta}
            </span>
          ) : entry.delta < 0 ? (
            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-300">
              <FiArrowDown className="w-3 h-3" /> {Math.abs(entry.delta)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[var(--text-faint)]">
              <FiMinus className="w-3 h-3" /> 0
            </span>
          )}
        </td>
      )}
    </tr>
  );
};

// ── Your-rank strip ──────────────────────────────────────────────────────────
// Renders the requester's own row at the top of the page so they always see
// their standing without scrolling. Data comes from `data.userRank` which
// the API already returns alongside the top-50 entries (one indexed read on
// the backend, no extra round-trip from the client). Hidden when the user
// has no rank yet (e.g. brand-new student who hasn't completed any test in
// the active period).
const MyRankStrip = ({ userRank, totalRanked, showDelta }) => {
  if (!userRank) return null;
  const acc       = safeAcc(userRank.accuracy);
  const correct   = Math.min(userRank.correctCount ?? 0, userRank.totalAttempted ?? 0);
  const incorrect = Math.max(0, (userRank.totalAttempted ?? 0) - correct);
  // Only show "of N" when N is actually the population size, not the snapshot
  // length. If totalRanked < userRank.rank it's clearly stale / wrong (e.g. an
  // old time-based snapshot that pre-dates the backend setting totalRanked).
  const showOfCount = totalRanked && totalRanked >= userRank.rank;

  return (
    <div className="bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-950/40 dark:to-secondary-950/30 border border-primary-200 dark:border-primary-900/50 rounded-2xl overflow-hidden">
      {/* One grid for both viewports. Mobile = 2 cols → header on row 1 (spans
          both), 4 stats in a 2×2 block below. Desktop = 5 cols → header on
          the left, 4 stat cells filling the rest of the row. Explicit borders
          (instead of divide-*) so we can flip them per breakpoint cleanly. */}
      <div className="grid grid-cols-2 sm:grid-cols-5">
        {/* Header — rank + label + (Δ chip on Most Improved) */}
        <div className="col-span-2 sm:col-span-1 px-4 py-3 sm:px-5 sm:py-3 flex items-center justify-between gap-3 border-b sm:border-b-0 sm:border-r border-primary-200/70 dark:border-primary-900/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-950/60 px-2 py-1 rounded-full flex-shrink-0">
              You
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] leading-none mb-1">
                Your rank
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold tabular-nums text-primary-700 dark:text-primary-200 leading-none">
                  #{userRank.rank}
                </span>
                {showOfCount && (
                  <span className="text-[11px] text-[var(--text-muted)] truncate">of {totalRanked.toLocaleString()}</span>
                )}
              </div>
            </div>
          </div>

          {showDelta && userRank.delta != null && (
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] leading-none mb-1">Δ Week</p>
              <p className={`text-sm font-extrabold tabular-nums leading-none ${userRank.delta >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
                {userRank.delta >= 0 ? '▲' : '▼'} {Math.abs(userRank.delta)}
              </p>
            </div>
          )}
        </div>

        {/* Stat tiles. The vertical right-borders only render where needed
            per viewport so the grid reads as one continuous strip. */}
        <div className="px-4 py-3 border-r border-primary-200/60 dark:border-primary-900/40">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Score</p>
          <p className="text-base sm:text-lg font-extrabold tabular-nums text-[var(--text-strong)] mt-0.5">
            {userRank.score}
            <span className="text-[10px] font-medium text-[var(--text-faint)] ml-1">pts</span>
          </p>
        </div>

        <div className="px-4 py-3 sm:border-r border-primary-200/60 dark:border-primary-900/40">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Accuracy</p>
          <p className={`text-base sm:text-lg font-extrabold tabular-nums mt-0.5 ${accTextClass(acc)}`}>{acc}%</p>
        </div>

        <div className="px-4 py-3 border-t sm:border-t-0 border-r border-primary-200/60 dark:border-primary-900/40">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
            <span className="sm:hidden">Solved</span>
            <span className="hidden sm:inline">MCQs Solved</span>
          </p>
          <p className="text-base sm:text-lg font-extrabold tabular-nums text-[var(--text-strong)] mt-0.5">
            {(userRank.totalAttempted ?? 0).toLocaleString()}
          </p>
        </div>

        <div className="px-4 py-3 border-t sm:border-t-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Correct / Wrong</p>
          <p className="text-base sm:text-lg font-extrabold tabular-nums mt-0.5">
            <span className="text-emerald-600 dark:text-emerald-300">{correct.toLocaleString()}</span>
            <span className="text-[var(--text-faint)] mx-1">/</span>
            <span className="text-rose-600 dark:text-rose-300">{incorrect.toLocaleString()}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

// ── RankCard (mobile) ────────────────────────────────────────────────────────
// Card-shaped row used on mobile where the table doesn't fit cleanly. Same
// data as RankRow, restructured for vertical space: rank pill + identity on
// the left, stat blocks stacked on the right. The current-user tint always
// wins so the student can find themselves at a glance.
const RankCard = ({ entry, isMe, showDelta }) => {
  const acc       = safeAcc(entry.accuracy);
  const accPct    = acc;
  const correct   = Math.min(entry.correctCount, entry.totalAttempted);
  const incorrect = Math.max(0, (entry.totalAttempted || 0) - (entry.correctCount || 0));
  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        isMe
          ? 'bg-primary-50 dark:bg-primary-950/30 border-primary-300 dark:border-primary-900/50'
          : 'bg-[var(--bg-surface)] border-[var(--border)]'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Rank pill — the only identifier; avatar removed for mobile cleanliness */}
        <span
          className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-extrabold tabular-nums text-sm ${
            isMe
              ? 'bg-primary-500 text-white'
              : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
          }`}
        >
          {entry.rank}
        </span>

        {/* Identity — no avatar; gives the name room to breathe */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className={`text-sm font-bold truncate ${isMe ? 'text-primary-700 dark:text-primary-300' : 'text-[var(--text-strong)]'}`}>
              {entry.fullName}
            </p>
            {isMe && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-950/50 px-1.5 py-0.5 rounded-full">
                You
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--text-faint)] mt-0.5">
            <span className="font-bold text-primary-600 dark:text-primary-300">{entry.score}</span> pts
            <span className="mx-1.5">·</span>
            <span className="text-[var(--text-muted)]">{entry.totalAttempted.toLocaleString()} solved</span>
          </p>
        </div>

        {/* Δ chip (only Most Improved) — keeps height in check on mobile. */}
        {showDelta && entry.delta != null && (
          <div className="flex-shrink-0 text-right">
            <span className={`inline-flex items-center gap-0.5 text-[11px] font-extrabold ${
              entry.delta > 0 ? 'text-emerald-600 dark:text-emerald-300'
              : entry.delta < 0 ? 'text-rose-600 dark:text-rose-300'
              : 'text-[var(--text-faint)]'
            }`}>
              {entry.delta > 0 ? <FiArrowUp className="w-3 h-3" /> : entry.delta < 0 ? <FiArrowDown className="w-3 h-3" /> : <FiMinus className="w-3 h-3" />}
              {Math.abs(entry.delta)}
            </span>
          </div>
        )}
      </div>

      {/* Accuracy bar + Correct/Wrong inline stats */}
      <div className="mt-2.5 grid grid-cols-3 gap-2 items-center">
        <div className="col-span-2 flex items-center gap-2">
          <span className={`text-xs font-bold tabular-nums w-9 ${accTextClass(acc)}`}>{acc}%</span>
          <div className="h-1.5 flex-1 rounded-full bg-[var(--bg-muted)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${accColorClass(acc)}`}
              style={{ width: `${accPct}%` }}
            />
          </div>
        </div>
        <div className="text-right text-[11px] tabular-nums whitespace-nowrap">
          <span className="text-emerald-600 dark:text-emerald-300 font-bold">{correct.toLocaleString()}</span>
          <span className="text-[var(--text-faint)] mx-0.5">/</span>
          <span className="text-rose-600 dark:text-rose-300 font-bold">{incorrect.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

// ── Empty state ──────────────────────────────────────────────────────────────
const EmptyState = ({ type }) => (
  <div className="flex flex-col items-center justify-center py-20 text-[var(--text-faint)]">
    <FiAward className="w-14 h-14 mb-4 opacity-30" />
    <p className="text-base font-semibold text-[var(--text-muted)]">No rankings yet</p>
    <p className="text-sm mt-1 text-center max-w-xs">
      {type === 'subject'
        ? 'No subject boards available. Complete tests from a question bank to appear here.'
        : 'Be the first to complete a test and claim the top spot!'}
    </p>
  </div>
);

// ── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = () => (
  <div className="animate-pulse">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-44 rounded-2xl bg-[var(--bg-muted)]" />
      ))}
    </div>
    <div className="space-y-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-14 rounded-xl bg-[var(--bg-muted)]" />
      ))}
    </div>
  </div>
);

// ── Main page ────────────────────────────────────────────────────────────────
const LeaderboardPage = () => {
  const { user } = useAuth();
  const [activeTab,    setActiveTab]    = useState('alltime');
  const [subjects,     setSubjects]     = useState([]);
  const [selectedSubj, setSelectedSubj] = useState('');
  const [data,         setData]         = useState(null);
  const [loading,      setLoading]      = useState(true);

  const currentUserId = user?._id?.toString() || user?.id?.toString();
  const showDelta     = activeTab === 'mostimproved';

  // Per-tab cache so switching back to a previously-loaded tab is instant.
  // Same stale-while-revalidate pattern as before — preserved verbatim.
  const tabCacheRef = useRef({});

  const fetchBoardForTab = useCallback(async (tabType, subjectTitle) => {
    const key = tabType === 'subject' ? `subject:${subjectTitle}` : tabType;
    if (tabCacheRef.current[key]) {
      setData(tabCacheRef.current[key]);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const params = { type: tabType };
      if (tabType === 'subject') params.subjectTitle = subjectTitle;
      const res     = await apiClient.get('/leaderboard', { params });
      const newData = res.data.data || null;
      tabCacheRef.current[key] = newData;
      setData(newData);
    } catch {
      if (!tabCacheRef.current[key]) setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load subject list once on mount
  useEffect(() => {
    apiClient.get('/leaderboard/subjects')
      .then((res) => {
        const list = res.data.data || [];
        setSubjects(list);
        if (list.length > 0) setSelectedSubj(list[0].title);
      })
      .catch(() => {});
  }, []);

  // Fetch non-subject boards on tab switch
  useEffect(() => {
    if (activeTab !== 'subject') fetchBoardForTab(activeTab, null);
  }, [activeTab, fetchBoardForTab]);

  // Fetch subject board when subject is picked
  useEffect(() => {
    if (activeTab === 'subject' && selectedSubj) fetchBoardForTab('subject', selectedSubj);
  }, [activeTab, selectedSubj, fetchBoardForTab]);

  // ── Refresh handler — memoised so the navbar action button below gets a
  // stable reference. Without useCallback, every render creates a new
  // function → useMemo for `headerAction` invalidates → `usePageHeader`
  // calls setHeader → re-render → infinite loop.
  const handleRefresh = useCallback(() => {
    const key = activeTab === 'subject' ? `subject:${selectedSubj}` : activeTab;
    delete tabCacheRef.current[key];
    if (activeTab === 'subject' && selectedSubj) fetchBoardForTab('subject', selectedSubj);
    else if (activeTab !== 'subject') fetchBoardForTab(activeTab, null);
  }, [activeTab, selectedSubj, fetchBoardForTab]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const entries    = data?.entries || [];
  const top3       = entries.slice(0, 3);
  const rest       = entries.slice(3);
  const hasEntries = entries.length > 0;
  const totalRanked = data?.totalRanked ?? entries.length;
  const updatedAgo = data?.computedAt ? fmtTime(data.computedAt) : null;

  const subtitle = useMemo(() => {
    let s = 'Rankings based on MCQ performance';
    if (updatedAgo) s += ` · updated ${updatedAgo}`;
    return s;
  }, [updatedAgo]);

  // Memoise the action JSX so its reference is stable across renders.
  // PageHeaderContext's effect depends on `action`; a fresh JSX element each
  // render would otherwise refire the effect → setHeader → re-render loop.
  const headerAction = useMemo(() => (
    <button
      onClick={handleRefresh}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[var(--text-strong)] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl hover:bg-[var(--bg-muted)] disabled:opacity-50 transition-colors"
    >
      <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
      Refresh
    </button>
  ), [handleRefresh, loading]);

  usePageHeader({
    title:    'Leaderboard',
    subtitle,
    action:   headerAction,
  });

  return (
    <div className="space-y-5">
      {/* ── Tabs row — segmented-control style ───────────────────────────────
          MOBILE  : single rounded "track" with 5 equal-flex segments. The
                    active segment gets the brand fill; the rest are
                    transparent so the row reads as one cohesive control.
                    Compact `short` labels keep all 5 visible without scroll.
          DESKTOP : same shape, fuller labels and a touch more padding. */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-1 sm:p-1.5">
        <div role="tablist" className="grid grid-cols-5 gap-0.5 sm:gap-1">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.key)}
                className={`group flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 sm:px-3 py-2 sm:py-2 rounded-xl text-[11px] sm:text-sm font-semibold transition-all min-w-0 ${
                  active
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                }`}
              >
                <span className={`flex-shrink-0 ${active ? 'text-white' : 'text-[var(--text-faint)] group-hover:text-[var(--text-muted)]'}`}>
                  {tab.icon}
                </span>
                <span className="truncate">
                  <span className="sm:hidden">{tab.short}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Subject sub-tabs — second-level tabs under "Subject-Wise" ───────
          MOBILE  : 2-col grid of pill tabs. Wraps gracefully when there are
                    odd numbers of subjects.
          DESKTOP : horizontal inline pill row with a label on the left. */}
      {activeTab === 'subject' && (
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-3 sm:p-4">
          {subjects.length === 0 ? (
            <p className="text-sm text-[var(--text-faint)] text-center py-2">
              No subject boards yet. Once students complete tests from a question bank, subject boards will appear here.
            </p>
          ) : (
            <>
              {/* Label — always visible, stacks above on mobile */}
              <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[var(--text-faint)]">
                  <FiBook className="w-3.5 h-3.5" /> Subject
                </span>
                <span className="text-[10px] font-mono text-[var(--text-faint)]">
                  {subjects.length} board{subjects.length === 1 ? '' : 's'}
                </span>
              </div>

              {/* Pills — 2-col grid on mobile, inline flex on desktop */}
              <div role="tablist" className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                {subjects.map((s) => {
                  const active = selectedSubj === s.title;
                  return (
                    <button
                      key={s.title}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSelectedSubj(s.title)}
                      className={`capitalize text-xs sm:text-sm px-3 py-2 sm:py-1.5 rounded-xl font-semibold transition-colors truncate ${
                        active
                          ? 'bg-secondary-600 text-white shadow-sm'
                          : 'bg-[var(--bg-muted)] border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:border-secondary-300 dark:hover:border-secondary-800'
                      }`}
                    >
                      {s.title}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Description bar ── */}
      <p className="text-sm text-[var(--text-muted)]">
        {activeTab === 'subject' && selectedSubj
          ? <>Rankings for subject: <strong className="capitalize text-[var(--text)]">{selectedSubj}</strong>.</>
          : TAB_DESCRIPTIONS[activeTab]}
      </p>

      {/* ── Content ── */}
      {loading && !hasEntries ? (
        <Skeleton />
      ) : !hasEntries ? (
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)]">
          <EmptyState type={activeTab} />
        </div>
      ) : (
        <>
          {/* Your-rank strip — reads from the already-fetched data.userRank
              so no extra HTTP / DB cost. Shown above the podium so the user
              always sees their own standing first. */}
          <MyRankStrip
            userRank={data?.userRank}
            totalRanked={totalRanked}
            showDelta={showDelta}
          />

          {/* TOP 3 cards.
              MOBILE  : #1 as a full-width hero card, then #2 + #3 in a 2-col grid below.
                        Reads naturally top-to-bottom on a phone instead of stacking the
                        biggest card in the middle.
              DESKTOP : 3 equal-width columns rendered as [#2, #1, #3] so #1 sits centred. */}
          {top3.length > 0 && (
            <>
              {/* Mobile podium */}
              <div className="sm:hidden space-y-3">
                {top3[0] && (
                  <PodiumCard
                    entry={top3[0]}
                    isMe={top3[0].userId?.toString() === currentUserId}
                    featured
                  />
                )}
                {(top3[1] || top3[2]) && (
                  <div className="grid grid-cols-2 gap-3">
                    {top3[1] && (
                      <PodiumCard
                        entry={top3[1]}
                        isMe={top3[1].userId?.toString() === currentUserId}
                      />
                    )}
                    {top3[2] && (
                      <PodiumCard
                        entry={top3[2]}
                        isMe={top3[2].userId?.toString() === currentUserId}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Desktop podium */}
              <div className="hidden sm:grid sm:grid-cols-3 gap-4 items-stretch">
                {[top3[1], top3[0], top3[2]].filter(Boolean).map((entry) => (
                  <PodiumCard
                    key={entry.userId}
                    entry={entry}
                    isMe={entry.userId?.toString() === currentUserId}
                    featured={entry.rank === 1}
                  />
                ))}
              </div>
            </>
          )}

          {/* ── Full ranking list ─────────────────────────────────────────
              MOBILE  : stacked card list (RankCard). No horizontal scroll.
              DESKTOP : the original 7-column table (RankRow). */}

          {/* Mobile card list */}
          <div className="sm:hidden space-y-2">
            {[...top3, ...rest].map((entry) => (
              <RankCard
                key={`m-${entry.userId}`}
                entry={entry}
                isMe={entry.userId?.toString() === currentUserId}
                showDelta={showDelta}
              />
            ))}
            <div className="text-[11px] text-[var(--text-faint)] text-center pt-2 px-2">
              Showing <strong className="text-[var(--text)]">1–{entries.length}</strong> of{' '}
              <strong className="text-[var(--text)]">{totalRanked.toLocaleString()}</strong>{' '}
              student{totalRanked === 1 ? '' : 's'} · Refreshes every 10 min
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]">
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider whitespace-nowrap">#</th>
                    <th className="px-4 py-3 text-left   text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider whitespace-nowrap">Student</th>
                    <th className="px-4 py-3 text-left   text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider whitespace-nowrap">Score</th>
                    <th className="px-4 py-3 text-left   text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider whitespace-nowrap">Accuracy</th>
                    <th className="px-4 py-3 text-left   text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider whitespace-nowrap">MCQs Solved</th>
                    <th className="px-4 py-3 text-left   text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider whitespace-nowrap">Correct</th>
                    <th className="px-4 py-3 text-left   text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider whitespace-nowrap">Incorrect</th>
                    {showDelta && (
                      <th className="px-4 py-3 text-center text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider whitespace-nowrap">Δ Rank</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {/* Top-3 also appear in the table for completeness. */}
                  {top3.map((entry) => (
                    <RankRow
                      key={entry.userId}
                      entry={entry}
                      isMe={entry.userId?.toString() === currentUserId}
                      showDelta={showDelta}
                    />
                  ))}
                  {rest.map((entry) => (
                    <RankRow
                      key={entry.userId}
                      entry={entry}
                      isMe={entry.userId?.toString() === currentUserId}
                      showDelta={showDelta}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-[var(--border)] text-[11px] text-[var(--text-faint)] bg-[var(--bg-muted)]/50">
              <span>
                Showing <strong className="text-[var(--text)]">1–{entries.length}</strong> of{' '}
                <strong className="text-[var(--text)]">{totalRanked.toLocaleString()}</strong> student{totalRanked === 1 ? '' : 's'}
              </span>
              <span>Scores refresh every 10 minutes · Accuracy = Correct / Total</span>
            </div>
          </div>
        </>
      )}

      {/* ── Most-Improved legend ── */}
      {activeTab === 'mostimproved' && hasEntries && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-xl p-4">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1 flex items-center gap-1.5">
            <FiTrendingUp className="w-4 h-4" /> How Most Improved works
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            Compares this week's score vs last week's. Score = improvement × activity bonus.
            Minimum 10 MCQs this week required. The Δ column shows the raw score change.
          </p>
        </div>
      )}

      {/* ── Scoring formula footer ── */}
      <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-4">
        <p className="text-xs font-semibold text-[var(--text-muted)] mb-1 flex items-center gap-1.5">
          <FiAward className="w-3.5 h-3.5" /> Scoring formula
        </p>
        <p className="text-[11px] text-[var(--text-faint)] leading-relaxed">
          Score (0–1000) = Accuracy 70% + Volume 30%. Accuracy uses Bayesian smoothing
          to be fair for students with fewer attempts. Volume cap for this board:{' '}
          <strong className="text-[var(--text)]">{VOL_CAPS[activeTab]}</strong> MCQs.
        </p>
      </div>
    </div>
  );
};

export default LeaderboardPage;
