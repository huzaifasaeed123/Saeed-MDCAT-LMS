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
const TABS = [
  { key: 'alltime',      label: 'All-Time',      icon: <FiAward       className="w-4 h-4" /> },
  { key: 'weekly',       label: 'This Week',     icon: <FiZap         className="w-4 h-4" /> },
  { key: 'monthly',      label: 'This Month',    icon: <FiCalendar    className="w-4 h-4" /> },
  { key: 'mostimproved', label: 'Most Improved', icon: <FiTrendingUp  className="w-4 h-4" /> },
  { key: 'subject',      label: 'Subject-Wise',  icon: <FiBook        className="w-4 h-4" /> },
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

const accColorClass = (acc) => {
  if (acc >= 80) return 'bg-emerald-500';
  if (acc >= 60) return 'bg-primary-500';
  return 'bg-rose-500';
};

const accTextClass = (acc) => {
  if (acc >= 80) return 'text-emerald-600 dark:text-emerald-300';
  if (acc >= 60) return 'text-primary-600 dark:text-primary-300';
  return 'text-rose-600 dark:text-rose-300';
};

const ORDINAL = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// ── Avatar ───────────────────────────────────────────────────────────────────
const Avatar = ({ name, picture, size = 'md', ringClass = '' }) => {
  const szMap = {
    sm: 'w-9 h-9 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-20 h-20 text-xl',
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
          ? 'p-5 sm:p-6 shadow-xl shadow-amber-500/10 dark:shadow-amber-900/20'
          : 'p-4 sm:p-5'
      } ${isMe ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-[var(--bg)]' : ''}`}
    >
      {/* Rank badge in the top-left corner */}
      <span className={`absolute top-3 left-3 inline-flex items-center justify-center rounded-full font-extrabold ${
        featured ? 'w-8 h-8 text-sm' : 'w-7 h-7 text-xs'
      } ${p.accent}`}>
        {entry.rank}
      </span>

      <div className={`flex items-center ${featured ? 'gap-4 sm:gap-5' : 'gap-3 sm:gap-4'}`}>
        <div className="relative">
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
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`font-display font-extrabold text-[var(--text-strong)] truncate ${
              featured ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'
            }`}>
              {entry.fullName}
            </p>
            {isMe && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-950/50 px-2 py-0.5 rounded-full">
                You
              </span>
            )}
          </div>

          {/* Score — featured slightly larger; restrained because the
              columns are equal-width now and an oversized number was eating
              the layout. */}
          <div className="flex items-baseline gap-1 mt-1">
            <span className={`font-extrabold text-primary-600 dark:text-primary-300 tabular-nums leading-none ${
              featured ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'
            }`}>
              {entry.score}
            </span>
            <span className="text-xs text-[var(--text-faint)] font-medium">pts</span>
          </div>

          {/* Place pill */}
          <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 mt-1.5 ${p.accent}`}>
            {ORDINAL(entry.rank)} place
          </span>
        </div>
      </div>

      {/* Stats — 2-up (no streak field in the API) */}
      <div className={`grid grid-cols-2 gap-3 ${featured ? 'mt-5 pt-4' : 'mt-4 pt-3'} border-t border-[var(--border-faint)]`}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Accuracy</p>
          <p className={`font-extrabold tabular-nums ${accTextClass(entry.accuracy)} ${featured ? 'text-xl' : 'text-base'}`}>
            {entry.accuracy}%
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">MCQs Solved</p>
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
const RankRow = ({ entry, isMe, showDelta }) => {
  const accPct = Math.min(100, Math.max(0, entry.accuracy || 0));
  return (
    <tr className={`transition-colors ${
      isMe
        ? 'bg-primary-50 dark:bg-primary-950/30'
        : 'odd:bg-[var(--bg-surface)] even:bg-[var(--bg-muted)] hover:bg-primary-50 dark:hover:bg-primary-950/30'
    }`}>
      {/* Rank */}
      <td className="px-4 py-4 text-center">
        <span className={`text-sm font-extrabold tabular-nums ${isMe ? 'text-primary-600 dark:text-primary-300' : 'text-[var(--text-muted)]'}`}>
          {entry.rank}
        </span>
      </td>

      {/* Student — avatar + name (+ "You" badge) */}
      <td className="px-4 py-4">
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
      <td className="px-4 py-4 whitespace-nowrap">
        <span className="text-sm font-extrabold tabular-nums text-primary-600 dark:text-primary-300">
          {entry.score}
        </span>
        <span className="text-[11px] text-[var(--text-faint)] ml-1">pts</span>
      </td>

      {/* Accuracy — with progress bar */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold tabular-nums ${accTextClass(entry.accuracy)} w-10`}>
            {entry.accuracy}%
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
      <td className="px-4 py-4 text-sm text-[var(--text)] font-semibold tabular-nums">
        {entry.totalAttempted.toLocaleString()}
      </td>

      {/* Correct — emerald to match the success palette */}
      <td className="px-4 py-4 text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-300">
        {entry.correctCount.toLocaleString()}
      </td>

      {/* Incorrect — derived from totalAttempted - correctCount */}
      <td className="px-4 py-4 text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-300">
        {(entry.totalAttempted - entry.correctCount).toLocaleString()}
      </td>

      {/* Δ Rank (only Most Improved) */}
      {showDelta && (
        <td className="px-4 py-4 text-center text-xs font-bold whitespace-nowrap">
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
      {/* ── Tabs row (5 only — All-Time / This Week / This Month / Most Improved / Subject-Wise) ── */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 no-scrollbar">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all flex-shrink-0 ${
                active
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Subject filter row — only when Subject-Wise tab is active ── */}
      {activeTab === 'subject' && (
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-3 sm:p-4">
          {subjects.length === 0 ? (
            <p className="text-sm text-[var(--text-faint)] text-center py-2">
              No subject boards yet. Once students complete tests from a question bank, subject boards will appear here.
            </p>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-faint)] mr-1">
                <FiBook className="w-3.5 h-3.5" /> Subject
              </span>
              {subjects.map((s) => {
                const active = selectedSubj === s.title;
                return (
                  <button
                    key={s.title}
                    onClick={() => setSelectedSubj(s.title)}
                    className={`capitalize text-sm px-3 py-1.5 rounded-xl font-semibold transition-colors flex-shrink-0 ${
                      active
                        ? 'bg-secondary-600 text-white'
                        : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                    }`}
                  >
                    {s.title}
                  </button>
                );
              })}
            </div>
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
          {/* TOP 3 cards — equal width columns. Display order is [2nd · 1st ·
              3rd] so #1 sits centred on desktop. #1 stands out through
              styling (gold gradient, crown, bigger score, shadow) — not raw
              width. Cards stack to full width on mobile. */}
          {top3.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
              {[top3[1], top3[0], top3[2]].filter(Boolean).map((entry) => (
                <PodiumCard
                  key={entry.userId}
                  entry={entry}
                  isMe={entry.userId?.toString() === currentUserId}
                  featured={entry.rank === 1}
                />
              ))}
            </div>
          )}

          {/* Full table */}
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
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
                  {/* Top-3 also appear in the table for completeness, matching the screenshot. */}
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

            {/* Table footer — count + refresh hint */}
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
